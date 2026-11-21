import { FastifyPluginAsync } from 'fastify';
import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@brain-storm/shared';

declare module 'socket.io' {
  interface SocketData {
    userId?: string;
    sessionId?: string;
  }
}

const socketIOPlugin: FastifyPluginAsync = async (fastify) => {
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Сохраняем экземпляр io в fastify для использования в других модулях
  fastify.decorate('io', io);

  // Broadcast server_time всем клиентам каждые 10 секунд
  const timeInterval = setInterval(() => {
    io.emit('server_time', { serverTime: Date.now() });
  }, 10_000);

  // Отправляем server_time при подключении каждого клиента
  io.on('connection', (socket) => {
    fastify.log.info(`Подключён клиент: ${socket.id}`);
    socket.emit('server_time', { serverTime: Date.now() });

    // Обработчик join_session
    socket.on('join_session', async (sessionId: string) => {
      try {
        // Извлекаем токен из handshake
        const token =
          socket.handshake.auth.token ||
          (socket.handshake.query.token as string);

        if (!token) {
          socket.emit('error', { message: 'Токен не предоставлен' });
          return;
        }

        // Проверяем JWT токен
        let decoded: any;
        try {
          decoded = fastify.jwt.verify(token);
        } catch (err) {
          socket.emit('error', { message: 'Неверный токен' });
          return;
        }

        // Сравниваем sessionId из токена с переданным sessionId
        if (decoded.sessionId !== sessionId) {
          socket.emit('error', { message: 'Неверный sessionId' });
          return;
        }

        // Присоединяем socket к room
        socket.join(sessionId);
        socket.data.sessionId = sessionId;
        socket.data.userId = decoded.sub;

        fastify.log.info(
          `Пользователь ${decoded.sub} присоединился к сессии ${sessionId}`
        );

        socket.emit('joined', { sessionId });
      } catch (err) {
        fastify.log.error(err);
        socket.emit('error', { message: 'Ошибка при присоединении к сессии' });
      }
    });

    // Обработчик leave_session
    socket.on('leave_session', () => {
      try {
        const sessionId = socket.data.sessionId;
        if (sessionId) {
          socket.leave(sessionId);
          fastify.log.info(
            `Пользователь ${socket.data.userId} покинул сессию ${sessionId}`
          );
          socket.emit('left', { sessionId });
        }

        // Очищаем данные сессии
        socket.data.sessionId = undefined;
        socket.data.userId = undefined;
      } catch (err) {
        fastify.log.error(err);
        socket.emit('error', { message: 'Ошибка при выходе из сессии' });
      }
    });

    // Обработчик голосования
    socket.on('cast_vote', async (ideaId: string, callback: (error?: string) => void) => {
      const userId = socket.data.userId;
      const sessionId = socket.data.sessionId;

      if (!userId || !sessionId) {
        const error = 'Необходимо присоединиться к сессии';
        socket.emit('vote_rejected', error);
        return callback(error);
      }

      try {
        // 1. Проверить, что idea принадлежит этой сессии
        const idea = await fastify.prisma.idea.findUnique({ where: { id: ideaId } });
        if (!idea || idea.sessionId !== sessionId) {
          const error = 'Идея не найдена или не принадлежит этой сессии';
          socket.emit('vote_rejected', error);
          return callback(error);
        }

        // 2. Проверить лимит голосов пользователя
        const session = await fastify.prisma.session.findUnique({ where: { id: sessionId } });
        const sessionConfig = session?.config as Record<string, unknown> | null;
        const voteLimit = (typeof sessionConfig?.voteLimit === 'number' && sessionConfig.voteLimit > 0)
          ? sessionConfig.voteLimit
          : 10;

        const currentVotes = await fastify.prisma.vote.count({
          where: {
            userId,
            idea: { sessionId },
          },
        });

        if (currentVotes >= voteLimit) {
          const error = 'Лимит голосов исчерпан';
          socket.emit('vote_rejected', error);
          return callback(error);
        }

        // 3. Создать Vote
        await fastify.prisma.vote.create({
          data: { ideaId, userId },
        });

        // 4. Получить новый счёт
        const voteCount = await fastify.prisma.vote.count({
          where: { ideaId },
        });

        // 5. Отправить vote_updated всем в room
        socket.to(sessionId).emit('vote_updated', { ideaId, voteCount });
        socket.emit('vote_updated', { ideaId, voteCount });

        fastify.log.info(
          `Пользователь ${userId} проголосовал за идею ${ideaId} (итого: ${voteCount})`
        );

        callback(); // успех
      } catch (error: unknown) {
        const err = error as { code?: string };
        // P2002 — unique constraint violation (уже голосовал за эту идею)
        if (err?.code === 'P2002') {
          const errorMsg = 'Вы уже голосовали за эту идею';
          socket.emit('vote_rejected', errorMsg);
          return callback(errorMsg);
        }
        fastify.log.error(err);
        callback('Ошибка сервера');
      }
    });

    // Обработчик отключения
    socket.on('disconnect', () => {
      fastify.log.info(`Отключён клиент: ${socket.id}`);
    });
  });

  fastify.log.info('Socket.IO инициализирован');
};

export default socketIOPlugin;

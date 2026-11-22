import { FastifyInstance } from 'fastify';
import fastifyWebSocket from '@fastify/websocket';
import { verifyAccessToken } from '@/lib/jwt';
import { createLogger } from '@/lib/logger';
import { SessionSocket, handleJoinSession, handleLeaveSession, handleCreateIdea, handleVote } from './handlers';
import { leaveRoom } from './rooms';

const logger = createLogger({ module: 'ws:socket' });

// Генератор уникальных ID для сокетов
let socketCounter = 0;
function generateSocketId(): string {
  return `ws-${Date.now()}-${++socketCounter}`;
}

export async function registerWebSocket(fastify: FastifyInstance) {
  await fastify.register(fastifyWebSocket);

  fastify.get('/ws', { websocket: true }, (socket, request) => {
    const ws = socket as SessionSocket;
    const url = request.raw.url;

    ws.id = generateSocketId();

    logger.info({ remoteAddr: request.raw.socket.remoteAddress, socketId: ws.id }, 'WebSocket connection established');

    // Извлекаем JWT из query параметра или cookie
    let token: string | undefined;

    // Пытаемся получить токен из query: ?token=xxx
    if (url) {
      const urlParts = new URL(url, `http://${request.raw.headers.host}`);
      const queryToken = urlParts.searchParams.get('token');
      if (queryToken) {
        token = queryToken;
      }
    }

    // Если нет в query, пробуем из cookie
    if (!token) {
      token = request.cookies?.access_token ?? undefined;
    }

    // Декодируем пользователя
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        ws.userId = payload.userId;
        logger.info({ userId: ws.userId, socketId: ws.id }, 'WebSocket user authenticated');
      } catch {
        logger.warn({ socketId: ws.id }, 'WebSocket: invalid or missing token');
      }
    }

    // Обработчик входящих сообщений
    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as {
          type: string;
          payload?: Record<string, unknown>;
        };

        logger.debug({ type: message.type, userId: ws.userId, socketId: ws.id }, 'WebSocket message received');

        switch (message.type) {
          case 'join_session':
            await handleJoinSession(ws, message.payload ?? {});
            break;
          case 'leave_session':
            handleLeaveSession(ws, message.payload ?? {});
            break;
          case 'create_idea':
            await handleCreateIdea(ws, message.payload ?? {});
            break;
          case 'vote':
            await handleVote(ws, message.payload ?? {});
            break;
          default:
            ws.send(
              JSON.stringify({
                type: 'error',
                payload: { message: `Unknown message type: ${message.type}`, code: 'BAD_REQUEST' },
              })
            );
        }
      } catch (error: any) {
        logger.error({ err: error, userId: ws.userId, socketId: ws.id }, 'WebSocket message handler error');
        if (ws.readyState === 1) {
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'Internal server error', code: 'INTERNAL_ERROR' },
            })
          );
        }
      }
    });

    // Обработчик закрытия соединения
    ws.on('close', () => {
      if (ws.currentSession) {
        leaveRoom(ws.currentSession, ws.id);
      }
      logger.info({ userId: ws.userId, socketId: ws.id }, 'WebSocket connection closed');
    });

    // Обработчик ошибок
    ws.on('error', (err) => {
      logger.error({ err, userId: ws.userId, socketId: ws.id }, 'WebSocket error');
    });
  });

  logger.info('WebSocket registered on /ws');
}

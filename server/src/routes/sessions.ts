import { FastifyPluginAsync } from 'fastify';
import { CreateSessionSchema, UpdateSessionResultSchema } from '../schemas/session.schema';
import { advanceStage } from '../services/sessionStage.service';

const sessionRoutes: FastifyPluginAsync = async (fastify) => {
  // POST / — создание сессии
  fastify.post('/', async (request, reply) => {
    const body = CreateSessionSchema.parse(request.body);
    const organizerId = (request.user as { sub: string }).sub;

    const session = await fastify.prisma.session.create({
      data: {
        organizerId,
        topic: body.topic,
        mode: body.mode,
        config: body.config as unknown as Parameters<typeof fastify.prisma.session.create>['0']['data']['config'],
        status: 'ACTIVE',
      },
    });

    reply.code(201).send(session);
  });

  // GET /:id — получение сессии с проверкой доступа
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const session = await fastify.prisma.session.findUnique({
      where: { id },
    });

    if (!session) {
      reply.code(404).send({ error: 'Сессия не найдена' });
      return;
    }

    // Органайзер имеет доступ
    if (session.organizerId === userId) {
      reply.code(200).send(session);
      return;
    }

    // Проверка участия: есть ли идея автора в этой сессии
    const ideaCount = await fastify.prisma.idea.count({
      where: { sessionId: id, authorId: userId },
    });

    if (ideaCount === 0) {
      reply.code(403).send({ error: 'Нет доступа к сессии' });
      return;
    }

    reply.code(200).send(session);
  });

  // POST /:id/advance — переход к следующему этапу сессии
  fastify.post('/:id/advance', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Проверка что пользователь — организатор сессии
    const session = await fastify.prisma.session.findUnique({ where: { id } });
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    if (session.organizerId !== userId) {
      return reply.status(403).send({ error: 'Only the organizer can advance the stage' });
    }

    const { session: updatedSession, stageDeadline } = await advanceStage(fastify.prisma, id);

    // Отправляем WebSocket событие всем подключенным к сессии
    const io = fastify.io;
    io.to(id).emit('stage_advanced', {
      sessionId: id,
      stage: updatedSession.currentStage,
      stageDeadline,
    });

    return reply.status(200).send({
      session: updatedSession.id,
      stage: updatedSession.currentStage,
      stageDeadline,
    });
  });

  // Helper: проверка доступа к сессии (organizer или участник с идеей)
  const checkSessionAccess = async (sessionId: string, userId: string, reply: any) => {
    const session = await fastify.prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      reply.code(404).send({ error: 'Сессия не найдена' });
      return null;
    }
    if (session.organizerId === userId) {
      return session;
    }
    const ideaCount = await fastify.prisma.idea.count({
      where: { sessionId, authorId: userId },
    });
    if (ideaCount === 0) {
      reply.code(403).send({ error: 'Нет доступа к сессии' });
      return null;
    }
    return session;
  };

  // GET /:id/result — получение результата завершённой сессии
  fastify.get('/:id/result', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    const session = await checkSessionAccess(id, userId, reply);
    if (!session) return;

    // Если selectedIdeaId есть, получаем связанную идею
    let selectedIdea = null;
    if (session.selectedIdeaId) {
      selectedIdea = await fastify.prisma.idea.findUnique({
        where: { id: session.selectedIdeaId },
        select: { title: true, content: true },
      });
    }

    const nextSteps = (session.nextSteps as string[] | null) || [];

    reply.code(200).send({
      selectedIdea,
      nextSteps,
      sessionSummary: session.sessionSummary,
    });
  });

  // PATCH /:id/result — сохранение результата завершённой сессии (только организатор)
  fastify.patch('/:id/result', async (request, reply) => {
    const { id } = request.params as { id: string };
    const userId = (request.user as { sub: string }).sub;

    // Только организатор может сохранять результат
    const session = await fastify.prisma.session.findUnique({ where: { id } });
    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    if (session.organizerId !== userId) {
      return reply.status(403).send({ error: 'Only the organizer can update the result' });
    }

    const body = UpdateSessionResultSchema.parse(request.body);

    const data: Record<string, unknown> = {};
    if (body.nextSteps !== undefined) {
      data.nextSteps = body.nextSteps;
    }
    if (body.sessionSummary !== undefined) {
      data.sessionSummary = body.sessionSummary;
    }

    const updatedSession = await fastify.prisma.session.update({
      where: { id },
      data,
    });

    reply.code(200).send({
      nextSteps: (updatedSession.nextSteps as string[] | null) || [],
      sessionSummary: updatedSession.sessionSummary,
    });
  });
};

export default sessionRoutes;

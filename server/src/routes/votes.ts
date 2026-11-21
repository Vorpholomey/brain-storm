import { FastifyPluginAsync } from 'fastify';
import { finalVoteSchema } from '../schemas/idea.schema';

const votesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /sessions/:sessionId/vote — финальное голосование за одну идею-финалиста
  fastify.post('/:sessionId/vote', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request.user as { sub: string }).sub;
    const body = finalVoteSchema.parse(request.body);
    const { ideaId } = body;

    // Проверка существования сессии
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Проверка что сессия в этапе FINAL_VOTE
    if (session.currentStage !== 'FINAL_VOTE') {
      return reply.status(400).send({ error: 'Voting is only allowed during FINAL_VOTE stage' });
    }

    // Получаем идею и проверяем что она FINALIST
    const idea = await fastify.prisma.idea.findUnique({
      where: { id: ideaId },
    });

    if (!idea) {
      return reply.status(404).send({ error: 'Idea not found' });
    }

    if (idea.sessionId !== sessionId) {
      return reply.status(400).send({ error: 'Idea does not belong to this session' });
    }

    if (idea.status !== 'FINALIST') {
      return reply.status(400).send({ error: 'Can only vote for finalist ideas' });
    }

    // Получаем все идеи-финалисты сессии
    const finalistIds = await fastify.prisma.idea.findMany({
      where: { sessionId, status: 'FINALIST' },
      select: { id: true },
    });

    const finalistIdList = finalistIds.map((f) => f.id);

    // Проверка что пользователь уже не проголосовал за ЛЮБУЮ из идей-финалистов
    const existingVoteCount = await fastify.prisma.vote.count({
      where: {
        userId,
        ideaId: { in: finalistIdList },
      },
    });

    if (existingVoteCount > 0) {
      return reply.status(409).send({ error: 'You have already voted in this final round' });
    }

    // Создаём голос
    const vote = await fastify.prisma.vote.create({
      data: {
        ideaId,
        userId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Отправляем WebSocket событие о новом голосе
    const io = fastify.io;
    io.to(sessionId).emit('new_vote', {
      sessionId,
      ideaId,
      userId,
    });

    return reply.status(201).send(vote);
  });

  // GET /sessions/:sessionId/finalists — получение всех финалистов с количеством голосов
  fastify.get('/:sessionId/finalists', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request.user as { sub: string }).sub;

    // Проверка существования сессии
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Проверка доступа: организатор ИЛИ участник
    if (session.organizerId !== userId) {
      const ideaCount = await fastify.prisma.idea.count({
        where: { sessionId, authorId: userId },
      });

      if (ideaCount === 0) {
        return reply.status(403).send({ error: 'No access to this session' });
      }
    }

    // Получаем все идеи-финалисты с количеством голосов
    const finalists = await fastify.prisma.idea.findMany({
      where: { sessionId, status: 'FINALIST' },
      include: {
        _count: {
          select: { votes: true },
        },
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        votes: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: {
        votes: {
          _count: 'desc',
        },
      },
    });

    const finalistsWithVoteCount = finalists.map((idea) => ({
      id: idea.id,
      sessionId: idea.sessionId,
      authorId: idea.authorId,
      title: idea.title,
      content: idea.content,
      status: idea.status,
      createdAt: idea.createdAt,
      voteCount: idea._count.votes,
      author: idea.author,
      hasVoted: idea.votes.some((v: { userId: string }) => v.userId === userId),
      votes: undefined,
      _count: undefined,
    }));

    return reply.status(200).send(finalistsWithVoteCount);
  });
};

export default votesRoutes;

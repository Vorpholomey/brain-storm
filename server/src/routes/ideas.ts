import { FastifyPluginAsync } from 'fastify';
import { createIdeaSchema, updateIdeaSchema } from '../schemas/idea.schema';

const ideasRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /sessions/:sessionId/ideas — получение всех идей сессии с количеством голосов
  fastify.get('/:sessionId/ideas', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request.user as { sub: string }).sub;

    // Проверка существования сессии
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Проверка доступа: организатор ИЛИ участник (автор хотя бы одной идеи)
    if (session.organizerId !== userId) {
      const ideaCount = await fastify.prisma.idea.count({
        where: { sessionId, authorId: userId },
      });

      if (ideaCount === 0) {
        return reply.status(403).send({ error: 'No access to this session' });
      }
    }

    // Получаем идеи с количеством голосов
    const ideas = await fastify.prisma.idea.findMany({
      where: { sessionId },
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
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const ideasWithVoteCount = ideas.map((idea) => ({
      ...idea,
      voteCount: idea._count.votes,
      _count: undefined,
    }));

    return reply.status(200).send(ideasWithVoteCount);
  });

  // POST /sessions/:sessionId/ideas — создание новой идеи
  fastify.post('/:sessionId/ideas', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const userId = (request.user as { sub: string }).sub;
    const body = createIdeaSchema.parse(request.body);

    // Проверка существования сессии и этапа
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Идеи можно создавать только на этапе DISCUSSION
    if (session.currentStage !== 'DISCUSSION') {
      return reply.status(400).send({ error: 'Ideas can only be created during DISCUSSION stage' });
    }

    const idea = await fastify.prisma.idea.create({
      data: {
        sessionId,
        authorId: userId,
        title: body.title,
        content: body.content,
        status: 'DRAFT',
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    return reply.status(201).send(idea);
  });

  // PATCH /sessions/:sessionId/ideas/:ideaId — редактирование идеи
  fastify.patch('/:sessionId/ideas/:ideaId', async (request, reply) => {
    const { sessionId, ideaId } = request.params as { sessionId: string; ideaId: string };
    const userId = (request.user as { sub: string }).sub;
    const body = updateIdeaSchema.parse(request.body);

    // Получаем сессию для проверки доступа
    const session = await fastify.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return reply.status(404).send({ error: 'Session not found' });
    }

    // Получаем идею
    const idea = await fastify.prisma.idea.findUnique({
      where: { id: ideaId },
    });

    if (!idea) {
      return reply.status(404).send({ error: 'Idea not found' });
    }

    // Проверка что идея принадлежит сессии
    if (idea.sessionId !== sessionId) {
      return reply.status(404).send({ error: 'Idea not found in this session' });
    }

    // Проверка доступа: автор идеи ИЛИ организатор сессии
    if (idea.authorId !== userId && session.organizerId !== userId) {
      return reply.status(403).send({ error: 'Only the author or organizer can edit this idea' });
    }

    // Редактирование только когда идея имеет статус FINALIST (этап REFINEMENT)
    if (idea.status !== 'FINALIST') {
      return reply.status(400).send({ error: 'Ideas can only be edited when they are FINALIST status' });
    }

    const updatedIdea = await fastify.prisma.idea.update({
      where: { id: ideaId },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.content !== undefined && { content: body.content }),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
          },
        },
        _count: {
          select: { votes: true },
        },
      },
    });

    const result = {
      ...updatedIdea,
      voteCount: updatedIdea._count.votes,
      _count: undefined,
    };

    return reply.status(200).send(result);
  });
};

export default ideasRoutes;

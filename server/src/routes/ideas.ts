import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createLogger } from '@/lib/logger';
import {
  createIdea,
  updateIdea,
  selectIdea,
  addComment,
  structureFromChat,
  getIdeasForSession,
  getIdeaWithComments,
} from '@/services/ideaService';

const logger = createLogger({ module: 'ideas' });

// ========================================
// Zod схемы валидации
// ========================================

const createIdeaSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  sessionId: z.string().min(1),
});

const updateIdeaSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(5000).optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'At least one field (title or content) must be provided',
  });

const commentSchema = z.object({
  text: z.string().min(1).max(1000),
});

const structureFromChatSchema = z.object({
  sessionId: z.string().min(1),
  chatText: z.string().min(1),
});

const ideaIdSchema = z.object({
  id: z.string().min(1),
});

// ========================================
// Регистрация маршрутов
// ========================================

export async function registerIdeaRoutes(fastify: FastifyInstance) {
  await fastify.register(async (router) => {
    // Все маршруты идей требуют аутентификации
    router.addHook('onRequest', authMiddleware);

    const prefix = '/ideas';

    // POST /ideas — Создание идеи (только в стадии DISCUSSION)
    router.post(
      prefix,
      {
        preHandler: validate(createIdeaSchema, 'body'),
      },
      async (request, _reply) => {
        const userId = request.user!.userId;
        const { title, content, sessionId } = request.body as {
          title: string;
          content: string;
          sessionId: string;
        };

        const idea = await createIdea(sessionId, userId, title, content);

        logger.info({ ideaId: idea.id, userId }, 'Idea created via REST');

        return {
          id: idea.id,
          title: idea.title,
          content: idea.content,
          authorId: idea.authorId,
          author: idea.author,
          sessionId: idea.sessionId,
          status: idea.status,
          selectedAt: idea.selectedAt?.toISOString() ?? null,
          createdAt: idea.createdAt.toISOString(),
          updatedAt: idea.updatedAt.toISOString(),
        };
      }
    );

    // GET /ideas?sessionId=... — Список идей сессии
    router.get(`${prefix}`, async (request) => {
      const { sessionId } = request.query as { sessionId?: string };

      if (!sessionId) {
        const error = new Error('sessionId query parameter is required') as Error & {
          code?: string;
          statusCode?: number;
        };
        error.code = 'VALIDATION_ERROR';
        error.statusCode = 400;
        throw error;
      }

      const ideas = await getIdeasForSession(sessionId);

      return ideas.map((idea: any) => ({
        id: idea.id,
        title: idea.title,
        content: idea.content,
        authorId: idea.authorId,
        author: idea.author,
        sessionId: idea.sessionId,
        status: idea.status,
        selectedAt: idea.selectedAt?.toISOString() ?? null,
        createdAt: idea.createdAt.toISOString(),
        updatedAt: idea.updatedAt.toISOString(),
        votes: idea.votes.map((v: any) => ({
          id: v.id,
          userId: v.userId,
          user: v.user,
          createdAt: v.createdAt.toISOString(),
        })),
        comments: idea.comments.map((c: any) => ({
          id: c.id,
          text: c.text,
          userId: c.userId,
          user: c.user,
          createdAt: c.createdAt.toISOString(),
        })),
      }));
    });

    // GET /ideas/:id — Детали идеи с комментариями
    router.get(
      `${prefix}/:id`,
      {
        preHandler: validate(ideaIdSchema, 'params'),
      },
      async (request) => {
        const { id } = request.params as { id: string };

        const idea = await getIdeaWithComments(id);

        return {
          id: idea.id,
          title: idea.title,
          content: idea.content,
          authorId: idea.authorId,
          author: idea.author,
          sessionId: idea.sessionId,
          status: idea.status,
          selectedAt: idea.selectedAt?.toISOString() ?? null,
          createdAt: idea.createdAt.toISOString(),
          updatedAt: idea.updatedAt.toISOString(),
          comments: idea.comments.map((c: any) => ({
            id: c.id,
            text: c.text,
            userId: c.userId,
            user: c.user,
            createdAt: c.createdAt.toISOString(),
          })),
        };
      }
    );

    // PATCH /ideas/:id — Обновление идеи (только автор или организатор, в стадии REFINEMENT)
    router.patch(
      `${prefix}/:id`,
      {
        preHandler: [
          validate(ideaIdSchema, 'params'),
          validate(updateIdeaSchema, 'body'),
        ],
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };
        const { title, content } = request.body as {
          title?: string;
          content?: string;
        };

        const idea = await updateIdea(id, userId, { title, content });

        logger.info({ ideaId: id, userId }, 'Idea updated via REST');

        return {
          id: idea.id,
          title: idea.title,
          content: idea.content,
          authorId: idea.authorId,
          author: idea.author,
          sessionId: idea.sessionId,
          status: idea.status,
          selectedAt: idea.selectedAt?.toISOString() ?? null,
          createdAt: idea.createdAt.toISOString(),
          updatedAt: idea.updatedAt.toISOString(),
        };
      }
    );

    // POST /ideas/:id/select — Выбор идеи (только владелец сессии, режим PERSONAL)
    router.post(
      `${prefix}/:id/select`,
      {
        preHandler: validate(ideaIdSchema, 'params'),
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };

        const idea = await selectIdea(id, userId);

        logger.info({ ideaId: id, userId }, 'Idea selected via REST');

        return {
          id: idea.id,
          title: idea.title,
          content: idea.content,
          authorId: idea.authorId,
          author: idea.author,
          sessionId: idea.sessionId,
          status: idea.status,
          selectedAt: idea.selectedAt?.toISOString() ?? null,
          createdAt: idea.createdAt.toISOString(),
          updatedAt: idea.updatedAt.toISOString(),
        };
      }
    );

    // POST /ideas/:id/comments — Добавление комментария к идее
    router.post(
      `${prefix}/:id/comments`,
      {
        preHandler: [
          validate(ideaIdSchema, 'params'),
          validate(commentSchema, 'body'),
        ],
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };
        const { text } = request.body as { text: string };

        const comment = await addComment(id, userId, text);

        logger.info({ commentId: comment.id, ideaId: id, userId }, 'Comment added via REST');

        return {
          id: comment.id,
          text: comment.text,
          userId: comment.userId,
          user: comment.user,
          ideaId: comment.ideaId,
          createdAt: comment.createdAt.toISOString(),
        };
      }
    );

    // POST /ideas/from-chat — Структурирование идеи из текста чата через LLM
    router.post(
      `${prefix}/from-chat`,
      {
        preHandler: validate(structureFromChatSchema, 'body'),
      },
      async (request) => {
        const { chatText } = request.body as { sessionId: string; chatText: string };

        const result = await structureFromChat(chatText);

        logger.info({ chatTextLength: chatText.length }, 'Idea structured from chat via REST');

        return result;
      }
    );
  });
}

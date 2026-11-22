import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import { createLogger } from '@/lib/logger';
import {
  createSession,
  getSessionsForUser,
  getSessionWithMembership,
  joinSession,
  startSession,
} from '@/services/sessionService';
import { advanceStage } from '@/services/stageMachine';

const logger = createLogger({ module: 'sessions' });

const createSessionSchema = z.object({
  topic: z.string().min(1).max(200),
  mode: z.enum(['QUICK', 'TEAM', 'ASYNC', 'PERSONAL']),
  config: z.object({
    voteLimit: z.number().int().min(1).max(10),
    finalistsCount: z.number().int().min(1).max(10),
    discussionDurationMin: z.number().int().positive(),
    votingDurationMin: z.number().int().positive(),
    refinementDurationMin: z.number().int().positive(),
  }),
});

const sessionIdSchema = z.object({
  id: z.string().min(1),
});

const advanceStageBodySchema = z
  .object({
    targetStage: z
      .enum(['DISCUSSION', 'VOTING_ROUND_1', 'REFINEMENT', 'FINAL_VOTE', 'COMPLETED'])
      .optional(),
  })
  .optional();

export async function registerSessionRoutes(fastify: FastifyInstance) {
  await fastify.register(async (router) => {
    // Все маршруты сессий требуют аутентификации
    router.addHook('onRequest', authMiddleware);

    const sessionPrefix = '/sessions';

    // POST /sessions — Создание сессии
    router.post(
      sessionPrefix,
      {
        preHandler: validate(createSessionSchema, 'body'),
      },
      async (request, _reply) => {
        const userId = request.user!.userId;
        const { topic, mode, config } = request.body as {
          topic: string;
          mode: string;
          config: Record<string, unknown>;
        };

        const session = await createSession(userId, topic, mode as any, config as any);

        logger.info({ sessionId: session.id, userId }, 'Session created via REST');

        return {
          id: session.id,
          organizerId: session.organizerId,
          topic: session.topic,
          mode: session.mode,
          config: session.config,
          currentStage: session.currentStage,
          stageDeadline: session.stageDeadline?.toISOString() ?? null,
          status: session.status,
          createdAt: session.createdAt.toISOString(),
        };
      }
    );

    // GET /sessions — Список сессий пользователя
    router.get(sessionPrefix, async (request) => {
      const userId = request.user!.userId;

      const sessions = await getSessionsForUser(userId);

      return sessions;
    });

    // GET /sessions/:id — Детали сессии
    router.get(
      `${sessionPrefix}/:id`,
      {
        preHandler: validate(sessionIdSchema, 'params'),
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };

        const result = await getSessionWithMembership(id, userId);

        if (!result) {
          const error = new Error('Session not found or you are not a member') as Error & {
            code?: string;
            statusCode?: number;
          };
          error.code = 'NOT_FOUND';
          error.statusCode = 404;
          throw error;
        }

        return {
          session: {
            id: result.session.id,
            organizerId: result.session.organizerId,
            topic: result.session.topic,
            mode: result.session.mode,
            config: result.session.config,
            currentStage: result.session.currentStage,
            stageDeadline: result.session.stageDeadline?.toISOString() ?? null,
            status: result.session.status,
            createdAt: result.session.createdAt.toISOString(),
            updatedAt: result.session.updatedAt.toISOString(),
          },
          memberRole: result.memberRole,
          joinedAt: result.joinedAt,
          ideas: result.ideas.map((idea: any) => ({
            id: idea.id,
            title: idea.title,
            content: idea.content,
            status: idea.status,
            authorId: idea.authorId,
            author: idea.author,
            createdAt: idea.createdAt.toISOString(),
            votes: idea.votes.map((v: any) => ({
              id: v.id,
              userId: v.userId,
              user: v.user,
              createdAt: v.createdAt.toISOString(),
            })),
          })),
          members: result.members.map((m: any) => ({
            id: m.id,
            userId: m.userId,
            user: m.user,
            role: m.role,
            joinedAt: m.joinedAt.toISOString(),
          })),
        };
      }
    );

    // GET /sessions/:id/state — Лёгкое состояние сессии (совместимо с WebSocket-пейлоадом)
    router.get(
      `${sessionPrefix}/:id/state`,
      {
        preHandler: validate(sessionIdSchema, 'params'),
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };

        const result = await getSessionWithMembership(id, userId);

        if (!result) {
          const error = new Error('Session not found or you are not a member') as Error & {
            code?: string;
            statusCode?: number;
          };
          error.code = 'NOT_FOUND';
          error.statusCode = 404;
          throw error;
        }

        return {
          id: result.session.id,
          currentStage: result.session.currentStage,
          stageDeadline: result.session.stageDeadline?.toISOString() ?? null,
          status: result.session.status,
          ideas: result.ideas.map((idea: any) => ({
            id: idea.id,
            sessionId: idea.sessionId,
            authorId: idea.authorId,
            author: idea.author
              ? { id: idea.author.id, email: idea.author.email }
              : undefined,
            title: idea.title,
            content: idea.content,
            status: idea.status,
            createdAt: idea.createdAt.toISOString(),
            votes: idea.votes.map((v: any) => ({
              id: v.id,
              ideaId: v.ideaId,
              userId: v.userId,
              user: v.user ? { id: v.user.id, email: v.user.email } : undefined,
              createdAt: v.createdAt.toISOString(),
            })),
          })),
          members: result.members.map((m: any) => ({
            id: m.id,
            sessionId: m.sessionId,
            userId: m.userId,
            user: { id: m.user.id, email: m.user.email },
            role: m.role,
            joinedAt: m.joinedAt.toISOString(),
          })),
          onlineUsers: [] as string[],
        };
      }
    );

    // POST /sessions/:id/join — Присоединиться к сессии
    router.post(
      `${sessionPrefix}/:id/join`,
      {
        preHandler: validate(sessionIdSchema, 'params'),
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };

        const member = await joinSession(id, userId);

        return {
          id: member.id,
          sessionId: member.sessionId,
          userId: member.userId,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
        };
      }
    );

    // POST /sessions/:id/start — Запустить сессию (только организатор)
    router.post(
      `${sessionPrefix}/:id/start`,
      {
        preHandler: validate(sessionIdSchema, 'params'),
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };

        const session = await startSession(id, userId);

        return {
          id: session.id,
          currentStage: session.currentStage,
          stageDeadline: session.stageDeadline?.toISOString() ?? null,
          updatedAt: session.updatedAt.toISOString(),
        };
      }
    );

    // POST /sessions/:id/advance — Перейти к следующему этапу (только организатор)
    router.post(
      `${sessionPrefix}/:id/advance`,
      {
        preHandler: [
          validate(sessionIdSchema, 'params'),
          validate(advanceStageBodySchema, 'body'),
        ],
      },
      async (request) => {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };
        const body = request.body as { targetStage?: string };

        const result = await advanceStage(id, userId, body?.targetStage);

        return {
          currentStage: result.currentStage,
          stageDeadline: result.stageDeadline?.toISOString() ?? null,
        };
      }
    );
  });
}

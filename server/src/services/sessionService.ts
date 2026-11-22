import prisma from '@/db/client';
import { AppError } from '@/middleware/errorHandler';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'sessionService' });

export interface SessionConfig {
  voteLimit: number;
  finalistsCount: number;
  discussionDurationMin: number;
  votingDurationMin: number;
  refinementDurationMin: number;
}

export type SessionMode = 'QUICK' | 'TEAM' | 'ASYNC' | 'PERSONAL';

const VALID_MODES: SessionMode[] = ['QUICK', 'TEAM', 'ASYNC', 'PERSONAL'];

function validateConfig(config: SessionConfig) {
  if (config.voteLimit < 1 || config.voteLimit > 10) {
    throw new AppError('voteLimit must be between 1 and 10', 'VALIDATION_ERROR', 400);
  }
  if (config.finalistsCount < 1 || config.finalistsCount > 10) {
    throw new AppError('finalistsCount must be between 1 and 10', 'VALIDATION_ERROR', 400);
  }
  if (
    config.discussionDurationMin <= 0 ||
    config.votingDurationMin <= 0 ||
    config.refinementDurationMin <= 0
  ) {
    throw new AppError(
      'All stage durations must be positive',
      'VALIDATION_ERROR',
      400
    );
  }
}

export async function createSession(
  organizerId: string,
  topic: string,
  mode: SessionMode,
  config: SessionConfig
) {
  if (!VALID_MODES.includes(mode)) {
    throw new AppError(`Invalid session mode: ${mode}`, 'VALIDATION_ERROR', 400);
  }

  validateConfig(config);

  const session = await prisma.session.create({
    data: {
      organizerId,
      topic,
      mode,
      config: config as any,
    },
  });

  // Добавляем организатора как участника с ролью ORGANIZER
  await prisma.sessionMember.create({
    data: {
      sessionId: session.id,
      userId: organizerId,
      role: 'ORGANIZER',
    },
  });

  logger.info({ sessionId: session.id, organizerId }, 'Session created');

  return session;
}

export async function getSessionsForUser(userId: string) {
  const members = await prisma.sessionMember.findMany({
    where: { userId },
    include: { session: true },
  });

  return members.map((m) => ({
    ...m.session,
    memberRole: m.role,
    joinedAt: m.joinedAt.toISOString(),
  }));
}

interface SessionWithMembership {
  session: any;
  memberRole: string;
  joinedAt: string;
  ideas: any[];
  votes: any[];
  members: any[];
}

export async function getSessionWithMembership(
  sessionId: string,
  userId: string
): Promise<SessionWithMembership | null> {
  const member = await prisma.sessionMember.findUnique({
    where: {
      sessionId_userId: { sessionId, userId },
    },
    include: {
      session: {
        include: {
          ideas: {
            include: {
              author: { select: { id: true, email: true } },
              votes: { include: { user: { select: { id: true, email: true } } } },
            },
          },
          members: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
      },
    },
  });

  if (!member) {
    return null;
  }

  return {
    session: member.session,
    memberRole: member.role,
    joinedAt: member.joinedAt.toISOString(),
    ideas: member.session.ideas,
    votes: member.session.ideas.flatMap((idea: any) => idea.votes),
    members: member.session.members,
  };
}

export async function joinSession(sessionId: string, userId: string) {
  // Проверяем, не является ли пользователь уже участником
  const existing = await prisma.sessionMember.findUnique({
    where: {
      sessionId_userId: { sessionId, userId },
    },
  });

  if (existing) {
    logger.info({ sessionId, userId }, 'User already a member');
    return existing;
  }

  // Проверяем, что сессия существует
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Session not found', 'NOT_FOUND', 404);
  }

  const member = await prisma.sessionMember.create({
    data: {
      sessionId,
      userId,
      role: 'PARTICIPANT',
    },
  });

  logger.info({ sessionId, userId }, 'User joined session');

  return member;
}

export async function startSession(sessionId: string, userId: string) {
  const member = await prisma.sessionMember.findUnique({
    where: {
      sessionId_userId: { sessionId, userId },
    },
    include: { session: true },
  });

  if (!member) {
    throw new AppError('Not a member of this session', 'FORBIDDEN', 403);
  }

  if (member.role !== 'ORGANIZER') {
    throw new AppError('Only the organizer can start the session', 'FORBIDDEN', 403);
  }

  const session = member.session;
  const config = session.config as unknown as SessionConfig;

  // Вычисляем deadline для первого этапа (DISCUSSION)
  const stageDeadline = new Date(Date.now() + config.discussionDurationMin * 60 * 1000);

  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      currentStage: 'DISCUSSION',
      stageDeadline,
    },
  });

  logger.info({ sessionId, userId }, 'Session started by organizer');

  return updated;
}

import prisma from '@/db/client';
import { AppError } from '@/middleware/errorHandler';
import { createLogger } from '@/lib/logger';
import { broadcastToRoom } from '@/ws/rooms';

const logger = createLogger({ module: 'stageMachine' });

const STAGE_ORDER: string[] = [
  'DISCUSSION',
  'VOTING_ROUND_1',
  'REFINEMENT',
  'FINAL_VOTE',
  'COMPLETED',
];

interface SessionConfig {
  voteLimit: number;
  finalistsCount: number;
  discussionDurationMin: number;
  votingDurationMin: number;
  refinementDurationMin: number;
  perStageDeadlines?: {
    voting?: string;
    refinement?: string;
    final?: string;
  };
}

interface AdvanceResult {
  currentStage: string;
  stageDeadline: Date | null;
}

function getNextStage(currentStage: string): string | null {
  const idx = STAGE_ORDER.indexOf(currentStage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[idx + 1];
}

function calculateDeadline(config: SessionConfig, targetStage: string, sessionMode: string): Date {
  // ASYNC режим: абсолютные дедлайны из perStageDeadlines
  if (sessionMode === 'ASYNC' && config.perStageDeadlines) {
    if (targetStage === 'VOTING_ROUND_1' && config.perStageDeadlines.voting) {
      return new Date(config.perStageDeadlines.voting);
    }
    if (targetStage === 'REFINEMENT' && config.perStageDeadlines.refinement) {
      return new Date(config.perStageDeadlines.refinement);
    }
    if (targetStage === 'FINAL_VOTE' && config.perStageDeadlines.final) {
      return new Date(config.perStageDeadlines.final);
    }
  }

  // Синхронные режимы: длительность от текущего момента
  const now = Date.now();
  switch (targetStage) {
    case 'VOTING_ROUND_1':
      return new Date(now + config.votingDurationMin * 60 * 1000);
    case 'REFINEMENT':
      return new Date(now + config.refinementDurationMin * 60 * 1000);
    case 'FINAL_VOTE':
      return new Date(now + config.votingDurationMin * 60 * 1000);
    default:
      return new Date(now + 30 * 60 * 1000);
  }
}

async function checkOrganizer(sessionId: string, userId: string): Promise<void> {
  const member = await prisma.sessionMember.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (member?.role !== 'ORGANIZER') {
    throw new AppError('Only the organizer can advance the stage', 'FORBIDDEN', 403);
  }
}

async function broadcastStageChanged(
  sessionId: string,
  currentStage: string,
  stageDeadline: Date | null
): Promise<void> {
  try {
    broadcastToRoom(sessionId, {
      type: 'stage_changed',
      currentStage,
      stageDeadline: stageDeadline?.toISOString() ?? null,
    });
  } catch (error) {
    logger.warn({ sessionId, err: error }, 'Failed to broadcast stage_changed');
  }
}

export async function advanceStage(
  sessionId: string,
  userId: string,
  targetStage?: string
): Promise<AdvanceResult> {
  // 1. Загружаем сессию
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Session not found', 'NOT_FOUND', 404);
  }

  // 2. Проверяем, что сессия активна
  if (session.status !== 'ACTIVE') {
    throw new AppError('Session is not active', 'INVALID_STAGE_TRANSITION', 400);
  }

  // 3. Проверяем права организатора
  await checkOrganizer(sessionId, userId);

  const config = session.config as unknown as SessionConfig;
  const currentStage = session.currentStage;

  // 4. Определяем целевой этап
  const nextAllowed = getNextStage(currentStage);
  if (!nextAllowed) {
    throw new AppError('No further stage to advance to', 'INVALID_STAGE_TRANSITION', 400);
  }

  const resolvedTarget = targetStage ?? nextAllowed;

  // 5. Проверяем допустимость перехода (только следующий шаг вперёд)
  if (resolvedTarget !== nextAllowed) {
    throw new AppError(
      `Invalid stage transition: can only advance from ${currentStage} to ${nextAllowed}`,
      'INVALID_STAGE_TRANSITION',
      400
    );
  }

  // 6. Бизнес-логика перехода
  let stageDeadline: Date | null = null;
  const mode = session.mode as string;

  if (resolvedTarget === 'VOTING_ROUND_1') {
    // DISCUSSION → VOTING_ROUND_1
    stageDeadline = calculateDeadline(config, 'VOTING_ROUND_1', mode);
  } else if (resolvedTarget === 'REFINEMENT') {
    // VOTING_ROUND_1 → REFINEMENT: выбираем топ-N финалистов
    const finalistsCount = config.finalistsCount ?? 3;

    // Подсчёт голосов по каждой идее
    const voteCounts = await prisma.vote.groupBy({
      by: ['ideaId'],
      where: { sessionId },
      _count: { ideaId: true },
      orderBy: { _count: { ideaId: 'desc' } },
      take: finalistsCount,
    });

    const finalistIdeaIds = voteCounts.map((v) => v.ideaId);

    if (finalistIdeaIds.length > 0) {
      await prisma.idea.updateMany({
        where: { sessionId, id: { in: finalistIdeaIds } },
        data: { status: 'FINALIST' },
      });
    }

    stageDeadline = calculateDeadline(config, 'REFINEMENT', mode);
  } else if (resolvedTarget === 'FINAL_VOTE') {
    // REFINEMENT → FINAL_VOTE
    stageDeadline = calculateDeadline(config, 'FINAL_VOTE', mode);
  } else if (resolvedTarget === 'COMPLETED') {
    // FINAL_VOTE → COMPLETED: выбираем победителя среди финалистов
    const voteCounts = await prisma.vote.groupBy({
      by: ['ideaId'],
      where: { sessionId },
      _count: { ideaId: true },
      orderBy: { _count: { ideaId: 'desc' } },
    });

    // Получаем идеи-финалисты
    const finalistIdeas = await prisma.idea.findMany({
      where: { sessionId, status: 'FINALIST' },
      select: { id: true },
    });
    const finalistIds = new Set(finalistIdeas.map((i) => i.id));

    let selectedIdeaId: string | null = null;

    if (finalistIds.size > 0) {
      // Ищем финалиста с максимальным числом голосов
      for (const v of voteCounts) {
        if (finalistIds.has(v.ideaId)) {
          selectedIdeaId = v.ideaId;
          break;
        }
      }

      // Если среди финалистов нет голосов, берем первого финалиста
      if (!selectedIdeaId) {
        selectedIdeaId = Array.from(finalistIds)[0];
      }
    }

    // Обновляем победителя
    if (selectedIdeaId) {
      await prisma.idea.update({
        where: { id: selectedIdeaId },
        data: { status: 'SELECTED', isSelected: true },
      });
    }

    // Обновляем сессию — завершена
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        currentStage: 'COMPLETED',
        status: 'COMPLETED',
        stageDeadline: null,
        selectedIdeaId: selectedIdeaId,
      },
    });

    await broadcastStageChanged(sessionId, 'COMPLETED', null);

    logger.info(
      { sessionId, selectedIdeaId },
      'Session completed — winner selected'
    );

    return { currentStage: 'COMPLETED', stageDeadline: null };
  }

  // Обновляем сессию
  const updated = await prisma.session.update({
    where: { id: sessionId },
    data: {
      currentStage: resolvedTarget as any,
      stageDeadline,
    },
  });

  const result = {
    currentStage: updated.currentStage,
    stageDeadline: updated.stageDeadline,
  };

  // Broadcast (fire-and-forget через Promise.resolve для не-блокирующей отправки)
  await broadcastStageChanged(
    sessionId,
    result.currentStage,
    result.stageDeadline
  );

  logger.info(
    { sessionId, from: currentStage, to: resolvedTarget, stageDeadline },
    'Stage advanced'
  );

  return result;
}

export async function checkAndAdvanceExpiredStages(): Promise<void> {
  try {
    const now = new Date();
    const expiredSessions = await prisma.session.findMany({
      where: {
        status: 'ACTIVE',
        stageDeadline: {
          not: null,
          lt: now,
        },
      },
      select: {
        id: true,
        organizerId: true,
      },
    });

    if (expiredSessions.length === 0) {
      return;
    }

    logger.info(
      { count: expiredSessions.length },
      'Processing expired stages'
    );

    await Promise.allSettled(
      expiredSessions.map(async (session) => {
        try {
          await advanceStage(session.id, session.organizerId);
        } catch (error) {
          logger.error(
            { sessionId: session.id, err: error },
            'Failed to advance expired stage'
          );
        }
      })
    );
  } catch (error) {
    logger.error({ err: error }, 'checkAndAdvanceExpiredStages failed');
  }
}

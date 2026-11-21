import { PrismaClient } from '@prisma/client';
import { SessionStage, STAGE_ORDER, DEFAULT_STAGE_DURATIONS, StageDurations } from '@brain-storm/shared';

// Получает длительности этапов из config сессии или использует дефолтные
function getStageDurations(config: unknown): StageDurations {
  const cfg = config as Record<string, unknown> | undefined;
  const stageDurations = cfg?.stageDurations as Record<string, number> | undefined;
  return {
    ...DEFAULT_STAGE_DURATIONS,
    ...stageDurations,
  };
}

export async function advanceStage(
  prisma: PrismaClient,
  sessionId: string
) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { ideas: { include: { votes: true } } },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const currentStage = session.currentStage as SessionStage;
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  if (currentIndex === -1 || currentIndex >= STAGE_ORDER.length - 1) {
    throw new Error('Invalid stage or session already completed');
  }

  const nextStage = STAGE_ORDER[currentIndex + 1];
  const durations = getStageDurations(session.config);
  let stageDeadline: Date | null = null;

  // Логика переходов
  switch (currentStage) {
    case SessionStage.DISCUSSION:
      // Переход к VOTING_ROUND_1
      // Обновляем идеи со статусом DRAFT на DISCUSSION
      await prisma.idea.updateMany({
        where: { sessionId, status: 'DRAFT' },
        data: { status: 'DISCUSSION' },
      });
      stageDeadline = new Date(Date.now() + durations.voting);
      break;

    case SessionStage.VOTING_ROUND_1:
      // Переход к REFINEMENT
      // Выбираем топ-3 идеи по количеству голосов
      const ideasWithVotes = session.ideas
        .map((idea: { id: string; votes: Array<{ id: string }> }) => ({
          id: idea.id,
          voteCount: idea.votes.length,
        }))
        .sort((a: { voteCount: number }, b: { voteCount: number }) => b.voteCount - a.voteCount);

      const top3Ids = ideasWithVotes.slice(0, 3).map((i: { id: string }) => i.id);

      // Топ-3 идеи получают статус FINALIST
      if (top3Ids.length > 0) {
        await prisma.idea.updateMany({
          where: { sessionId, id: { in: top3Ids } },
          data: { status: 'FINALIST' },
        });
      }

      // Остальные идеи сохраняют статус DISCUSSION (или текущий)
      await prisma.idea.updateMany({
        where: {
          sessionId,
          id: { notIn: top3Ids },
          OR: [
            { status: { not: 'FINALIST' } },
            { status: { not: 'SELECTED' } },
          ],
        },
        data: { status: 'DISCUSSION' },
      });

      stageDeadline = new Date(Date.now() + durations.refinement);
      break;

    case SessionStage.REFINEMENT:
      // Переход к FINAL_VOTE
      stageDeadline = new Date(Date.now() + durations.finalVote);
      break;

    case SessionStage.FINAL_VOTE:
      // Переход к COMPLETED
      // Выбираем идею с максимумом голосов
      const ideasSorted = session.ideas
        .map((idea: { id: string; votes: Array<{ id: string }> }) => ({
          id: idea.id,
          voteCount: idea.votes.length,
        }))
        .sort((a: { voteCount: number }, b: { voteCount: number }) => b.voteCount - a.voteCount);

      const winnerId = ideasSorted[0]?.id;
      let selectedIdeaId: string | null = null;

      if (winnerId) {
        selectedIdeaId = winnerId;
        await prisma.idea.update({
          where: { id: winnerId },
          data: { status: 'SELECTED' },
        });
      }

      // Сохраняем selectedIdeaId в сессию
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          currentStage: nextStage,
          stageDeadline: null,
          selectedIdeaId,
        },
      });

      return {
        session: { ...session, currentStage: nextStage, selectedIdeaId },
        stageDeadline: null,
      };
  }

  // Обновляем сессию для остальных случаев
  const updatedSession = await prisma.session.update({
    where: { id: sessionId },
    data: {
      currentStage: nextStage,
      stageDeadline,
    },
    include: { ideas: { include: { votes: true } } },
  });

  return { session: updatedSession, stageDeadline };
}

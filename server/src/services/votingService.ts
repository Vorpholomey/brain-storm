import prisma from '@/db/client';

export interface VotingError {
  code: string;
  message: string;
}

const VOTING_STAGES = ['VOTING_ROUND_1', 'FINAL_VOTE'] as const;

export async function castVote(
  sessionId: string,
  ideaId: string,
  userId: string
): Promise<number> {
  // 1. Валидация идеи: проверка принадлежности идее сессии
  const idea = await prisma.idea.findFirst({
    where: { id: ideaId, sessionId },
  });
  if (!idea) {
    throw { code: 'IDEA_NOT_FOUND', message: 'Idea not found in this session' } as VotingError;
  }

  // 2. Проверка членства в сессии
  const member = await prisma.sessionMember.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (!member) {
    throw { code: 'NOT_A_MEMBER', message: 'You are not a member of this session' } as VotingError;
  }

  // 3. Проверка этапа сессии
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw { code: 'SESSION_NOT_FOUND', message: 'Session not found' } as VotingError;
  }

  if (!VOTING_STAGES.includes(session.currentStage as any)) {
    throw {
      code: 'VOTING_NOT_ALLOWED',
      message: `Voting is not allowed in stage ${session.currentStage}`,
    } as VotingError;
  }

  // Определяем лимит: FINAL_VOTE = 1, иначе из config
  const voteLimit =
    session.currentStage === 'FINAL_VOTE'
      ? 1
      : (session.config as { voteLimit?: number } | null)?.voteLimit ?? 3;

  // 4. Подсчёт текущих голосов пользователя
  const currentVotes = await prisma.vote.count({
    where: { sessionId, userId },
  });
  if (currentVotes >= voteLimit) {
    throw {
      code: 'LIMIT_EXCEEDED',
      message: `Vote limit exceeded. You have used all ${voteLimit} vote(s).`,
    } as VotingError;
  }

  // 5. Проверка уникальности (уже голосовал за эту идею)
  const existingVote = await prisma.vote.findFirst({
    where: { sessionId, ideaId, userId },
  });
  if (existingVote) {
    throw {
      code: 'ALREADY_VOTED',
      message: 'You have already voted for this idea',
    } as VotingError;
  }

  // 6. Создание Vote в транзакции и возврат нового счётчика
  const [_vote, totalVotes] = await prisma.$transaction(async (tx) => {
    await tx.vote.create({
      data: { sessionId, ideaId, userId },
    });
    const count = await tx.vote.count({ where: { ideaId } });
    return [{}, count] as [{}, number];
  });

  return totalVotes;
}

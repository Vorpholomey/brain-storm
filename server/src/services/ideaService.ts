import prisma from '@/db/client';
import { AppError } from '@/middleware/errorHandler';
import { createLogger } from '@/lib/logger';
import { structureIdeaFromChat } from '@/lib/llm';

const logger = createLogger({ module: 'ideaService' });

// ========================================
// Вспомогательные функции проверки
// ========================================

async function checkSessionStage(sessionId: string, expectedStage: string): Promise<void> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    throw new AppError('Session not found', 'NOT_FOUND', 404);
  }
  if (session.currentStage !== expectedStage) {
    throw new AppError(
      `Session is not in ${expectedStage} stage (current: ${session.currentStage})`,
      'INVALID_STAGE',
      400
    );
  }
}

async function checkOrganizer(sessionId: string, userId: string): Promise<void> {
  const member = await prisma.sessionMember.findUnique({
    where: { sessionId_userId: { sessionId, userId } },
  });
  if (!member || member.role !== 'ORGANIZER') {
    throw new AppError('Only the organizer can perform this action', 'FORBIDDEN', 403);
  }
}

async function checkCanEditIdea(
  ideaId: string,
  userId: string,
  orgId?: string
): Promise<{ idea: any; session: any }> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { session: true },
  });
  if (!idea) {
    throw new AppError('Idea not found', 'NOT_FOUND', 404);
  }

  // Проверка: пользователь — автор идеи ИЛИ организатор сессии
  const isAuthor = idea.authorId === userId;
  const isOrganizer = orgId && idea.session.organizerId === orgId;

  if (!isAuthor && !isOrganizer) {
    throw new AppError(
      'Only the idea author or session organizer can edit this idea',
      'FORBIDDEN',
      403
    );
  }

  return { idea, session: idea.session };
}

// ========================================
// CRUD операции
// ========================================

export async function createIdea(
  sessionId: string,
  authorId: string,
  title: string,
  content: string
) {
  // Проверяем стадию сессии
  await checkSessionStage(sessionId, 'DISCUSSION');

  const idea = await prisma.idea.create({
    data: {
      sessionId,
      authorId,
      title,
      content,
      status: 'DISCUSSION',
    },
    include: {
      author: { select: { id: true, email: true } },
    },
  });

  logger.info({ ideaId: idea.id, sessionId, authorId }, 'Idea created');

  return idea;
}

export async function updateIdea(
  id: string,
  userId: string,
  data: { title?: string; content?: string }
) {
  // Проверяем права и загружаем идею
  const { idea, session } = await checkEditIdeaWithStage(id, userId);

  // Проверяем стадию сессии — только REFINEMENT
  if (session.currentStage !== 'REFINEMENT') {
    throw new AppError(
      `Ideas can only be updated during REFINEMENT stage (current: ${session.currentStage})`,
      'INVALID_STAGE',
      400
    );
  }

  const updated = await prisma.idea.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
    },
    include: {
      author: { select: { id: true, email: true } },
    },
  });

  logger.info({ ideaId: id, userId }, 'Idea updated');

  return updated;
}

async function checkEditIdeaWithStage(
  ideaId: string,
  userId: string
): Promise<{ idea: any; session: any }> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: { session: true },
  });
  if (!idea) {
    throw new AppError('Idea not found', 'NOT_FOUND', 404);
  }

  // Проверка: пользователь — автор идеи ИЛИ организатор сессии
  const isAuthor = idea.authorId === userId;
  const isOrganizer = idea.session.organizerId === userId;

  if (!isAuthor && !isOrganizer) {
    throw new AppError(
      'Only the idea author or session organizer can edit this idea',
      'FORBIDDEN',
      403
    );
  }

  return { idea, session: idea.session };
}

export async function selectIdea(id: string, orgId: string) {
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: { session: true },
  });
  if (!idea) {
    throw new AppError('Idea not found', 'NOT_FOUND', 404);
  }

  // Проверяем режим — только PERSONAL mode
  if (idea.session.mode !== 'PERSONAL') {
    throw new AppError(
      `Idea selection is only allowed in PERSONAL mode (current: ${idea.session.mode})`,
      'INVALID_MODE',
      400
    );
  }

  // Проверяем права — только организатор (владелец сессии)
  if (idea.session.organizerId !== orgId) {
    throw new AppError('Only the session owner can select an idea', 'FORBIDDEN', 403);
  }

  const updated = await prisma.idea.update({
    where: { id },
    data: {
      selectedAt: new Date(),
      selectedById: orgId,
      isSelected: true,
      status: 'SELECTED',
    },
    include: {
      author: { select: { id: true, email: true } },
    },
  });

  logger.info({ ideaId: id, orgId }, 'Idea selected by organizer');

  return updated;
}

export async function addComment(ideaId: string, authorId: string, text: string) {
  // Проверяем существование идеи
  const idea = await prisma.idea.findUnique({ where: { id: ideaId } });
  if (!idea) {
    throw new AppError('Idea not found', 'NOT_FOUND', 404);
  }

  const comment = await prisma.comment.create({
    data: {
      ideaId,
      userId: authorId,
      text,
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  logger.info({ commentId: comment.id, ideaId, authorId }, 'Comment added');

  return comment;
}

export async function structureFromChat(chatText: string) {
  const result = await structureIdeaFromChat(chatText);

  // Финальная валидация длин (на случай если LLM вернул что-то странное)
  if (result.title.length < 1) {
    throw new AppError('Generated title is empty', 'LLM_VALIDATION_ERROR', 500);
  }
  if (result.content.length < 1) {
    throw new AppError('Generated content is empty', 'LLM_VALIDATION_ERROR', 500);
  }

  return { title: result.title, content: result.content };
}

export async function getIdeaWithComments(id: string) {
  const idea = await prisma.idea.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, email: true } },
      comments: {
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!idea) {
    throw new AppError('Idea not found', 'NOT_FOUND', 404);
  }

  return idea;
}

export async function getIdeasForSession(sessionId: string) {
  const ideas = await prisma.idea.findMany({
    where: { sessionId },
    include: {
      author: { select: { id: true, email: true } },
      comments: {
        include: { user: { select: { id: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      },
      votes: {
        include: { user: { select: { id: true, email: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ideas;
}

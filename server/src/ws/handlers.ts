import { WebSocket } from 'ws';
import prisma from '@/db/client';
import { createLogger } from '@/lib/logger';
import { joinRoom, leaveRoom, getOnlineUsers, broadcastToRoom } from './rooms';
import { castVote } from '@/services/votingService';

const logger = createLogger({ module: 'ws:handlers' });

export interface SessionSocket extends WebSocket {
  id: string;
  userId?: string;
  currentSession?: string;
}

function send(socket: WebSocket, message: unknown) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message));
  }
}

function sendError(socket: WebSocket, message: string, code: string) {
  send(socket, {
    type: 'error',
    payload: { message, code },
  });
}

async function loadSessionState(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
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
  });

  if (!session) {
    return null;
  }

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
    ideas: (session.ideas as any[]).map((idea) => ({
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
    members: (session.members as any[]).map((m) => ({
      id: m.id,
      userId: m.userId,
      user: m.user,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
  };
}

export async function handleJoinSession(
  socket: SessionSocket,
  payload: Record<string, unknown>
) {
  const sessionId = payload.sessionId as string;

  if (!sessionId) {
    sendError(socket, 'sessionId is required', 'VALIDATION_ERROR');
    return;
  }

  if (!socket.userId) {
    sendError(socket, 'Authentication required', 'UNAUTHORIZED');
    return;
  }

  // Проверяем членство в сессии
  const member = await prisma.sessionMember.findUnique({
    where: {
      sessionId_userId: { sessionId, userId: socket.userId },
    },
  });

  if (!member) {
    sendError(socket, 'You are not a member of this session', 'FORBIDDEN');
    return;
  }

  // Если уже в другой сессии — выходим
  if (socket.currentSession && socket.currentSession !== sessionId) {
    leaveRoom(socket.currentSession, socket.id);
  }

  // Входим в комнату
  joinRoom(sessionId, socket.id, socket.userId, socket);
  socket.currentSession = sessionId;

  // Загружаем текущее состояние сессии
  const state = await loadSessionState(sessionId);
  if (!state) {
    sendError(socket, 'Session not found', 'NOT_FOUND');
    leaveRoom(sessionId, socket.id);
    socket.currentSession = undefined;
    return;
  }

  // Отправляем состояние подключившемуся
  send(socket, {
    type: 'session_state',
    payload: {
      ...state,
      onlineUsers: getOnlineUsers(sessionId),
    },
  });

  // Рассылаем обновление online_users всем в комнате
  broadcastOnlineUsers(sessionId);

  logger.info({ sessionId, userId: socket.userId }, 'WebSocket: user joined session');
}

export function handleLeaveSession(
  socket: SessionSocket,
  payload: Record<string, unknown>
) {
  const sessionId = payload.sessionId as string | undefined;
  const targetSession = sessionId ?? socket.currentSession;

  if (!targetSession) {
    sendError(socket, 'No session to leave', 'BAD_REQUEST');
    return;
  }

  leaveRoom(targetSession, socket.id);
  socket.currentSession = undefined;

  send(socket, {
    type: 'left_session',
    payload: { sessionId: targetSession },
  });

  broadcastOnlineUsers(targetSession);

  logger.info({ sessionId: targetSession, userId: socket.userId }, 'WebSocket: user left session');
}

export async function handleCreateIdea(
  socket: SessionSocket,
  payload: Record<string, unknown>
) {
  if (!socket.userId || !socket.currentSession) {
    sendError(socket, 'Must be in a session', 'FORBIDDEN');
    return;
  }

  const title = payload.title as string;
  const content = payload.content as string;

  if (!title || !content) {
    sendError(socket, 'title and content are required', 'VALIDATION_ERROR');
    return;
  }

  const idea = await prisma.idea.create({
    data: {
      sessionId: socket.currentSession,
      authorId: socket.userId,
      title,
      content,
      status: 'DISCUSSION',
    },
    include: {
      author: { select: { id: true, email: true } },
    },
  });

  const broadcastIdea = {
    id: idea.id,
    title: idea.title,
    content: idea.content,
    status: idea.status,
    authorId: idea.authorId,
    author: idea.author,
    createdAt: idea.createdAt.toISOString(),
    votes: [],
  };

  broadcastToRoom(socket.currentSession, {
    type: 'idea_created',
    payload: { idea: broadcastIdea },
  });

  logger.info(
    { sessionId: socket.currentSession, ideaId: idea.id, userId: socket.userId },
    'WebSocket: idea created'
  );
}

export async function handleVote(
  socket: SessionSocket,
  payload: Record<string, unknown>
) {
  if (!socket.userId || !socket.currentSession) {
    sendError(socket, 'Must be in a session', 'FORBIDDEN');
    return;
  }

  const ideaId = payload.ideaId as string;
  if (!ideaId) {
    sendError(socket, 'ideaId is required', 'VALIDATION_ERROR');
    return;
  }

  try {
    const votesCount = await castVote(socket.currentSession, ideaId, socket.userId);

    broadcastToRoom(socket.currentSession, {
      type: 'vote_updated',
      payload: { ideaId, votesCount },
    });

    logger.info(
      { sessionId: socket.currentSession, ideaId, userId: socket.userId },
      'WebSocket: vote cast'
    );
  } catch (error: any) {
    const code = error?.code ?? 'INTERNAL_ERROR';
    const message = error?.message ?? 'Vote failed';

    send(socket, {
      type: 'vote_rejected',
      payload: { code, message },
    });

    logger.warn(
      { sessionId: socket.currentSession, ideaId, userId: socket.userId, code },
      'WebSocket: vote rejected'
    );
  }
}

// === Внутренние функции ===

function broadcastOnlineUsers(sessionId: string) {
  const onlineUsers = getOnlineUsers(sessionId);
  broadcastToRoom(sessionId, {
    type: 'online_users',
    payload: { onlineUsers },
  });
}

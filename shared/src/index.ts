// Общие типы для клиента и сервера

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface CreateUserDto {
  name: string;
  email: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export enum ApiRoutes {
  USERS = '/api/users',
  HEALTH = '/api/health',
}

// ========== Модели ==========

export interface SessionConfig {
  maxParticipants?: number;
  timeLimitMinutes?: number;
  allowAnonymousVotes?: boolean;
  voteLimit?: number;
}

export interface Idea {
  id: string;
  sessionId: string;
  authorId: string;
  title: string;
  description?: string;
  status: string;
  voteCount: number;
  createdAt: string;
}

export interface Vote {
  id: string;
  ideaId: string;
  userId: string;
  createdAt: string;
}

// ========== Этапы сессии (Session Stages) ==========

export enum SessionStage {
  DISCUSSION = 'DISCUSSION',
  VOTING_ROUND_1 = 'VOTING_ROUND_1',
  REFINEMENT = 'REFINEMENT',
  FINAL_VOTE = 'FINAL_VOTE',
  COMPLETED = 'COMPLETED',
}

export const STAGE_ORDER: SessionStage[] = [
  SessionStage.DISCUSSION,
  SessionStage.VOTING_ROUND_1,
  SessionStage.REFINEMENT,
  SessionStage.FINAL_VOTE,
  SessionStage.COMPLETED,
];

export interface StageDurations {
  voting: number; // мс, по умолчанию 30 минут
  refinement: number; // мс, по умолчанию 15 минут
  finalVote: number; // мс, по умолчанию 20 минут
}

export const DEFAULT_STAGE_DURATIONS: StageDurations = {
  voting: 30 * 60 * 1000,
  refinement: 15 * 60 * 1000,
  finalVote: 20 * 60 * 1000,
};

// ========== WebSocket события ==========

export interface StageAdvancedPayload {
  sessionId: string;
  stage: SessionStage;
  stageDeadline: Date | null;
}

export interface ServerToClientEvents {
  vote_updated: (data: { ideaId: string; voteCount: number }) => void;
  vote_rejected: (reason: string) => void;
  joined: (data: { sessionId: string }) => void;
  left: (data: { sessionId: string }) => void;
  stage_advanced: (data: StageAdvancedPayload) => void;
  error: (data: { message: string }) => void;
  server_time: (data: { serverTime: number }) => void;
}

export interface ClientToServerEvents {
  cast_vote: (
    ideaId: string,
    callback: (error?: string) => void
  ) => void;
  join_session: (sessionId: string) => void;
  leave_session: () => void;
}

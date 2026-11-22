export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface SessionConfig {
  voteLimit: number;
  finalistsCount: number;
  discussionDurationMin: number;
  votingDurationMin: number;
  refinementDurationMin: number;
}

export type SessionMode = 'QUICK' | 'TEAM' | 'ASYNC' | 'PERSONAL';
export type SessionStatus = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
export type SessionStage = 'DISCUSSION' | 'VOTING_ROUND_1' | 'REFINEMENT' | 'FINAL_VOTE' | 'COMPLETED';
export type IdeaStatus = 'DRAFT' | 'DISCUSSION' | 'FINALIST' | 'SELECTED';
export type MemberRole = 'ORGANIZER' | 'PARTICIPANT';

export interface Session {
  id: string;
  organizerId: string;
  topic: string;
  mode: SessionMode;
  config: SessionConfig;
  currentStage: SessionStage;
  stageDeadline: string | null;
  selectedIdeaId: string | null;
  status: SessionStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface SessionMember {
  id: string;
  sessionId: string;
  userId: string;
  user: User;
  role: MemberRole;
  joinedAt: string;
}

export interface Idea {
  id: string;
  sessionId: string;
  authorId: string;
  author?: User;
  title: string;
  content: string;
  status: IdeaStatus;
  createdAt: string;
  votes?: Vote[];
}

export interface Vote {
  id: string;
  ideaId: string;
  userId: string;
  user?: User;
  createdAt: string;
}

export interface Comment {
  id: string;
  ideaId: string;
  userId: string;
  text: string;
  createdAt: string;
}

// === REST API Responses ===

export interface CreateSessionResponse {
  id: string;
  organizerId: string;
  topic: string;
  mode: SessionMode;
  config: SessionConfig;
  currentStage: SessionStage;
  stageDeadline: string | null;
  status: SessionStatus;
  createdAt: string;
}

export interface SessionListItem {
  id: string;
  organizerId: string;
  topic: string;
  mode: SessionMode;
  config: SessionConfig;
  currentStage: SessionStage;
  stageDeadline: string | null;
  status: SessionStatus;
  createdAt: string;
  memberRole: MemberRole;
  joinedAt: string;
}

export interface SessionDetailsResponse {
  session: Session;
  memberRole: MemberRole;
  joinedAt: string;
  ideas: Idea[];
  members: SessionMember[];
}

export interface JoinSessionResponse {
  id: string;
  sessionId: string;
  userId: string;
  role: MemberRole;
  joinedAt: string;
}

export interface StartSessionResponse {
  id: string;
  currentStage: SessionStage;
  stageDeadline: string | null;
  updatedAt: string;
}

// === WebSocket Events ===

export type WsServerMessageType =
  | 'session_state'
  | 'online_users'
  | 'idea_created'
  | 'vote_cast'
  | 'vote_updated'
  | 'vote_rejected'
  | 'left_session'
  | 'stage_changed'
  | 'error';

export type WsClientMessageType =
  | 'join_session'
  | 'leave_session'
  | 'create_idea'
  | 'vote'
  | 'cast_vote';

export interface WsMessage<T = unknown> {
  type: WsServerMessageType | WsClientMessageType;
  payload?: T;
}

export interface SessionStatePayload {
  id: string;
  organizerId: string;
  topic: string;
  mode: SessionMode;
  config: SessionConfig;
  currentStage: SessionStage;
  stageDeadline: string | null;
  status: SessionStatus;
  createdAt: string;
  selectedIdeaId: string | null;
  ideas: Idea[];
  members: SessionMember[];
  onlineUsers: string[];
}

export interface OnlineUsersPayload {
  onlineUsers: string[];
}

export interface IdeaCreatedPayload {
  idea: Idea;
}

export interface VoteCastPayload {
  vote: Vote;
}

export interface VoteUpdatedPayload {
  ideaId: string;
  votesCount: number;
}

export interface VoteRejectedPayload {
  code: string;
  message: string;
}

export interface CastVotePayload {
  ideaId: string;
}

export interface StageChangedPayload {
  currentStage: SessionStage;
  stageDeadline: string | null;
}

export interface ErrorPayload {
  message: string;
  code: string;
}

export interface AuthResponse {
  user: User;
}

export interface AppError {
  code: string;
  message: string;
}

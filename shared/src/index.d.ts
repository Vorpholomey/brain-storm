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
export declare enum ApiRoutes {
    USERS = "/api/users",
    HEALTH = "/api/health"
}
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
export interface ServerToClientEvents {
    vote_updated: (data: {
        ideaId: string;
        voteCount: number;
    }) => void;
    vote_rejected: (reason: string) => void;
    joined: (data: {
        sessionId: string;
    }) => void;
    left: (data: {
        sessionId: string;
    }) => void;
    error: (data: {
        message: string;
    }) => void;
}
export interface ClientToServerEvents {
    cast_vote: (ideaId: string, callback: (error?: string) => void) => void;
    join_session: (sessionId: string) => void;
    leave_session: () => void;
}

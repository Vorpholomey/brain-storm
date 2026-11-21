import { describe, it, expect } from 'vitest';
import {
  UserDto,
  CreateUserDto,
  UpdateUserDto,
  ApiResponse,
  ApiRoutes,
  SessionConfig,
  Idea,
  Vote,
  ServerToClientEvents,
  ClientToServerEvents,
} from '../src';

describe('Shared Types', () => {
  describe('UserDto', () => {
    it('should accept valid UserDto', () => {
      const user: UserDto = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
    });
  });

  describe('CreateUserDto', () => {
    it('should accept valid CreateUserDto', () => {
      const userData: CreateUserDto = {
        name: 'New User',
        email: 'new@example.com',
      };
      expect(userData.name).toBe('New User');
    });
  });

  describe('UpdateUserDto', () => {
    it('should accept partial updates', () => {
      const update: UpdateUserDto = {
        name: 'Updated Name',
      };
      expect(update.name).toBe('Updated Name');
      expect(update.email).toBeUndefined();
    });

    it('should accept empty object', () => {
      const update: UpdateUserDto = {};
      expect(update).toEqual({});
    });
  });

  describe('ApiResponse', () => {
    it('should accept response with data only', () => {
      const response: ApiResponse<string> = { data: 'success' };
      expect(response.data).toBe('success');
      expect(response.error).toBeUndefined();
    });

    it('should accept response with data and error', () => {
      const response: ApiResponse<null> = {
        data: null,
        error: 'Something went wrong',
      };
      expect(response.error).toBe('Something went wrong');
    });
  });

  describe('ApiRoutes', () => {
    it('should have expected route values', () => {
      expect(ApiRoutes.USERS).toBe('/api/users');
      expect(ApiRoutes.HEALTH).toBe('/api/health');
    });
  });

  describe('SessionConfig', () => {
    it('should accept config with all options', () => {
      const config: SessionConfig = {
        maxParticipants: 10,
        timeLimitMinutes: 30,
        allowAnonymousVotes: true,
        voteLimit: 5,
      };
      expect(config.maxParticipants).toBe(10);
      expect(config.voteLimit).toBe(5);
    });

    it('should accept empty config', () => {
      const config: SessionConfig = {};
      expect(config).toEqual({});
    });

    it('should accept partial config', () => {
      const config: SessionConfig = { voteLimit: 3 };
      expect(config.voteLimit).toBe(3);
    });
  });

  describe('Idea', () => {
    it('should accept valid Idea', () => {
      const idea: Idea = {
        id: 'idea-1',
        sessionId: 'session-1',
        authorId: 'user-1',
        title: 'Test Idea',
        description: 'Description',
        status: 'DRAFT',
        voteCount: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      expect(idea.title).toBe('Test Idea');
      expect(idea.voteCount).toBe(0);
    });

    it('should accept idea without description', () => {
      const idea: Idea = {
        id: 'idea-2',
        sessionId: 'session-1',
        authorId: 'user-1',
        title: 'Short Idea',
        status: 'DRAFT',
        voteCount: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      expect(idea.description).toBeUndefined();
    });
  });

  describe('Vote', () => {
    it('should accept valid Vote', () => {
      const vote: Vote = {
        id: 'vote-1',
        ideaId: 'idea-1',
        userId: 'user-1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      expect(vote.ideaId).toBe('idea-1');
    });
  });

  describe('WebSocket Event Types', () => {
    it('should define ServerToClientEvents handlers', () => {
      const handlers: ServerToClientEvents = {
        vote_updated: (data) => {
          expect(data.ideaId).toBeString();
          expect(data.voteCount).toBeNumber();
        },
        vote_rejected: (reason) => {
          expect(reason).toBeString();
        },
        joined: (data) => {
          expect(data.sessionId).toBeString();
        },
        left: (data) => {
          expect(data.sessionId).toBeString();
        },
        stage_advanced: (data) => {
          expect(data.sessionId).toBeString();
          expect(data.stage).toBeString();
        },
        error: (data) => {
          expect(data.message).toBeString();
        },
      };
      expect(handlers).toBeDefined();
    });

    it('should define ClientToServerEvents handlers', () => {
      const handlers: ClientToServerEvents = {
        cast_vote: (ideaId, callback) => {
          expect(ideaId).toBeString();
          callback();
        },
        join_session: (sessionId) => {
          expect(sessionId).toBeString();
        },
        leave_session: () => {
          // no-op
        },
      };
      expect(handlers).toBeDefined();
    });
  });
});

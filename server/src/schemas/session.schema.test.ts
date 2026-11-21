import { describe, it, expect } from 'vitest';
import { CreateSessionSchema } from '../schemas/session.schema';

describe('CreateSessionSchema', () => {
  it('should validate correct session data', () => {
    const result = CreateSessionSchema.parse({
      topic: 'Brainstorming AI',
      mode: 'QUICK',
    });
    expect(result.topic).toBe('Brainstorming AI');
    expect(result.mode).toBe('QUICK');
  });

  it('should validate with config', () => {
    const result = CreateSessionSchema.parse({
      topic: 'Test',
      mode: 'TEAM',
      config: {
        maxParticipants: 5,
        timeLimitMinutes: 20,
        voteLimit: 3,
      },
    });
    expect(result.config).toBeDefined();
    expect(result.config!.maxParticipants).toBe(5);
    expect(result.config!.voteLimit).toBe(3);
  });

  it('should reject empty topic', () => {
    expect(() =>
      CreateSessionSchema.parse({ topic: '', mode: 'QUICK' })
    ).toThrow();
  });

  it('should reject missing topic', () => {
    expect(() => CreateSessionSchema.parse({ mode: 'QUICK' })).toThrow();
  });

  it('should reject invalid mode', () => {
    expect(() =>
      CreateSessionSchema.parse({ topic: 'Test', mode: 'INVALID' })
    ).toThrow();
  });

  it('should accept all valid modes', () => {
    const modes = ['QUICK', 'TEAM', 'ASYNC', 'PERSONAL'];
    for (const mode of modes) {
      const result = CreateSessionSchema.parse({ topic: 'Test', mode });
      expect(result.mode).toBe(mode);
    }
  });

  it('should reject maxParticipants less than 1', () => {
    expect(() =>
      CreateSessionSchema.parse({
        topic: 'Test',
        mode: 'QUICK',
        config: { maxParticipants: 0 },
      })
    ).toThrow();
  });

  it('should reject maxParticipants greater than 100', () => {
    expect(() =>
      CreateSessionSchema.parse({
        topic: 'Test',
        mode: 'QUICK',
        config: { maxParticipants: 101 },
      })
    ).toThrow();
  });

  it('should reject topic longer than 500 characters', () => {
    const longTopic = 'a'.repeat(501);
    expect(() =>
      CreateSessionSchema.parse({ topic: longTopic, mode: 'QUICK' })
    ).toThrow();
  });

  it('should accept config with default voteLimit', () => {
    const result = CreateSessionSchema.parse({
      topic: 'Test',
      mode: 'QUICK',
      config: { voteLimit: 10 },
    });
    expect(result.config).toBeDefined();
    expect(result.config!.voteLimit).toBe(10);
  });
});

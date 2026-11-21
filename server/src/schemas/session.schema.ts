import { z } from 'zod';
import { SessionStage } from '@brain-storm/shared';

const SessionMode = z.enum(['QUICK', 'TEAM', 'ASYNC', 'PERSONAL']);

export const SessionStageSchema = z.nativeEnum(SessionStage);

const ConfigBase = z.object({
  maxParticipants: z.number().int().min(1).max(100).optional(),
  timeLimitMinutes: z.number().int().min(1).optional(),
  allowAnonymousVotes: z.boolean().optional(),
  voteLimit: z.number().int().min(1).default(10),
  stageDurations: z.object({
    voting: z.number().int().min(0).optional(),
    refinement: z.number().int().min(0).optional(),
    finalVote: z.number().int().min(0).optional(),
  }).optional(),
});

export const CreateSessionSchema = z.object({
  topic: z.string().min(1, 'Тема обязательна').max(500),
  mode: SessionMode,
  config: ConfigBase.optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

// Схемы для результата завершённой сессии
export const UpdateSessionResultSchema = z.object({
  nextSteps: z.array(z.string().min(1)).max(50).optional(),
  sessionSummary: z.string().max(5000).optional(),
});

export type UpdateSessionResultInput = z.infer<typeof UpdateSessionResultSchema>;

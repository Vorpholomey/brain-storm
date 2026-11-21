import { z } from 'zod';

export const createIdeaSchema = z.object({
  title: z.string().min(1, 'Заголовок обязателен').max(200),
  content: z.string().min(1, 'Содержимое обязательно').max(5000),
});

export const updateIdeaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(5000).optional(),
}).refine((data) => data.title !== undefined || data.content !== undefined, {
  message: 'Необходимо указать хотя бы одно поле для обновления',
});

export const finalVoteSchema = z.object({
  ideaId: z.string().min(1, 'ID идеи обязателен'),
});

export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;
export type FinalVoteInput = z.infer<typeof finalVoteSchema>;

import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(8, 'Минимум 8 символов').max(128),
});

export const LoginSchema = z.object({
  email: z.string().email('Некорректный email'),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

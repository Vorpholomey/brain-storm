import { FastifyRequest, FastifySchema } from 'fastify';
import { ZodType, ZodError } from 'zod';

type ValidationType = 'body' | 'params' | 'query';

export function validate(schema: ZodType, type: ValidationType) {
  return async (request: FastifyRequest) => {
    try {
      const raw = request[type as keyof FastifyRequest];
      schema.parse(raw);
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors
          .map((e) => `${e.path.join('.')}: ${e.message}`)
          .join(', ');
        const appError = new Error(messages) as Error & {
          code?: string;
          statusCode?: number;
        };
        appError.code = 'VALIDATION_ERROR';
        appError.statusCode = 400;
        throw appError;
      }
      throw error;
    }
  };
}

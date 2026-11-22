import { FastifyInstance, FastifyError } from 'fastify';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'errorHandler' });

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function registerErrorHandler(fastify: FastifyInstance) {
  fastify.setErrorHandler((error: FastifyError & { code?: string; statusCode?: number }, _request, reply) => {
    const code = error.code ?? 'INTERNAL_ERROR';
    const message = error.message ?? 'Internal server error';
    const statusCode = error.statusCode ?? 500;

    logger.error({ err: error, code, statusCode }, 'Request error');

    return reply.status(statusCode).send({
      error: { code, message },
    });
  });
}

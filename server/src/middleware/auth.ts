import { FastifyInstance, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '@/lib/jwt';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { userId: string };
  }
}

export async function authMiddleware(request: FastifyRequest) {
  const token = request.cookies?.access_token;

  if (!token) {
    const error = new Error('Access token is required') as Error & {
      code?: string;
      statusCode?: number;
    };
    error.code = 'UNAUTHORIZED';
    error.statusCode = 401;
    throw error;
  }

  try {
    const payload = verifyAccessToken(token);
    request.user = { userId: payload.userId };
  } catch {
    const error = new Error('Invalid or expired access token') as Error & {
      code?: string;
      statusCode?: number;
    };
    error.code = 'UNAUTHORIZED';
    error.statusCode = 401;
    throw error;
  }
}

export function registerAuth(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authMiddleware);
}

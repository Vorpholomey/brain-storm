import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import prisma from '@/db/client';
import { hashPassword, comparePassword } from '@/lib/password';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { validate } from '@/middleware/validate';
import { authMiddleware } from '@/middleware/auth';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'auth' });

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const isProduction = process.env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60 * 1000, // 15 минут для access_token
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней для refresh_token
};

export async function registerAuthRoutes(fastify: FastifyInstance) {
  await fastify.register(async (router) => {

    router.post(
      '/register',
      {
        preHandler: validate(registerSchema, 'body'),
      },
      async (request, reply) => {
        const { email, password } = request.body as { email: string; password: string };

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          const error = new Error('Email already registered') as Error & {
            code?: string;
            statusCode?: number;
          };
          error.code = 'CONFLICT';
          error.statusCode = 409;
          throw error;
        }

        const passwordHash = await hashPassword(password);
        const user = await prisma.user.create({
          data: { email, passwordHash },
        });

        logger.info({ userId: user.id }, 'User registered');

        const accessToken = generateAccessToken({ userId: user.id });
        const refreshToken = generateRefreshToken({ userId: user.id });

        reply.setCookie('access_token', accessToken, cookieOptions);
        reply.setCookie('refresh_token', refreshToken, refreshCookieOptions);

        return {
          user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
        };
      },
    );

    router.post(
      '/login',
      {
        preHandler: validate(loginSchema, 'body'),
      },
      async (request, reply) => {
        const { email, password } = request.body as { email: string; password: string };

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          const error = new Error('Invalid credentials') as Error & {
            code?: string;
            statusCode?: number;
          };
          error.code = 'UNAUTHORIZED';
          error.statusCode = 401;
          throw error;
        }

        const isValid = await comparePassword(password, user.passwordHash);
        if (!isValid) {
          const error = new Error('Invalid credentials') as Error & {
            code?: string;
            statusCode?: number;
          };
          error.code = 'UNAUTHORIZED';
          error.statusCode = 401;
          throw error;
        }

        logger.info({ userId: user.id }, 'User logged in');

        const accessToken = generateAccessToken({ userId: user.id });
        const refreshToken = generateRefreshToken({ userId: user.id });

        reply.setCookie('access_token', accessToken, cookieOptions);
        reply.setCookie('refresh_token', refreshToken, refreshCookieOptions);

        return {
          user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
        };
      },
    );

    router.post('/refresh', async (request, reply) => {
      const refreshTokenCookie = request.cookies?.refresh_token;

      if (!refreshTokenCookie) {
        const error = new Error('Refresh token is required') as Error & {
          code?: string;
          statusCode?: number;
        };
        error.code = 'UNAUTHORIZED';
        error.statusCode = 401;
        throw error;
      }

      const payload = verifyRefreshToken(refreshTokenCookie);

      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        const error = new Error('User not found') as Error & {
          code?: string;
          statusCode?: number;
        };
        error.code = 'UNAUTHORIZED';
        error.statusCode = 401;
        throw error;
      }

      const accessToken = generateAccessToken({ userId: user.id });
      const refreshToken = generateRefreshToken({ userId: user.id });

      reply.setCookie('access_token', accessToken, cookieOptions);
      reply.setCookie('refresh_token', refreshToken, refreshCookieOptions);

      return {
        user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
      };
    });

    router.post('/logout', async (_request, reply) => {
      reply.clearCookie('access_token', cookieOptions);
      reply.clearCookie('refresh_token', refreshCookieOptions);
      return { ok: true };
    });

    router.get('/me', { preHandler: authMiddleware }, async (request) => {
      const userId = request.user?.userId;
      if (!userId) {
        const error = new Error('Not authenticated') as Error & {
          code?: string;
          statusCode?: number;
        };
        error.code = 'UNAUTHORIZED';
        error.statusCode = 401;
        throw error;
      }

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        const error = new Error('User not found') as Error & {
          code?: string;
          statusCode?: number;
        };
        error.code = 'NOT_FOUND';
        error.statusCode = 404;
        throw error;
      }

      return {
        user: { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() },
      };
    });
  }, { prefix: '/auth' });
}

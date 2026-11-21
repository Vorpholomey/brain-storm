import { FastifyPluginAsync } from 'fastify';
import jwtPlugin from '@fastify/jwt';

const jwt: FastifyPluginAsync = async (fastify) => {
  const accessSecret = process.env.JWT_ACCESS_SECRET || 'default-access-secret';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
  const accessExpiresIn = process.env.JWT_ACCESS_EXPIRES_IN || '15m';

  fastify.register(jwtPlugin, {
    secret: accessSecret,
    sign: { expiresIn: accessExpiresIn },
  });

  // Декоратор для подписи refresh токенов отдельным секретом
  fastify.decorate('jwtRefreshSign', (payload: object) => {
    return fastify.jwt.sign(payload, { key: refreshSecret, expiresIn: '7d' });
  });
};

declare module 'fastify' {
  interface FastifyInstance {
    jwtRefreshSign(payload: object): string;
  }
}

export default jwt;

import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import jwtPlugin from '@fastify/jwt';
import authPlugin from './auth';

const authPluginNoEncapsulate = fp(authPlugin, { name: 'auth' });

describe('authPlugin', () => {
  const createServer = async () => {
    const fastify = Fastify();
    await fastify.register(jwtPlugin, {
      secret: 'test-secret-key',
    });
    await fastify.register(authPluginNoEncapsulate);
    fastify.get('/protected', async (request) => {
      return { message: 'ok' };
    });
    await fastify.ready();
    return fastify;
  };

  it('should reject request without token', async () => {
    const fastify = await createServer();
    const response = await fastify.inject({
      method: 'GET',
      url: '/protected',
    });
    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Неавторизован');
  });

  it('should reject request with invalid token', async () => {
    const fastify = await createServer();
    const response = await fastify.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer invalid.token.here',
      },
    });
    expect(response.statusCode).toBe(401);
  });

  it('should accept request with valid JWT token', async () => {
    const fastify = await createServer();
    const token = fastify.jwt.sign({ sub: 'user-123' });
    const response = await fastify.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('ok');
  });

  it('should extract user sub from token', async () => {
    const fastify = Fastify();
    await fastify.register(jwtPlugin, {
      secret: 'test-secret-key',
    });
    await fastify.register(authPluginNoEncapsulate);
    fastify.get('/me', async (request) => {
      const user = request.user as { sub: string };
      return { userId: user.sub };
    });
    await fastify.ready();
    const token = fastify.jwt.sign({ sub: 'user-456' });
    const response = await fastify.inject({
      method: 'GET',
      url: '/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.userId).toBe('user-456');
  });

  it('should reject expired token', async () => {
    const fastify = Fastify();
    await fastify.register(jwtPlugin, {
      secret: 'test-secret-key',
    });
    await fastify.register(authPluginNoEncapsulate);
    fastify.get('/protected', async () => ({ ok: true }));
    await fastify.ready();

    const token = fastify.jwt.sign({ sub: 'user', exp: Math.floor(Date.now() / 1000) - 10 });
    const response = await fastify.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(response.statusCode).toBe(401);
  });
});

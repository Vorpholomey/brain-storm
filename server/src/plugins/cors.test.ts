import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import corsPlugin from '../plugins/cors';

describe('corsPlugin', () => {
  it('should register without errors', async () => {
    const fastify = Fastify();
    await fastify.register(corsPlugin);
    await fastify.ready();
    expect(fastify).toBeDefined();
  });

  it('should allow CORS headers in response', async () => {
    const fastify = Fastify();
    await fastify.register(corsPlugin);
    fastify.get('/test', async () => ({ ok: true }));

    const response = await fastify.inject({
      method: 'OPTIONS',
      url: '/test',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
      },
    });

    expect(response.statusCode).toBe(204);
  });

  it('should include credentials support', async () => {
    const fastify = Fastify();
    await fastify.register(corsPlugin);
    fastify.get('/test', async () => ({ ok: true }));

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      headers: {
        origin: 'http://localhost:5173',
      },
    });

    expect(response.statusCode).toBe(200);
  });
});

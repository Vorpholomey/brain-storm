import Fastify from 'fastify';
import cookiePlugin from '@fastify/cookie';
import prismaPlugin from './plugins/prisma';
import jwtPlugin from './plugins/jwt';
import corsPlugin from './plugins/cors';
import socketIOPlugin from './plugins/socket.io';
import authPlugin from './plugins/auth';
import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import ideasRoutes from './routes/ideas';
import votesRoutes from './routes/votes';

const fastify = Fastify({ logger: true });

(async () => {
  try {
    // Базовые плагины
    await fastify.register(corsPlugin);
    await fastify.register(cookiePlugin);
    await fastify.register(prismaPlugin);
    await fastify.register(jwtPlugin);

    // Socket.IO (до роутов, чтобы io был доступен)
    await fastify.register(socketIOPlugin);

    // Публичные роуты (без auth middleware)
    await fastify.register(authRoutes, { prefix: '/auth' });

    // Health check
    fastify.get('/health', async () => ({ status: 'ok' }));

    // Защищённые роуты (требуют JWT)
    await fastify.register(authPlugin);
    await fastify.register(sessionRoutes, { prefix: '/sessions' });
    await fastify.register(ideasRoutes, { prefix: '/sessions' });
    await fastify.register(votesRoutes, { prefix: '/sessions' });

    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    fastify.log.info('Сервер запущен на порту 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
})();

import Fastify from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import { registerErrorHandler } from '@/middleware/errorHandler';
import { registerAuthRoutes } from '@/routes/auth';
import { registerSessionRoutes } from '@/routes/sessions';
import { registerIdeaRoutes } from '@/routes/ideas';
import { registerWebSocket } from '@/ws/socket';
import { checkAndAdvanceExpiredStages } from '@/services/stageMachine';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ module: 'server' });

async function bootstrap() {
  const fastify = Fastify({
    logger: false,
  });

  await fastify.register(fastifyCors, {
    origin: /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
    credentials: true,
  });
  await fastify.register(fastifyCookie);

  registerErrorHandler(fastify);

  // REST маршруты
  await registerAuthRoutes(fastify);
  await registerSessionRoutes(fastify);
  await registerIdeaRoutes(fastify);

  // WebSocket
  await registerWebSocket(fastify);

  const port = Number(process.env.PORT) ?? 3000;

  try {
    await fastify.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, 'Server started');
  } catch (error) {
    logger.fatal({ err: error }, 'Server failed to start');
    process.exit(1);
  }

  // Таймер автоматического перехода по истечении дедлайна (каждые 30 сек)
  const stageTimer = setInterval(() => {
    checkAndAdvanceExpiredStages().catch((error) => {
      logger.error({ err: error }, 'Stage timer error');
    });
  }, 30_000);

  // Предотвращаем утечку памяти при graceful shutdown
  process.on('SIGTERM', () => {
    clearInterval(stageTimer);
  });
  process.on('SIGINT', () => {
    clearInterval(stageTimer);
  });
}

bootstrap();

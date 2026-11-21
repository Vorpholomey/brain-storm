import { PrismaClient } from '@prisma/client';
import { Server as IOServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    jwtRefreshSign(payload: object): string;
    io: IOServer;
  }

  interface FastifyRequest {
    user: {
      sub: string;
    };
  }
}

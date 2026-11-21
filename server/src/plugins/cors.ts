import { FastifyPluginAsync } from 'fastify';
import cors from '@fastify/cors';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(cors, {
    origin: true,
    credentials: true,
  });
};

export default corsPlugin;

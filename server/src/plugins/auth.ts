import { FastifyPluginAsync } from 'fastify';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ error: 'Неавторизован' });
    }
  });
};

export default authPlugin;

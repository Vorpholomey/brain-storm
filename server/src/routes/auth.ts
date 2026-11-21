import { FastifyPluginAsync } from 'fastify';
import { RegisterSchema, LoginSchema } from '../schemas/auth.schema';
import { hashPassword, comparePassword } from '../utils/password';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST / — регистрация
  fastify.post('/', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);

    // Проверяем, занят ли email
    const existingUser = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      reply.code(409).send({ error: 'Email уже занят' });
      return;
    }

    // Хешируем пароль и создаём пользователя
    const passwordHash = await hashPassword(body.password);
    const user = await fastify.prisma.user.create({
      data: {
        email: body.email,
        passwordHash,
      },
    });

    // Генерируем access токен
    const accessToken = fastify.jwt.sign({ sub: user.id });

    reply.code(201).send({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  });

  // POST /login — авторизация
  fastify.post('/login', async (request, reply) => {
    const body = LoginSchema.parse(request.body);

    // Ищем пользователя по email
    const user = await fastify.prisma.user.findUnique({
      where: { email: body.email },
    });

    if (!user) {
      reply.code(401).send({ error: 'Неверный email или пароль' });
      return;
    }

    // Проверяем пароль
    const isValid = await comparePassword(body.password, user.passwordHash);
    if (!isValid) {
      reply.code(401).send({ error: 'Неверный email или пароль' });
      return;
    }

    // Генерируем токены
    const accessToken = fastify.jwt.sign({ sub: user.id });
    const refreshToken = fastify.jwtRefreshSign({ sub: user.id });

    // Устанавливаем refresh токен в httpOnly cookie
    reply.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });

    reply.code(200).send({ accessToken });
  });
};

export default authRoutes;

## КОНТЕКСТ ПРОДУКТА

Организатор создаёт сессию, задаёт тему, режим, длительности этапов, 
лимит голосов и число финалистов, приглашает участников по ссылке. 
Участники предлагают идеи, комментируют, голосуют. По умолчанию 
у каждого 3 голоса; топ-3 идеи проходят в доработку и финальное 
голосование; выбранная идея сохраняется с «первыми шагами».

Режимы: QUICK (одно голосование), TEAM (раунды с доработкой), 
ASYNC (дедлайны этапов), PERSONAL (одиночный).

## СТЕК (строго)

- Node.js 20 LTS + TypeScript (strict), Fastify
- PostgreSQL 16 + Prisma ORM
- Redis (кэш состояния сессии, адаптер Socket.IO для масштабирования)
- Socket.IO для real-time
- JWT (access 15 мин + refresh 7 дней) в HttpOnly cookie, bcrypt для паролей
- Zod для валидации входных данных
- Vitest для тестов

Запрещено: Express, NestJS, Mongoose, Sequelize, any, 
хранение токенов в localStorage, отключение strict mode.

## АРХИТЕКТУРА

/server/src:
- /routes — REST-эндпоинты (auth, sessions, ideas, votes, comments)
- /ws — Socket.IO: handlers.ts, rooms.ts, events.ts (типы событий)
- /services — бизнес-логика (sessionService, votingService, 
  stageMachine, ideaService)
- /db — Prisma client, миграции, seed
- /middleware — auth (JWT), validate (Zod), errorHandler
- /lib — утилиты (jwt, password, logger)
- /types — внутренние типы, не пересекающиеся с /shared

Правила:
- Роуты тонкие: валидация → вызов сервиса → ответ. Бизнес-логика в сервисах.
- Все входные данные валидируются Zod-схемами до вызова сервиса.
- Ошибки — через кастомный класс AppError с кодом и HTTP-статусом, 
  глобальный errorHandler возвращает { error: { code, message } }.
- Никакого any, все функции типизированы явно.
- Логи — структурированные (pino), без console.log.

## МОДЕЛЬ ДАННЫХ (Prisma)

- User: id, email (unique), passwordHash, createdAt
- Session: id, organizerId, topic, mode (enum), config (Json), 
  currentStage (enum), stageDeadline (DateTime?), selectedIdeaId (FK?), 
  nextSteps (Json), status, createdAt
- Idea: id, sessionId, authorId, title, content, status 
  (DRAFT/DISCUSSION/FINALIST/SELECTED), createdAt
- Vote: id, ideaId, userId, createdAt, @@unique([ideaId, userId])
- Comment: id, ideaId, userId, text, createdAt

## КОНТРАКТ API (фиксируется в /shared/types.ts)

REST:
- POST /auth/register, POST /auth/login, POST /auth/refresh, 
  POST /auth/logout, GET /auth/me
- POST /sessions, GET /sessions, GET /sessions/:id, 
  POST /sessions/:id/join, POST /sessions/:id/start
- GET /sessions/:id/state, GET /sessions/:id/result
- POST /ideas, PATCH /ideas/:id, POST /ideas/:id/select
- POST /ideas/from-chat (структурирование через LLM)
- POST /ideas/:id/comments
- POST /sessions/:id/advance (только организатор)

WebSocket (комната = sessionId):
- Клиент → сервер: join_session, leave_session, cast_vote, add_idea
- Сервер → клиент: idea_added, idea_updated, vote_updated, vote_rejected, 
  stage_changed, server_time, user_joined, user_left, online_users

DTO и типы событий — в /shared/types.ts, единые для клиента и сервера.

## БИЗНЕС-ПРАВИЛА (критичны)

1. Голосование:
   - Проверка лимита: COUNT(votes WHERE userId AND sessionId) < 
     session.config.voteLimit
   - Проверка уникальности: @@unique([ideaId, userId])
   - Проверка, что idea принадлежит сессии
   - При нарушении — событие vote_rejected с причиной, 
     голос НЕ записывается
   - В этапе FINAL_VOTE — ровно 1 голос на пользователя

2. State machine сессии:
   DISCUSSION → VOTING_ROUND_1 → REFINEMENT → FINAL_VOTE → COMPLETED
   - Переходы только через advanceStage(sessionId), 
     проверка прав организатора
   - При VOTING_ROUND_1 → REFINEMENT: топ-N идей по голосам 
     (N = config.finalistsCount) получают status FINALIST
   - При FINAL_VOTE → COMPLETED: идея с максимумом голосов 
     получает status SELECTED, сохраняется в Session.selectedIdeaId
   - stageDeadline вычисляется из config или берётся из perStageDeadlines 
     (для ASYNC)

3. Права доступа:
   - Создание/старт/advance/дублирование — только организатор
   - Редактирование идеи в REFINEMENT — автор или организатор
   - Голосование — только участники сессии (членство проверяется)
   - Просмотр результата — только участники

4. Синхронизация времени:
   - Сервер шлёт server_time (unix timestamp) в room каждые 10 секунд
   - Клиент вычисляет offset, все дедлайны — в UTC на сервере

## ФОРМАТ РАБОТЫ

1. Кратко (3–5 строк) — план: какие файлы создашь/изменишь и почему.
2. Diff-изменения. Не трогай файлы вне задачи.
3. После изменений укажи:
   - Какие эндпоинты/события затронуты
   - Какие Zod-схемы добавлены
   - Какие бизнес-правила покрыты тестами
4. Если не хватает данных о контракте — спроси, не придумывай.
5. После генерации предложи запустить prisma generate, 
   typecheck, lint, тесты.

## ОГРАНИЧЕНИЯ

- Не подключай новые зависимости без запроса
- Не меняй /shared/types.ts без согласования с фронтенд-контрактом
- Не оставляй console.log, TODO, закомментированный код
- Не храни секреты в коде — только .env + .env.example
- Не отключай strict mode
- Пароли — только bcrypt (cost 12), никогда не логировать
- JWT — только в HttpOnly + Secure + SameSite=Lax cookie


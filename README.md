# Brain Storm

Монорепозиторий с npm workspaces. Веб-приложение с клиентом на React + Vite и сервером на Fastify 4 + TypeScript + Prisma.

## Структура

- `client/` — React + Vite фронтенд
- `server/` — Fastify бэкенд
- `shared/` — общие типы и утилиты

## Сервер

### Зависимости
- Fastify 4
- Prisma (ORM)
- Zod (валидация)
- @fastify/jwt, @fastify/cookie, @fastify/cors
- bcryptjs (хеширование паролей)
- socket.io (WebSocket)

### Аутентификация

#### POST /auth — регистрация
- Валидация через RegisterSchema (email, password мин. 8 символов)
- Проверка уникальности email (409 если занят)
- Хеширование пароля через bcryptjs
- Создание пользователя в БД
- Ответ 201: `{ accessToken, user: { id, email, createdAt } }`

#### POST /auth/login — авторизация
- Валидация через LoginSchema (email, password)
- Поиск пользователя по email, проверка пароля
- Ответ 401 при неверных данных
- Генерация access и refresh токенов
- Refresh токен устанавливается в httpOnly cookie
- Ответ 200: `{ accessToken }`

#### GET /health — health check
- Ответ: `{ status: 'ok' }`

### Сессии (защищённые роуты, требуют JWT)

#### POST /sessions — создание сессии
- Валидация через CreateSessionSchema (topic, mode, config)
- organizerId берётся из JWT токена (`request.user.sub`)
- Создание сессии в БД со статусом `ACTIVE`
- Ответ 201: созданная сессия

#### GET /sessions/:id — получение сессии с проверкой доступа
- Поиск сессии по ID
- Ответ 404 если сессия не найдена
- Проверка доступа:
  - Органайзер сессии (`session.organizerId === userId`) — доступ разрешён
  - Участники, у которых есть идея в сессии — доступ разрешён
  - В остальных случаях — 403 `{ error: 'Нет доступа к сессии' }`
- Ответ 200: сессия

#### POST /sessions/:id/advance — переход к следующему этапу сессии
- Только организатор сессии может вызвать этот endpoint (403 для остальных)
- Вызывает сервис `advanceStage` для перехода к следующему этапу
- Отправляет WebSocket событие `stage_advanced` всем участникам сессии
- Ответ 200: `{ session, stage, stageDeadline }`

#### GET /sessions/:id/result — получение результата завершённой сессии
- Проверка доступа: организатор ИЛИ участник сессии (403 при отсутствии доступа)
- Если `selectedIdeaId` задан, возвращает связанную идею (`title`, `content`)
- Возвращает `nextSteps` (массив строк или пустой массив), `sessionSummary` (текст или null)
- Ответ 200: `{ selectedIdea: { title, content } | null, nextSteps: string[], sessionSummary: string | null }`

#### PATCH /sessions/:id/result — сохранение результата завершённой сессии
- Только организатор сессии может вызвать этот endpoint (403 для остальных)
- Валидация через `UpdateSessionResultSchema`: `{ nextSteps?: string[], sessionSummary?: string }`
- `nextSteps` — массив непустых строк (макс. 50 элементов)
- `sessionSummary` — строка (макс. 5000 символов)
- Сохраняет переданные поля в сессию (остальные поля не меняются)
- Ответ 200: `{ nextSteps: string[], sessionSummary: string | null }`

### Идеи (защищённые роуты, требуют JWT)

#### GET /sessions/:sessionId/ideas — получение всех идей сессии с количеством голосов
- Проверка существования сессии (404 если не найдена)
- Проверка доступа: организатор сессии ИЛИ пользователь, у которого есть хотя бы одна идея в сессии (403 при отсутствии доступа)
- Возвращает все идеи сессии с `voteCount` (количество голосов) и информацией об авторе
- Ответ 200: массив идей с полями `id`, `title`, `content`, `status`, `voteCount`, `author`, `createdAt`

#### POST /sessions/:sessionId/ideas — создание новой идеи
- Валидация через `createIdeaSchema`: `{ title: string (1-200), content: string (1-5000) }`
- Проверка что сессия в этапе DISCUSSION (400 если нет)
- authorId берётся из JWT токена, status автоматически устанавливается DRAFT
- Ответ 201: созданная идея с информацией об авторе

#### PATCH /sessions/:sessionId/ideas/:ideaId — редактирование идеи
- Валидация через `updateIdeaSchema`: `{ title?: string, content?: string }`, хотя бы одно поле обязательно
- Проверка доступа: только автор идеи ИЛИ организатор сессии (403 для остальных)
- Редактирование возможно только когда idea.status === FINALIST (этап REFINEMENT, 400 иначе)
- Ответ 200: обновлённая идея с `voteCount`

### Голосование (защищённые роуты, требуют JWT)

#### POST /sessions/:sessionId/vote — финальное голосование за идею
- Валидация через `finalVoteSchema`: `{ ideaId: string }`
- Проверки:
  1. Сессия в этапе FINAL_VOTE (400 если нет)
  2. Идея имеет статус FINALIST (400 если нет)
  3. Пользователь ещё не проголосовал за НИ ОДНУ из идей-финалистов в этой сессии (409 Conflict если уже голосовал)
- "1 голос на финальное голосование" проверяется на уровне БД: пользователь может проголосовать только за ОДНУ идею среди всех финалистов
- Отправляет WebSocket событие `new_vote` всем участникам сессии
- Ответ 201: созданный голос

#### GET /sessions/:sessionId/finalists — получение всех финалистов с количеством голосов
- Проверка доступа: организатор ИЛИ участник (403 при отсутствии доступа)
- Возвращает все идеи-финалисты с `voteCount` и флагом `hasVoted` (проголосовал ли текущий пользователь за эту идею)
- Отсортировано по количеству голосов (по убыванию)
- Ответ 200: массив финалистов

### Система этапов сессий (Session Stages)

Каждая сессия проходит через серию этапов, управляемых организатором:

#### Этапы (SessionStage enum)
1. **DISCUSSION** — обсуждение, участники предлагают идеи
2. **VOTING_ROUND_1** — первый раунд голосования за идеи
3. **REFINEMENT** — уточнение топ-3 идей (автоматически выбираются по количеству голосов)
4. **FINAL_VOTE** — финальное голосование
5. **COMPLETED** — завершённая сессия, победитель определён

#### Переходы между этапами
- Организатор вызывает `POST /sessions/:id/advance` для перехода к следующему этапу
- При переходе от DISCUSSION → VOTING_ROUND_1: все идеи со статусом DRAFT become DISCUSSION
- При переходе от VOTING_ROUND_1 → REFINEMENT: топ-3 идеи по голосам получают статус FINALIST
- При переходе от REFINEMENT → FINAL_VOTE: начинается финальное голосование
- При переходе от FINAL_VOTE → COMPLETED: идея с максимумом голосов получает статус SELECTED

#### Длительности этапов
По умолчанию (в миллисекундах):
- voting: 30 минут
- refinement: 15 минут
- finalVote: 20 минут

Можно настроить через `config.stageDurations` при создании сессии.

### Запуск

```bash
# Установка зависимостей
npm install

# Запуск сервера в dev-режиме
npm --workspace=@brain-storm/server run dev
```

### Плагины

- [`prisma.ts`](server/src/plugins/prisma.ts) — подключение PrismaClient, декорация `fastify.prisma`
- [`jwt.ts`](server/src/plugins/jwt.ts) — @fastify/jwt для access токенов + декоратор `fastify.jwtRefreshSign` для refresh токенов
- [`auth.ts`](server/src/plugins/auth.ts) — middleware проверки JWT (onRequest hook)
- [`cors.ts`](server/src/plugins/cors.ts) — настройка CORS
- [`socket.io.ts`](server/src/plugins/socket.io.ts) — интеграция Socket.IO с Fastify, декорация `fastify.io`

### Socket.IO

Сервер поддерживает WebSocket-соединения через Socket.IO для реального времени в сессиях мозгового штурма.

#### Клиентские события

- **`join_session(sessionId)`** — присоединение к сессии
  - JWT токен берётся из `socket.handshake.auth.token` или `socket.handshake.query.token`
  - Проверяется подпись токена и совпадение `sessionId` из payload с переданным `sessionId`
  - При успехе socket присоединяется к room с именем `sessionId`
  - При ошибке отправляется событие `error` с сообщением

- **`leave_session()`** — выход из сессии
  - Отписывает socket от room
  - Очищает данные сессии (sessionId, userId)

- **`cast_vote(ideaId, callback)`** — голосование за идею
  - Проверяет, что идея принадлежит текущей сессии пользователя
  - Проверяет лимит голосов (`voteLimit` в config сессии, по умолчанию 10)
  - Создаёт запись `Vote` в БД (уникальное ограничение ideaId + userId)
  - Отправляет `vote_updated` всем участникам сессии с новым количеством голосов
  - Вызывает `callback()` при успехе или `callback(error)` при ошибке
  - При повторном голосовании за ту же идею — ошибка `P2002` → `vote_rejected`

#### Серверные события (отправляются в room)

- **`vote_updated({ ideaId, voteCount })`** — обновлены голоса после голосования
- **`vote_rejected(reason)`** — голос отклонён с указанием причины
- **`idea_added`** — добавлена новая идея
- **`session_status_changed`** — изменён статус сессии

#### Использование на сервере

```typescript
// Отправка события всем участникам сессии
fastify.io.to(sessionId).emit('idea_added', idea);
```

### Утилиты

- [`password.ts`](server/src/utils/password.ts) — `hashPassword()` и `comparePassword()` на bcryptjs

### Схемы валидации (Zod)

- [`auth.schema.ts`](server/src/schemas/auth.schema.ts) — RegisterSchema, LoginSchema

## Клиент

### Зависимости
- React 18
- Vite 5
- socket.io-client (WebSocket коммуникация)
- TypeScript

### Компоненты

#### SessionPage ([`client/src/pages/SessionPage.tsx`](client/src/pages/SessionPage.tsx))
Основная страница сессии мозгового штурма.
- Отображает grid карточек идей (IdeaCard)
- Форма добавления новой идеи (поля: title, content)
- Загрузка идей с сервера при монтировании (GET /api/sessions/:id/ideas)
- Отправка новой идеи на сервер (POST /api/sessions/:id/ideas)
- Подключение к Socket.IO для получения событий в реальном времени
- Оптимистичное обновление счётчика голосов при голосовании
- Откат счётчика при отклонении голоса (`vote_rejected`)
- Отображение доступного лимита голосов

#### IdeaCard ([`client/src/components/IdeaCard.tsx`](client/src/components/IdeaCard.tsx))
Карточка отдельной идеи.
- Пропсы: `idea` (id, title, content, voteCount, hasVoted), `onVote` (callback), `isVoteDisabled` (boolean)
- Отображает заголовок, текст, счётчик голосов и кнопку "Голосовать"
- Кнопка disabled если голос уже использован или лимит исчерпан

#### SessionContainer ([`client/src/pages/SessionContainer.tsx`](client/src/pages/SessionContainer.tsx))
Обёрточный компонент для управления этапами сессии.
- Загружает текущий этап (`currentStage`) при монтировании через `GET /api/sessions/:id`
- Периодически обновляет этап (polling каждые 5 секунд)
- Рендерит соответствующую страницу в зависимости от `currentStage`:
  - **DISCUSSION / VOTING_ROUND_1** → [`SessionPage`](client/src/pages/SessionPage.tsx)
  - **REFINEMENT** → [`RefinementPage`](client/src/pages/RefinementPage.tsx)
  - **FINAL_VOTE** → [`FinalVotePage`](client/src/pages/FinalVotePage.tsx)
  - **COMPLETED** → страница «Голосование завершено!»
- Получает уведомления о смене этапа от дочерних компонентов через callback `onStageChange` (событие Socket.IO `stage_advanced`)

#### RefinementPage ([`client/src/pages/RefinementPage.tsx`](client/src/pages/RefinementPage.tsx))
Страница для этапа REFINEMENT (уточнение идей-финалистов).
- Загружает идеи со статусом FINALIST
- Позволяет редактировать title и content для каждой карточки
- Сохраняет изменения через `PATCH /api/sessions/:sessionId/ideas/:ideaId`
- Отображает обратный отсчёт до конца этапа

#### FinalVotePage ([`client/src/pages/FinalVotePage.tsx`](client/src/pages/FinalVotePage.tsx))
Страница для этапа FINAL_VOTE (финальное голосование).
- Загружает финалистов через `GET /api/sessions/:sessionId/finalists`
- Позволяет проголосовать за одну идею (1 голос на пользователя)
- Голосование через `POST /api/sessions/:sessionId/vote`
- Отображает обратный отсчёт до конца этапа

### Хуки

#### useSocket ([`client/src/hooks/useSocket.ts`](client/src/hooks/useSocket.ts))
Кастомный хук для управления Socket.IO подключением.
- Параметры: `sessionId`, `token`, колбэки `onVoteUpdated`, `onVoteRejected`, `onJoined`, `onError`
- Автоматически подключается к серверу и присоединяется к сессии (`join_session`)
- Подписывается на события: `vote_updated`, `vote_rejected`, `joined`, `error`
- Возвращает метод `castVote(ideaId, callback)` для отправки голоса
- Автоматически отключается при размонтировании компонента

### Оптимистичное обновление голосов
1. При нажатии "Голосовать" счётчик сразу увеличивается локально
2. Через Socket.IO отправляется событие `cast_vote`
3. При получении `vote_updated` (успех) — устанавливается реальное значение с сервера
4. При получении `vote_rejected` (отказ) — счётчик откатывается к предыдущему значению

### App.tsx ([`client/src/App.tsx`](client/src/App.tsx))
- Стартовая страница с формой ввода ID сессии и JWT токена
- После заполнения — переход на SessionContainer
- SessionContainer управляет переключением страниц в зависимости от текущего этапа сессии
- Передаёт sessionId и token как пропсы в SessionContainer

### Запуск

```bash
# Установка зависимостей
npm install

# Запуск клиента в dev-режиме
npm --workspace=@brain-storm/client run dev
```

## Тестирование

Для тестирования используется Vitest.

### Запуск тестов

```bash
# Тесты для shared
npm run test --workspace=shared

# Тесты для server
npm run test --workspace=server

# Тесты для client
npm run test --workspace=client
```

### Результаты

- **shared**: 15 тестов (проверка типов и интерфейсов)
- **server**: 36 тестов (схемы валидации, плагины CORS и аутентификации, утилиты паролей)
- **client**: 17 тестов (компонент IdeaCard, хук useSocket)

### Тестирование в watch-режиме

```bash
# Сервер
npm run test:watch --workspace=server

# Клиент
npm run test:watch --workspace=client

# Shared
npm run test:watch --workspace=shared
```

## WebSocket — Server Time Sync

Сервер отправляет событие `server_time` (Unix timestamp) при подключении клиента и каждые 10 секунд. Клиент вычисляет смещение между локальным и серверным временем для точного обратного отсчёта.

### Таймер обратного отсчёта

На странице сессии отображается обратный отсчёт до `stageDeadline` с учётом смещения времени. Когда таймер доходит до нуля, клиент автоматически запрашивает актуальный статус сессии (`GET /sessions/:id/status`) для обновления данных.

### События WebSocket

| Событие | Направление | Описание |
|---------|------------|----------|
| `server_time` | Server → Client | Unix timestamp сервера (мс) |
| `stage_advanced` | Server → Client | Смена стадии с новым дедлайном |

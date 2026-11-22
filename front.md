
## КОНТЕКСТ ПРОДУКТА

Сервис для совместного мозгового штурма. Организатор создаёт сессию, 
приглашает участников по ссылке, команда предлагает идеи карточками, 
голосует с лимитом голосов, выбирает финалистов, дорабатывает их 
и фиксирует решение с «первыми шагами».

Режимы: Быстрый (одно голосование), Командный (раунды с доработкой), 
Асинхронный (дедлайны этапов), Личный (одиночный).

Ключевой экран — Комната сессии: sticky-шапка с этапом и таймером, 
лента карточек идей (левая колонка), панель голосов и лидеров (правая). 
Всё критичное — добавление идей, голосование, доработка — происходит 
без перехода на другие страницы. Реальное время через Socket.IO.

## СТЕК (строго)

- React 18 + TypeScript (strict), Vite, react-router-dom v6
- Tailwind CSS 3.4 с кастомным tailwind.config.js (см. ниже)
- Zustand только для auth и socket-сессии; остальное — локальное состояние
- Socket.IO client, date-fns, lucide-react (иконки)

Запрещено: MUI, Chakra, Ant Design, styled-components, Emotion, 
CSS Modules, отдельные .css-файлы для компонентов, moment.js, 
class components, any, inline-стили (кроме динамических значений 
вроде ширины прогресс-бара).

## ДИЗАЙН-СИСТЕМА В TAILWIND (критично)

Первый файл — /client/tailwind.config.js. Он сужает пространство 
выбора: стандартная палитра Tailwind (blue-*, indigo-*, red-* и т.д.) 
НЕ используется. Только семантические токены.

```js
// tailwind.config.js
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2563EB', hover: '#1D4ED8', soft: '#EFF6FF' },
        success: { DEFAULT: '#10B981', soft: '#ECFDF5' },
        warning: { DEFAULT: '#F59E0B', soft: '#FFFBEB' },
        danger:  { DEFAULT: '#EF4444', soft: '#FEF2F2' },
        stage: {
          discussion: '#3B82F6',
          voting:     '#F59E0B',
          refinement: '#8B5CF6',
          final:      '#EF4444',
          completed:  '#10B981',
        },
        neutral: {
          50:'#F9FAFB',100:'#F3F4F6',200:'#E5E7EB',300:'#D1D5DB',
          400:'#9CA3AF',500:'#6B7280',600:'#4B5563',700:'#374151',
          800:'#1F2937',900:'#111827',
        },
      },
      fontFamily: { sans: ['Inter','system-ui','sans-serif'] },
      fontSize: {
        xs:['12px',{lineHeight:'1.4'}], sm:['14px',{lineHeight:'1.5'}],
        base:['16px',{lineHeight:'1.6'}], lg:['20px',{lineHeight:'1.5'}],
        xl:['24px',{lineHeight:'1.4'}], '2xl':['32px',{lineHeight:'1.3'}],
      },
      spacing: { 1:'4px',2:'8px',3:'12px',4:'16px',5:'20px',
                 6:'24px',8:'32px',10:'40px',12:'48px' },
      borderRadius: { sm:'6px', md:'10px', lg:'16px' },
      boxShadow: {
        card:'0 1px 3px rgba(17,24,39,.06),0 1px 2px rgba(17,24,39,.04)',
        modal:'0 10px 40px rgba(17,24,39,.15)',
        dropdown:'0 4px 16px rgba(17,24,39,.10)',
      },
      transitionDuration: { DEFAULT:'150ms', modal:'250ms' },
    },
  },
  plugins: [],
}
```

ПРАВИЛА ИСПОЛЬЗОВАНИЯ TAILWIND (обязательны к соблюдению)
Только семантические классы:

Цвета: text-neutral-700, bg-primary, border-neutral-200,
text-stage-refinement — НЕ text-blue-600, bg-indigo-500, bg-gray-100

Отступы: только из шкалы 1–12 (4px шаг) — НЕ p-[13px], НЕ p-7

Радиусы: rounded-sm/md/lg — НЕ rounded-full для кнопок,
НЕ rounded-[7px]

Запрещено:

Arbitrary values: p-[18px], w-[327px], bg-[#2563EB], text-[13px]

Стандартная палитра Tailwind: blue-, indigo-, gray-, red-,
amber-, emerald-, slate-, zinc-

Inline-стили через style={{}} (кроме динамических:
style={{ width: ${progress}% }})

@apply в отдельных CSS-файлах — все стили в className

dangerouslySetInnerHTML, class-variance-authority, clsx без
запроса (если нужен условный className — тернарник или шаблонная
строка)

Условные классы:

Тернарник в className: ${isActive ? 'bg-primary text-white' : 'bg-transparent text-neutral-700'}

Общий базовый набор — первым, модификаторы — после

Композиция:

Если классовая строка длиннее 5 строк в файле — вынеси
в константу над компонентом:
const btnBase = 'inline-flex items-center justify-center font-medium ...'

Примитивы (Button, Input, Card, Badge, Avatar) — единственные
места, где собраны длинные строки. Остальные компоненты
их переиспользуют, не дублируют классы кнопок.

Focus и доступность:

focus-visible:outline-none focus-visible:ring-2
focus-visible:ring-primary focus-visible:ring-offset-2

Не убирать outline без замены на ring

Disabled: disabled:opacity-50 disabled:cursor-not-allowed

ВИЗУАЛЬНЫЙ СТИЛЬ
Современный продуктовый минимализм (Linear, Notion, Height).
Много воздуха, аккуратная типографика, сдержанные акценты.
Мягкие тени (shadow-card), границы border-neutral-200 в покое
и ring-primary при фокусе. Аватары — инициалы на детерминированном
цвете из палитры stage/neutral по userId. Пустые состояния —
короткий текст + действие, без декоративных иллюстраций.

АРХИТЕКТУРА
/client/src:

/pages — LandingPage, AuthPage, DashboardPage, CreateSessionWizard,
SessionRoom, SessionResult

/components/ui — Button, Input, Textarea, Card, Badge, Avatar,
AvatarGroup, Modal, Toast, Spinner, Tooltip, Tabs, Dropdown

/components/room — RoomHeader, IdeaFeed, IdeaCard, AddIdeaForm,
VotesPanel, LeadersPanel, CommentsThread, IdeaEditor,
CollectFromChatModal

/context — AuthContext, SessionSocketContext, ToastContext

/hooks — useAuth, useSessionSocket, useServerTimer,
useOptimisticMutation

/api — типизированные REST-клиенты (fetch, credentials: 'include')

/types — реэкспорт DTO из /shared/types.ts

Правила компонентов:

Один компонент — один .tsx-файл. Отдельных .css-файлов нет.

Пропсы — явный interface XxxProps, без any

Компоненты не вызывают fetch/socket напрямую — только через хуки/пропсы

Если компонент >200 строк — декомпозиция

Страницы — default export, примитивы — named export

КОНТРАКТ API (используется из /shared/types.ts)
REST:

POST /auth/register, POST /auth/login, POST /auth/refresh,
POST /auth/logout, GET /auth/me

POST /sessions, GET /sessions, GET /sessions/:id,
POST /sessions/:id/join, POST /sessions/:id/start

GET /sessions/:id/state, GET /sessions/:id/result

POST /ideas, PATCH /ideas/:id, POST /ideas/:id/select

POST /ideas/from-chat

POST /ideas/:id/comments

POST /sessions/:id/advance

WebSocket:

Клиент → сервер: join_session, leave_session, cast_vote, add_idea

Сервер → клиент: idea_added, idea_updated, vote_updated,
vote_rejected, stage_changed, server_time, user_joined, user_left,
online_users

ОБЯЗАТЕЛЬНЫЕ СОСТОЯНИЯ UI
Для каждого экрана и виджета: loading (скелетоны через
animate-pulse bg-neutral-100, не спиннер на весь экран),
empty (текст + действие), error (сообщение + «Повторить»),
success (тост).

Голосование и добавление идей — оптимистичные обновления через
useOptimisticMutation с откатом при ошибке и тостом с причиной.

Таймеры — только через useServerTimer с serverOffset из события
server_time. Локальное время клиента не используется.

ФОРМАТ РАБОТЫ
Кратко (3–5 строк) — план: какие файлы создашь/изменишь и почему.

Diff-изменения. Не трогай файлы вне задачи.

После изменений укажи: переиспользованные примитивы,
использованные семантические токены (цвета/отступы),
покрытые состояния UI, проверку на запрещённые классы.

Если не хватает данных о DTO или эндпоинте — спроси,
не придумывай контракт.

После генерации предложи запустить build/typecheck/lint.

ОГРАНИЧЕНИЯ
Не подключай новые зависимости без запроса

Не меняй tailwind.config.js без запроса — это дизайн-контракт

Не меняй /shared/types.ts без запроса — это контракт с сервером

Не оставляй console.log, TODO, закомментированный код

Не отключай strict mode

После каждого компонента мысленно проверь: есть ли arbitrary values,
стандартная палитра, inline-стили — если да, исправь до выдачи diff


# Uchion -- AI Worksheet & Presentation Generator

Веб-приложение для автоматической генерации рабочих листов и презентаций по школьным предметам (1-11 классы). Генерирует структурированные задания разных типов с ответами, выдает PDF. Также генерирует учебные PPTX-презентации.

---

## Возможности

- **4 предмета**: Математика (1-6), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11)
- **5 типов заданий**: единственный выбор, множественный выбор, открытый вопрос, соотнесение, вставка пропущенного
- **3 формата листов**: только задания, только тест, тест + задания (с вариантами количества)
- **3 уровня сложности**: легкий, средний, сложный
- **Презентации**: 3 темы оформления (professional, kids, school), 12/18/24 слайдов
- **Мульти-агентная валидация**: автоматическая проверка и исправление ответов
- **PDF/PPTX генерация**: серверная через Puppeteer + pptxgenjs
- **Аутентификация**: Яндекс OAuth (PKCE) + Email OTP (passwordless)
- **Личный кабинет**: сохранение листов и презентаций, папки, inline-редактирование
- **Платежи**: Prodamus integration
- **Админ-панель**: статистика, управление пользователями, AI cost analytics

---

## Архитектура

### Frontend
- React 18 + TypeScript + Vite 7 + Tailwind CSS
- SPA (React Router), Zustand + React Query
- React Hook Form + Zod, KaTeX для формул
- pptxgenjs для PPTX, pdf-lib для клиентского PDF fallback

### Backend
- Express.js 5 (Node.js 20+)
- REST API + SSE стриминг прогресса
- PostgreSQL + Drizzle ORM (12 таблиц)
- Puppeteer + @sparticuz/chromium (PDF)
- Prodamus (платежи), Telegram Bot (алерты)
- Unisender Go (email OTP)

### AI
- **Генерация**: gpt-4.1 (платные) / deepseek-v3.2 (бесплатные) через polza.ai
- **Валидация**: Gemini Flash (STEM) / Gemini Lite (гуманитарные) / gpt-4.1-mini (1-6 классы)
- **Презентации**: Claude (claude-sonnet-4.5)
- Config-driven система генерации

---

## Быстрый старт

### 1. Установка
```bash
npm install
```

### 2. Настройка окружения
```bash
cp .env.example .env.local
```

Минимум для локальной разработки:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/uchion
AI_PROVIDER=dummy        # Бесплатно, без API ключей
AUTH_SECRET=<openssl rand -base64 32>
```

### 3. База данных
```bash
npm run db:push
```

### 4. Запуск
```bash
npm run dev
```

Откроется:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

---

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Frontend + Backend (рекомендуется) |
| `npm run dev:frontend` | Только Vite (port 5173) |
| `npm run dev:server` | Только Express (port 3000) |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run smoke` | Smoke tests (DummyProvider) |
| `npm run test` | Unit tests (Vitest, watch) |
| `npm run test:run` | Unit tests (single run) |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run test:all` | Unit + E2E |
| `npm run db:push` | Push schema to DB |
| `npm run db:generate` | Generate migrations |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Drizzle Studio |

---

## Структура проекта

```
uchion/
├── server.ts              # Express entry point
├── server/
│   ├── routes/            # API handlers
│   │   ├── auth.ts        # Yandex OAuth + Email OTP
│   │   ├── generate.ts    # Worksheet generation (SSE)
│   │   ├── presentations.ts # Presentation generation + CRUD
│   │   ├── worksheets.ts  # Worksheet CRUD
│   │   ├── folders.ts     # Folder CRUD
│   │   ├── billing.ts     # Prodamus payments
│   │   ├── telegram.ts    # Bot webhook
│   │   ├── health.ts      # Health check
│   │   └── admin/         # Admin panel (stats, users, generations,
│   │                      #   payments, alerts, settings, ai-costs)
│   └── middleware/        # auth, rate-limit, cookies, error-handler, audit-log
├── api/_lib/              # Backend libraries
│   ├── generation/        # Config-driven generation
│   │   ├── config/
│   │   │   ├── subjects/  # math/, algebra/, geometry/, russian/
│   │   │   └── presentations/  # subjects/, templates/
│   │   ├── validation/    # Multi-agent validation
│   │   └── prompts.ts     # Prompt builder
│   ├── presentations/     # Presentation generators
│   ├── providers/         # AI providers (openai, claude, dummy)
│   ├── auth/              # JWT, OAuth, cookies, encryption
│   ├── alerts/            # Generation alerts
│   ├── telegram/          # Bot API
│   ├── ai-provider.ts     # AI orchestrator
│   ├── ai-models.ts       # Model selection
│   ├── ai-usage.ts        # Cost tracking
│   ├── email.ts           # Unisender Go (OTP)
│   └── pdf.ts             # Puppeteer PDF
├── src/                   # React frontend (18 pages)
│   ├── pages/             # GeneratePage, WorksheetPage, admin/...
│   ├── components/        # UI components
│   ├── hooks/             # useWorksheetEditor
│   ├── store/             # Zustand
│   └── lib/               # API clients, auth, utilities
├── shared/                # Shared types (worksheet.ts, types.ts)
├── db/                    # Drizzle ORM schema (12 tables)
├── docs/                  # Documentation
├── tests/                 # Unit, API, E2E tests
└── scripts/               # Utility scripts
```

---

## Переменные окружения

```bash
# Required
DATABASE_URL=postgresql://...
AUTH_SECRET=<min 32 chars>

# AI (optional for dev, required for prod)
AI_PROVIDER=dummy|polza|openai
OPENAI_API_KEY=...
AI_BASE_URL=https://api.polza.ai/api/v1

# OAuth (optional)
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...

# Email OTP (optional for dev)
UNISENDER_GO_API_KEY=...

# Telegram Bot (optional, for admin alerts)
TELEGRAM_BOT_TOKEN=...

# Payments (optional)
PRODAMUS_SECRET=...
PRODAMUS_PAYFORM_URL=...
APP_URL=http://localhost:3000
```

---

## Деплой

Production через **Dokploy** на VPS:

```bash
npm run build
npm run start   # node dist-server/server.js (port 3000)
```

Health check: `GET /api/health`

---

## Безопасность

- OAuth 2.0 с PKCE (Yandex), Email OTP с timing-safe comparison
- JWT в httpOnly cookies, Refresh token rotation с family tracking
- Zod-валидация на всех входах, HTML sanitization
- Webhook signature verification (HMAC-SHA256, Prodamus)
- Rate limiting (Redis-backed с in-memory fallback)
- Audit logging для auth событий

---

## Документация

- [Architecture Overview](docs/architecture-overview.md)
- [Tech Stack](docs/tech-stack.md)
- [API Design](docs/api-design.md)
- [Security & Performance](docs/security-and-performance.md)
- [AI Generation](docs/prompts-ai.md)
- [Development Setup](docs/DEV_SETUP.md)
- [Telegram Alerts](docs/alerts/telegram-alerts.md)
- [Roadmap](docs/new-roadmap.md)

Полное руководство для разработчиков и AI ассистентов: [CLAUDE.md](CLAUDE.md)

---

## Лицензия

Проприетарное ПО. Все права защищены.

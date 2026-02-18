# Development Setup

## Quick Start

```bash
npm install
npm run dev
```

Запускаются:
- **Frontend** (Vite) -- port 5173
- **Backend** (Express) -- port 3000

Vite проксирует `/api/*` на Express.

## Environment

### 1. Скопировать `.env.example`

```bash
cp .env.example .env.local
```

### 2. Настроить переменные

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/uchion

# AI Provider ('dummy' для бесплатной разработки)
AI_PROVIDER=dummy

# Auth (required, generate: openssl rand -base64 32)
AUTH_SECRET=your-secret-min-32-chars

# OAuth (optional for local dev)
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...

# Email OTP (optional for local dev)
UNISENDER_GO_API_KEY=...

# Telegram Bot (optional, for admin alerts)
TELEGRAM_BOT_TOKEN=...

# Payments (optional)
PRODAMUS_SECRET=...
PRODAMUS_PAYFORM_URL=...
APP_URL=http://localhost:3000

# AI Models (optional, all have defaults)
# AI_MODEL_PAID=openai/gpt-4.1
# AI_MODEL_FREE=deepseek/deepseek-v3.2
# AI_MODEL_AGENTS=openai/gpt-4.1-mini
# AI_MODEL_VERIFIER_STEM=google/gemini-3-flash-preview
# AI_MODEL_VERIFIER_HUMANITIES=google/gemini-2.5-flash-lite
# AI_MODEL_PRESENTATION=anthropic/claude-sonnet-4.5
```

### 3. Database

```bash
npm run db:push        # Push schema
npm run db:studio      # Open Drizzle Studio (optional)
```

## Commands

### Start
```bash
npm run dev              # Frontend + Backend (recommended)
npm run dev:frontend     # Только frontend (port 5173)
npm run dev:server       # Только backend (port 3000)
```

### Testing
```bash
npm run test             # Unit tests (Vitest, watch)
npm run test:run         # Unit tests (single run)
npm run test:e2e         # E2E tests (Playwright)
npm run test:all         # Unit + E2E
npm run smoke            # Smoke tests (AI generation)
```

### Database
```bash
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema
npm run db:studio        # Drizzle Studio
```

### Build
```bash
npm run build            # Vite + TypeScript
npm run start            # Production server
```

## Verification

### Frontend
Open `http://localhost:5173`

### Backend
```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"..."}
```

### Auth
```bash
curl http://localhost:3000/api/auth/me
# 401 (not authenticated) -- OK
```

## Troubleshooting

### "Failed to fetch" на auth
Backend не запущен. Используйте `npm run dev` (оба сервера).

### Port already in use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Database connection failed
1. Проверить `DATABASE_URL` в `.env.local`
2. PostgreSQL запущен?
3. Credentials верные?

### OAuth не работает
Callback URLs должны совпадать:
- Yandex: `http://localhost:5173/api/auth/yandex/callback`

### Email OTP не отправляется
- Проверьте `UNISENDER_GO_API_KEY` в `.env.local`
- Без ключа Email OTP не работает в dev-mode
- Yandex OAuth работает без Email OTP

### Puppeteer/Chrome не запускается
- Windows: Chrome/Chromium должен быть установлен
- Linux: установить зависимости Chromium (`apt-get install chromium-browser`)
- В dev-mode Puppeteer ищет локальный Chrome

## Project Structure

```
uchion/
├── server.ts           # Express entry point
├── server/
│   ├── routes/         # API handlers (auth, generate, presentations, worksheets, folders, admin, billing, telegram, health)
│   ├── middleware/     # Auth, rate-limit, cookies, error-handler, audit-log
│   └── lib/            # Server utilities (prodamus, redis)
├── api/_lib/           # Backend utilities
│   ├── generation/     # Config-driven generation system
│   │   └── config/
│   │       ├── subjects/        # Worksheet subject configs (math/, algebra/, geometry/, russian/)
│   │       └── presentations/   # Presentation configs (subjects, templates)
│   ├── presentations/  # Presentation generation (3 generators + pdf + sanitize)
│   ├── providers/      # AI providers (openai, claude, dummy, circuit-breaker)
│   ├── auth/           # Auth utilities (tokens, oauth, cookies, encryption, audit-log)
│   ├── alerts/         # Generation alerts
│   ├── telegram/       # Telegram Bot API (admin alerts)
│   ├── ai-provider.ts  # AI provider abstraction
│   ├── ai-models.ts    # Model selection per subject/tier/grade
│   ├── ai-usage.ts     # Token + cost tracking
│   ├── email.ts        # Unisender Go (OTP emails)
│   └── pdf.ts          # PDF generation (Puppeteer)
├── src/                # React frontend
│   ├── pages/          # 18 pages (11 main + 7 admin)
│   ├── components/     # UI components
│   ├── hooks/          # Custom hooks (useWorksheetEditor)
│   ├── store/          # Zustand stores
│   └── lib/            # Utilities (api, auth, pdf-client, admin-api, etc.)
├── shared/             # Shared types (worksheet.ts, types.ts)
├── db/                 # Database schema (12 tables)
└── docs/               # Documentation
```

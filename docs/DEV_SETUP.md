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
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
VITE_TELEGRAM_BOT_USERNAME=...

# Payments (optional)
PRODAMUS_SECRET=...
PRODAMUS_PAYFORM_URL=...
APP_URL=http://localhost:3000
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
- Telegram: Login Widget, domain = `localhost`

## Project Structure

```
uchion/
├── server.ts           # Express entry point
├── server/
│   ├── routes/         # API handlers (auth, generate, worksheets, folders, admin, billing)
│   ├── middleware/     # Auth, rate-limit, cookies
│   └── lib/            # Server utilities (prodamus)
├── api/_lib/           # Backend utilities (AI, PDF, auth, generation)
│   └── generation/     # Config-driven generation system
├── src/                # React frontend
├── shared/             # Shared types
├── db/                 # Database schema
└── docs/               # Documentation
```

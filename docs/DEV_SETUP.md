# Development Setup Guide

## Quick Start

```bash
# Install dependencies
npm install

# Start development servers (frontend + backend)
npm run dev
```

This runs both:
- **Frontend** (Vite) on port 5173
- **Backend** (Express) on port 3000

## Architecture

```
┌─────────────────────┐      Proxy /api/*       ┌─────────────────────┐
│  Vite Dev Server    │ ──────────────────────> │  Express Server     │
│  Port: 5173         │                          │  Port: 3000         │
│  (Frontend)         │ <────────────────────── │  (Backend)          │
└─────────────────────┘      API Response       └─────────────────────┘
```

All requests to `/api/*` are automatically proxied from Vite to Express (configured in `vite.config.ts`).

## Environment Setup

### 1. Copy example environment file

```bash
cp .env.example .env.local
```

### 2. Configure variables

```bash
# Database (required)
DATABASE_URL=postgresql://user:password@localhost:5432/uchion

# AI Provider (use 'dummy' for free local development)
AI_PROVIDER=dummy

# Auth (required, generate with: openssl rand -base64 32)
AUTH_SECRET=your-secret-min-32-chars

# OAuth (optional for local dev)
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
VITE_TELEGRAM_BOT_USERNAME=...
```

### 3. Setup database

```bash
npm run db:push        # Push schema to database
npm run db:studio      # Open Drizzle Studio (optional)
```

## Development Commands

### Start servers

```bash
npm run dev              # Both frontend + backend (recommended)
npm run dev:frontend     # Frontend only (port 5173)
npm run dev:server       # Backend only (port 3000)
```

### Testing

```bash
npm run test             # Unit tests (Vitest, watch mode)
npm run test:run         # Unit tests (single run)
npm run test:e2e         # E2E tests (Playwright)
npm run smoke            # Smoke tests (AI generation)
```

### Database

```bash
npm run db:generate      # Generate migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema (dev shortcut)
npm run db:studio        # Open Drizzle Studio
```

## Verification

### 1. Check frontend
Open `http://localhost:5173` in browser

### 2. Check backend
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"ok","timestamp":"..."}
```

### 3. Check auth endpoints
```bash
curl http://localhost:3000/api/auth/me
```

## Troubleshooting

### "Failed to fetch" on auth

**Cause:** Backend server not running

**Solution:** Ensure you're using `npm run dev` (runs both servers)

### Port 3000 already in use

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Port 5173 already in use

Same process, replace 3000 with 5173

### Database connection failed

1. Check `DATABASE_URL` in `.env.local`
2. Ensure PostgreSQL is running
3. Verify credentials and database exists

### OAuth not working

1. Check OAuth credentials in `.env.local`
2. Verify callback URLs match your OAuth app settings:
   - Yandex: `http://localhost:5173/api/auth/yandex/callback`
   - Telegram: Uses Login Widget, no callback needed

## Project Structure

```
uchion/
├── server.ts           # Express server entry point
├── server/
│   ├── routes/         # API route handlers
│   └── middleware/     # Auth, rate-limit, cookies
├── src/                # React frontend
├── api/                # Legacy (being migrated to server/)
│   └── _lib/           # Shared backend utilities
├── shared/             # Shared types (frontend + backend)
├── db/                 # Database schema
└── docs/               # Documentation
```

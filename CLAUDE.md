# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uchion -- AI-генератор рабочих листов для школьников 1-11 классов (на русском языке). Генерирует структурированные задания разных типов с ответами, выдает PDF. Использует модели OpenAI (через polza.ai агрегатор) с механизмом догенерации недостающих заданий.

**Предметы**: Математика (1-6 класс), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11).

**Типы заданий**: единственный выбор, множественный выбор, открытый вопрос, соотнесение, вставка пропущенного.

## Development Commands

### Local Development
```bash
npm run dev              # Frontend (Vite, port 5173) + Backend (Express, port 3000)
npm run dev:frontend     # Только Vite
npm run dev:server       # Только Express
```

Vite проксирует `/api` запросы на Express (`localhost:3000`).

### Testing
```bash
npm run smoke            # Smoke tests (DummyProvider, бесплатно)
npm run test             # Unit tests (Vitest, watch mode)
npm run test:run         # Unit tests (single run)
npm run test:e2e         # E2E tests (Playwright)
npm run test:all         # Unit + E2E
```

### Build & Production
```bash
npm run build            # Vite build + TypeScript compile
npm run start            # node dist-server/server.js
```

### Database
```bash
npm run db:generate      # Generate Drizzle migrations
npm run db:migrate       # Run migrations
npm run db:push          # Push schema to database
npm run db:studio        # Open Drizzle Studio
```

## Architecture

### Monorepo Structure
- **Frontend**: React 18 + TypeScript + Vite 7 + Tailwind CSS
  - SPA с React Router
  - State: Zustand (sessions) + React Query (async)
  - Forms: React Hook Form + Zod validation
  - Math rendering: KaTeX
- **Backend**: Express.js 5 (Node.js 20+)
  - REST API + SSE для стриминга прогресса генерации
  - Auth: Custom OAuth 2.0 (Yandex, Telegram)
  - Database: PostgreSQL + Drizzle ORM
  - Payments: Prodamus (webhook-based)
  - Alerts: Telegram Bot для админов
- **Shared Layer**: `shared/` -- единый источник типов/схем

### Key Directories
```
/server                 # Express server
  /routes              # API route handlers (auth, generate, worksheets, folders, admin, billing, telegram, health)
  /middleware          # Auth, rate-limit, cookies
  /lib                 # Server utilities (prodamus.ts)
/api                   # Backend utilities
  /_lib
    /generation        # NEW: Config-driven generation system
      /config          # Subject configs, task types, difficulty, formats
        /subjects      # Per-subject configs (math, algebra, geometry, russian)
      prompts.ts       # Prompt builder
    /ai                # AI modules (validator, schema)
    /auth              # Authentication (tokens, cookies, OAuth)
    /alerts            # Alert system (generation-alerts)
    /telegram          # Telegram Bot API for alerts
    pdf.ts             # PDF generation (pdfkit)
    ai-provider.ts     # AI provider abstraction (OpenAI/Dummy)
/src                   # Frontend React app
  /components          # UI components
  /pages               # React Router pages
  /lib                 # Frontend utilities
  /store               # Zustand state management
/shared                # Shared types (worksheet.ts -- Zod schemas)
/db                    # Database schema (Drizzle ORM)
/docs                  # Documentation
  /subject             # Reference materials per subject
/scripts               # Testing scripts
```

## AI Generation Flow

Система генерации полностью config-driven (`api/_lib/generation/`).

### 1. Конфигурация предметов (`api/_lib/generation/config/subjects/`)
Каждый предмет имеет:
- Диапазон классов (math: 1-6, algebra: 7-11, geometry: 7-11, russian: 1-11)
- Темы по классам (из ФГОС)
- Ограничения (что можно/нельзя для каждого класса)
- Системный промпт

### 2. Типы заданий (`api/_lib/generation/config/task-types.ts`)
5 типов с Zod-валидацией:
- `single_choice` -- единственный выбор (3-5 вариантов)
- `multiple_choice` -- множественный выбор (4-6 вариантов, 2+ правильных)
- `open_question` -- открытый вопрос (короткий ответ)
- `matching` -- соотнесение двух столбцов (3-6 пар)
- `fill_blank` -- вставка пропущенного (1-4 пропуска)

### 3. Форматы листов (`api/_lib/generation/config/worksheet-formats.ts`)
- `open_only` -- только задания (5/10/15 шт)
- `test_only` -- только тест (10/15/20 вопросов)
- `test_and_open` -- тест + задания (по умолчанию: 5 заданий + 10 тестов)

Каждый формат имеет 3 варианта (обычный / профи / профи+), стоимость в генерациях.

### 4. Процесс генерации (`api/_lib/ai-provider.ts`)
1. Собираются промпты из конфига предмета + пользовательских параметров
2. LLM генерирует JSON с массивом `tasks` (каждый task имеет type)
3. Задания разделяются на тестовые (single/multiple_choice) и открытые (остальные)
4. Если заданий не хватает -- запускается **retry** (догенерация недостающих)
5. Конвертация в формат `Worksheet` (assignments + test + answers)
6. PDF генерация через `pdfkit`

**Модель генерации**: `AI_MODEL_GENERATION` (default: `gpt-4.1-mini`)
**Token limit**: `max_tokens: 8000`
**Temperature**: `0.5`

### 5. PDF Generation (`api/_lib/pdf.ts`)
- Server-side через `pdfkit`
- Поддержка KaTeX для математических формул
- Base64-encoded PDF для скачивания

## Environment Variables

### Development (.env.local)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database

# AI Provider
AI_PROVIDER=dummy                           # 'dummy' для бесплатной разработки, 'polza' для реального AI
OPENAI_API_KEY=sk-your-polza-api-key       # Только если AI_PROVIDER=polza
AI_BASE_URL=https://api.polza.ai/api/v1    # polza.ai endpoint

# Models (default: gpt-4.1-mini / gpt-4.1-nano)
AI_MODEL_GENERATION=openai/gpt-4.1-mini
AI_MODEL_VALIDATION=openai/gpt-4.1-nano

# Auth
AUTH_SECRET=your-dev-secret-min-32-chars

# OAuth (optional for local dev)
YANDEX_CLIENT_ID=xxx
YANDEX_CLIENT_SECRET=xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_BOT_USERNAME=xxx
VITE_TELEGRAM_BOT_USERNAME=xxx

# Payments (optional)
PRODAMUS_SECRET=xxx
PRODAMUS_PAYFORM_URL=https://your-shop.payform.ru/
APP_URL=http://localhost:3000
```

### Production
Те же переменные + разные секреты для dev/prod. Деплой через Dokploy на VPS.

### Provider Selection Logic (`api/_lib/ai-provider.ts`)
- `OpenAIProvider` если: `AI_PROVIDER=polza` или `=openai` (prod) или `=neuroapi`
- Иначе `DummyProvider` (hardcoded ответ для разработки)

## Authentication

Custom OAuth 2.0:
- **Yandex OAuth** -- основной метод (PKCE)
- **Telegram Login Widget** -- вторичный метод
- **JWT tokens** -- Access (1h) + Refresh (7d) с ротацией
- **httpOnly cookies** -- безопасное хранение
- **Rate limiting** -- in-memory (по endpoint)

Key files:
- `api/_lib/auth/tokens.ts` -- JWT
- `api/_lib/auth/oauth.ts` -- PKCE, state validation
- `server/middleware/auth.ts` -- route protection
- `server/routes/auth.ts` -- auth endpoints

## Database Schema (`db/schema.ts`)

Таблицы:
- `users` -- пользователи (role, provider, generationsLeft, telegramChatId)
- `folders` -- папки для листов (вложенность, цвет, сортировка)
- `worksheets` -- рабочие листы (subject, grade, topic, difficulty, content JSON)
- `generations` -- лог генераций (status, errorMessage)
- `subscriptions` -- подписки (plan: free/basic/premium, status)
- `payments` -- платежи (amount в копейках, status)
- `payment_intents` -- интенты Prodamus (productCode, providerOrderId)
- `webhook_events` -- идемпотентность вебхуков (eventKey, rawPayloadHash)
- `refresh_tokens` -- JWT refresh tokens (jti, revokedAt)

## Important Patterns

### Type Safety (Shared Layer)
Все типы определены через Zod в `shared/worksheet.ts`:
- `Subject` = `'math' | 'algebra' | 'geometry' | 'russian'`
- `TaskTypeId` = `'single_choice' | 'multiple_choice' | 'open_question' | 'matching' | 'fill_blank'`
- `DifficultyLevel` = `'easy' | 'medium' | 'hard'`
- `WorksheetFormatId` = `'open_only' | 'test_only' | 'test_and_open'`
- `GenerateSchema` -- валидация формы (subject, grade 1-11, topic, taskTypes, difficulty, format, variantIndex)

### SSE Progress Streaming
`POST /api/generate` стримит через SSE:
- `{ type: 'progress', percent: 0-100 }`
- `{ type: 'result', data: { worksheet } }`
- `{ type: 'error', code, message }`

### Protected Routes
```typescript
import { withAuth, withAdminAuth, withOptionalAuth } from '../middleware/auth.js'

router.get('/protected', withAuth, (req, res) => { req.user!.id })
router.get('/admin', withAdminAuth, (req, res) => { })
router.get('/public', withOptionalAuth, (req, res) => { })
```

## Testing

### Smoke Tests (`scripts/smoke-generate.ts`)
- Все комбинации: предметы x классы
- Валидация схемы, количества заданий, PDF

### Unit Tests (Vitest)
- `npm run test` -- watch mode
- `npm run test:run` -- single run

### E2E Tests (Playwright)
- `npm run test:e2e` -- headless
- `npm run test:e2e:ui` -- interactive

## Common Modifications

### Adding a New Subject
1. Создать конфиг `api/_lib/generation/config/subjects/newsubject.ts` (по образцу math.ts)
2. Зарегистрировать в `api/_lib/generation/config/subjects/index.ts`
3. Добавить в `api/_lib/generation/config/index.ts`
4. Добавить в `SubjectSchema` в `shared/worksheet.ts`
5. Добавить в `subjectEnum` в `db/schema.ts`
6. Обновить frontend (выбор предмета)
7. Добавить smoke tests

### Modifying Generation
1. Типы заданий: `api/_lib/generation/config/task-types.ts`
2. Форматы листов: `api/_lib/generation/config/worksheet-formats.ts`
3. Промпты: `api/_lib/generation/prompts.ts`
4. Конвертация в Worksheet: `api/_lib/ai-provider.ts` (convertToWorksheet)
5. PDF layout: `api/_lib/pdf.ts`

## Deployment

### Production (Dokploy)
1. Build: `npm run build`
2. Start: `npm run start` (runs `node dist-server/server.js`)
3. Port: `3000` (configurable via `PORT`)
4. Health check: `GET /api/health`

## Model Selection and Pricing

### via polza.ai

**Оптимальное соотношение цена/качество:**
- Generation: `openai/gpt-4.1-mini` (~0.15 rub/лист)
- Validation: `openai/gpt-4.1-nano` (~0.02 rub/валидация)

**Дороже, но качественнее:**
- Generation: `openai/gpt-4.1` (~0.7 rub/лист)

**Не использовать** (reasoning models, 5-10x дороже):
- `openai/gpt-5-mini`, `openai/o1`, `openai/o3` -- генерируют лишние reasoning tokens

### Token Limits
- Generation: `max_tokens: 8000`
- Validation: `max_tokens: 600`

## Critical Notes

1. **Не коммитить API ключи** -- только через env variables
2. **Разные AUTH_SECRET для dev/prod**
3. **DummyProvider для локальной разработки** -- бесплатно, без API вызовов
4. **Config-driven генерация** -- новые предметы добавляются через конфиги, не код
5. **Grades 1-11** -- не только начальная школа, поддерживаются все классы
6. **5 типов заданий** -- single_choice, multiple_choice, open_question, matching, fill_blank
7. **Prodamus для платежей** -- webhook idempotency через webhook_events table

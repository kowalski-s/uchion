# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uchion -- AI-генератор рабочих листов и презентаций для школьников 1-11 классов (на русском языке). Генерирует структурированные задания разных типов с ответами, выдает PDF. Также генерирует учебные PPTX-презентации. Использует модели через polza.ai агрегатор с механизмом мульти-агентной валидации.

**Предметы**: Математика (1-6 класс), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11).

**Типы заданий**: единственный выбор, множественный выбор, открытый вопрос, соотнесение, вставка пропущенного.

**Презентации**: 4 темы оформления (professional, educational, minimal, scientific), 3 варианта объема (12/18/24 слайдов).

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
  - Presentations: pptxgenjs (PPTX) + SlidePreview (HTML preview)
- **Backend**: Express.js 5 (Node.js 20+)
  - REST API + SSE для стриминга прогресса генерации
  - Auth: Custom OAuth 2.0 (Yandex, Telegram)
  - Database: PostgreSQL + Drizzle ORM
  - PDF: Puppeteer + @sparticuz/chromium (HTML -> PDF)
  - Payments: Prodamus (webhook-based)
  - Alerts: Telegram Bot для админов
- **Shared Layer**: `shared/` -- единый источник типов/схем

### Key Directories
```
/server                 # Express server
  /routes              # API route handlers
    auth.ts            # Authentication (OAuth, JWT)
    generate.ts        # Worksheet generation (SSE)
    presentations.ts   # Presentation generation (SSE)
    worksheets.ts      # Worksheet CRUD
    folders.ts         # Folder CRUD
    admin/             # Admin panel API (subdirectory)
      index.ts         # Admin router
      stats.ts         # Statistics
      users.ts         # User management
      generations.ts   # Generation logs
      payments.ts      # Payment logs
      alerts.ts        # Alert settings
    billing.ts         # Prodamus payments
    telegram.ts        # Telegram bot webhook
    health.ts          # Health check
  /middleware          # Auth, rate-limit, cookies, audit-log, error-handler
  /lib                 # Server utilities (prodamus.ts, redis.ts)
/api                   # Backend utilities
  /_lib
    /generation        # Config-driven generation system
      /config
        /subjects      # Per-subject configs (math, algebra, geometry, russian)
        /presentations # Presentation configs (subjects, templates)
          /subjects    # Presentation subject configs
          /templates   # Slide templates (minimalism.ts)
        task-types.ts
        worksheet-formats.ts
        difficulty.ts
        task-distribution.ts
      /validation      # Multi-agent validation system
        /agents        # Validation agents
          answer-verifier.ts
          task-fixer.ts
          quality-checker.ts
          content-checker.ts
        deterministic.ts  # Deterministic validation (counts, formats)
      prompts.ts       # Prompt builder
      sanitize.ts      # Content sanitization
    /providers         # AI provider implementations
      openai-provider.ts
      claude-provider.ts
      dummy-provider.ts
      circuit-breaker.ts
    /presentations     # Presentation generation
      generator.ts     # Main presentation generator
      minimalism-generator.ts  # Minimalism template generator
      pdf-generator.ts # Presentation PDF (Puppeteer)
      sanitize.ts      # HTML sanitization
    /ai                # AI modules (validator, schema, prompts)
    /auth              # Authentication (tokens, cookies, OAuth, encryption, audit-log)
    /alerts            # Alert system (generation-alerts)
    /telegram          # Telegram Bot API (bot, commands)
    pdf.ts             # Worksheet PDF generation (Puppeteer)
    ai-provider.ts     # AI provider orchestrator
    ai-models.ts       # Model selection logic (per subject, per tier)
/src                   # Frontend React app
  /components          # UI components (EditableWorksheetContent, SlidePreview, etc.)
  /pages               # React Router pages (15 pages incl. admin)
  /hooks               # Custom hooks (useWorksheetEditor)
  /lib                 # Frontend utilities (api, auth, pdf-client, admin-api, etc.)
  /store               # Zustand state management
/shared                # Shared types
  worksheet.ts         # Zod schemas (Subject, TaskTypeId, Worksheet, etc.)
  types.ts             # Presentation types, dashboard types, error codes
/db                    # Database schema (Drizzle ORM)
/tests                 # Test suites
  /unit                # Vitest unit tests
  /api                 # API tests
  /e2e                 # Playwright E2E tests
/docs                  # Documentation
  /subject             # Reference materials per subject
/scripts               # Utility scripts (smoke tests, DB migrations, admin tools)
/fixtures              # Test fixtures (sample-worksheet.json)
/public/fonts          # Inter font files (TTF, WOFF2)
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
- `multiple_choice` -- множественный выбор (5 вариантов, 2-3 правильных)
- `open_question` -- открытый вопрос (короткий ответ)
- `matching` -- соотнесение двух столбцов (3-6 пар)
- `fill_blank` -- вставка пропущенного (1-4 пропуска)

### 3. Форматы листов (`api/_lib/generation/config/worksheet-formats.ts`)
- `open_only` -- только задания (5/10/15 шт)
- `test_only` -- только тест (10/15/20 вопросов)
- `test_and_open` -- тест + задания (по умолчанию: 5 заданий + 10 тестов)

Каждый формат имеет 3 варианта (обычный / профи / профи+), стоимость в генерациях (1/2/3).

### 4. Процесс генерации (`api/_lib/ai-provider.ts`)
1. Собираются промпты из конфига предмета + пользовательских параметров
2. LLM генерирует JSON с массивом `tasks` (каждый task имеет type)
3. Задания разделяются на тестовые (single/multiple_choice) и открытые (остальные)
4. Если заданий не хватает -- запускается **retry** (догенерация недостающих)
5. **Мульти-агентная валидация** (answer-verifier, task-fixer, quality-checker)
6. Конвертация в формат `Worksheet` (assignments + test + answers)
7. PDF генерация через Puppeteer (HTML -> PDF)

### 5. Модели по типам (`api/_lib/ai-models.ts`)

| Назначение | Платные пользователи | Бесплатные пользователи |
|------------|---------------------|------------------------|
| Генерация листов | `gpt-4.1` (`AI_MODEL_PAID`) | `deepseek/deepseek-chat` (`AI_MODEL_FREE`) |
| Агенты валидации | `gpt-4.1-mini` (`AI_MODEL_AGENTS`) | -- |
| Верификатор (STEM) | `gemini-3-flash-preview` (reasoning: low) | -- |
| Верификатор (гуманитарные) | `gemini-2.5-flash-lite` (reasoning: off) | -- |
| Фиксер (STEM) | `gemini-3-flash-preview` (reasoning: minimal) | -- |
| Презентации | `claude-sonnet-4.5` | -- |

**Token limit**: `max_tokens: 16000` (генерация), `temperature: 0.5`

### 6. PDF Generation (`api/_lib/pdf.ts`)
- Server-side через **Puppeteer** + `@sparticuz/chromium`
- HTML-шаблон -> PDF через `page.pdf()`
- Inter шрифт (base64-embedded TTF)
- LaTeX -> Unicode конвертация (100+ мат. команд, греческие буквы)
- Matching задания: двухколоночный HTML layout
- Поля для ответов, оценки, заметок
- Многостраничный: задания, тест, оценка/заметки, ответы

### 7. Презентации (`api/_lib/presentations/`)
- Генерация через Claude (`claude-sonnet-4.5`)
- 4 темы: professional, educational, minimal, scientific
- 10 типов слайдов: title, content, twoColumn, table, example, formula, diagram, chart, practice, conclusion
- PPTX генерация через `pptxgenjs`
- PDF генерация через Puppeteer
- SSE стриминг прогресса

## Environment Variables

### Development (.env.local)
```bash
DATABASE_URL=postgresql://user:password@host:5432/database

# AI Provider
AI_PROVIDER=dummy                           # 'dummy' для бесплатной разработки, 'polza' для реального AI
OPENAI_API_KEY=sk-your-polza-api-key       # Только если AI_PROVIDER=polza
AI_BASE_URL=https://api.polza.ai/api/v1    # polza.ai endpoint

# Models (все опциональны, есть дефолты)
AI_MODEL_PAID=openai/gpt-4.1              # Генерация для платных
AI_MODEL_FREE=deepseek/deepseek-chat      # Генерация для бесплатных
AI_MODEL_AGENTS=openai/gpt-4.1-mini       # Агенты валидации
AI_MODEL_VERIFIER_STEM=google/gemini-3-flash-preview    # Верификатор STEM
AI_MODEL_VERIFIER_HUMANITIES=google/gemini-2.5-flash-lite # Верификатор гуманитарных
AI_MODEL_PRESENTATION=anthropic/claude-sonnet-4.5  # Презентации

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
- `users` -- пользователи (role, provider, generationsLeft, telegramChatId, wantsAlerts)
- `folders` -- папки для листов (вложенность, цвет, сортировка)
- `worksheets` -- рабочие листы (subject, grade, topic, difficulty, content JSON)
- `generations` -- лог генераций (status, errorMessage)
- `subscriptions` -- подписки (plan: free/basic/premium, status)
- `payments` -- платежи (amount в копейках, status)
- `payment_intents` -- интенты Prodamus (productCode, providerOrderId, metadata)
- `webhook_events` -- идемпотентность вебхуков (eventKey, rawPayloadHash)
- `refresh_tokens` -- JWT refresh tokens (jti, familyId, revokedAt)
- `presentations` -- презентации (subject, grade, topic, themeType, themePreset, slideCount, structure JSON, pptxBase64)

## Important Patterns

### Type Safety (Shared Layer)
Типы определены через Zod в `shared/worksheet.ts` и `shared/types.ts`:
- `Subject` = `'math' | 'algebra' | 'geometry' | 'russian'`
- `TaskTypeId` = `'single_choice' | 'multiple_choice' | 'open_question' | 'matching' | 'fill_blank'`
- `DifficultyLevel` = `'easy' | 'medium' | 'hard'`
- `WorksheetFormatId` = `'open_only' | 'test_only' | 'test_and_open'`
- `PresentationThemePreset` = `'professional' | 'educational' | 'minimal' | 'scientific'`
- `GenerateSchema` -- валидация формы (subject, grade 1-11, topic, taskTypes, difficulty, format, variantIndex)
- `GeneratePresentationPayload` -- валидация формы презентации

### SSE Progress Streaming
`POST /api/generate` и `POST /api/presentations/generate` стримят через SSE:
- `{ type: 'progress', percent: 0-100 }`
- `{ type: 'result', data: { worksheet } }` / `{ type: 'result', data: { presentation } }`
- `{ type: 'error', code, message }`

### Protected Routes
```typescript
import { withAuth, withAdminAuth, withOptionalAuth } from '../middleware/auth.js'

router.get('/protected', withAuth, (req, res) => { req.user!.id })
router.get('/admin', withAdminAuth, (req, res) => { })
router.get('/public', withOptionalAuth, (req, res) => { })
```

### API Endpoints Summary
- `POST /api/generate` -- генерация листа (SSE)
- `POST /api/generate/regenerate-task` -- перегенерация одного задания
- `POST /api/generate/rebuild-pdf` -- пересборка PDF без AI
- `POST /api/presentations/generate` -- генерация презентации (SSE)
- `GET/PATCH/DELETE /api/worksheets/:id` -- CRUD листов
- `GET/POST/PATCH/DELETE /api/folders` -- CRUD папок
- `/api/auth/*` -- аутентификация (Yandex, Telegram, refresh, logout)
- `/api/admin/*` -- админ-панель (stats, users, generations, payments, alerts)
- `/api/billing/*` -- платежи (create-link, webhook, payment-intent status)
- `POST /api/telegram/webhook` -- Telegram bot webhook
- `GET /api/health` -- healthcheck

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
6. Создать конфиг презентации `api/_lib/generation/config/presentations/subjects/newsubject.ts`
7. Обновить frontend (выбор предмета)
8. Добавить smoke tests

### Modifying Generation
1. Типы заданий: `api/_lib/generation/config/task-types.ts`
2. Форматы листов: `api/_lib/generation/config/worksheet-formats.ts`
3. Промпты: `api/_lib/generation/prompts.ts`
4. Конвертация в Worksheet: `api/_lib/ai-provider.ts` (convertToWorksheet)
5. PDF layout: `api/_lib/pdf.ts` (HTML шаблон)
6. Модели: `api/_lib/ai-models.ts`
7. Валидация: `api/_lib/ai/validator.ts`

### Modifying Presentations
1. Конфиги предметов: `api/_lib/generation/config/presentations/subjects/`
2. Шаблоны слайдов: `api/_lib/generation/config/presentations/templates/`
3. Генератор: `api/_lib/presentations/generator.ts`
4. PDF презентации: `api/_lib/presentations/pdf-generator.ts`
5. Frontend preview: `src/components/SlidePreview.tsx`

## Deployment

### Production (Dokploy)
1. Build: `npm run build`
2. Start: `npm run start` (runs `node dist-server/server.js`)
3. Port: `3000` (configurable via `PORT`)
4. Health check: `GET /api/health`

## Model Selection and Pricing

### via polza.ai

**Генерация листов (платные пользователи):**
- `openai/gpt-4.1` (~0.7 rub/лист)

**Генерация листов (бесплатные пользователи):**
- `deepseek/deepseek-chat` (дешевле)

**Валидация/верификация:**
- STEM: `google/gemini-3-flash-preview` (с reasoning)
- Гуманитарные: `google/gemini-2.5-flash-lite` (без reasoning)

**Презентации:**
- `anthropic/claude-sonnet-4.5`

**Не использовать** (reasoning models, 5-10x дороже):
- `openai/gpt-5-mini`, `openai/o1`, `openai/o3` -- генерируют лишние reasoning tokens

### Token Limits
- Generation: `max_tokens: 16000`
- Agents: определяется по типу агента

## Critical Notes

1. **Не коммитить API ключи** -- только через env variables
2. **Разные AUTH_SECRET для dev/prod**
3. **DummyProvider для локальной разработки** -- бесплатно, без API вызовов
4. **Config-driven генерация** -- новые предметы добавляются через конфиги, не код
5. **Grades 1-11** -- не только начальная школа, поддерживаются все классы
6. **5 типов заданий** -- single_choice, multiple_choice, open_question, matching, fill_blank
7. **Prodamus для платежей** -- webhook idempotency через webhook_events table
8. **PDF через Puppeteer** -- не pdfkit, HTML-шаблон конвертируется в PDF
9. **Разные модели для платных/бесплатных** -- gpt-4.1 vs deepseek-chat
10. **Мульти-агентная валидация** -- разные модели для STEM и гуманитарных предметов
11. **Презентации** -- отдельная подсистема с Claude, PPTX через pptxgenjs

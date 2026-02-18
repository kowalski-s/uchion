# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uchion -- AI-генератор рабочих листов и презентаций для школьников 1-11 классов (на русском языке). Генерирует структурированные задания разных типов с ответами, выдает PDF. Также генерирует учебные PPTX-презентации. Использует модели через polza.ai агрегатор с механизмом мульти-агентной валидации.

**Предметы**: Математика (1-6 класс), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11).

**Типы заданий**: единственный выбор, множественный выбор, открытый вопрос, соотнесение, вставка пропущенного.

**Презентации**: 3 активных темы оформления (professional, kids, school), 3 варианта объема (12/18/24 слайдов).

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
  - Presentations: pptxgenjs (PPTX)
- **Backend**: Express.js 5 (Node.js 20+)
  - REST API + SSE для стриминга прогресса генерации
  - Auth: Yandex OAuth (PKCE) + Email OTP (passwordless)
  - Database: PostgreSQL + Drizzle ORM
  - PDF: Puppeteer + @sparticuz/chromium (HTML -> PDF)
  - Payments: Prodamus (webhook-based)
  - Alerts: Telegram Bot для админов
  - Email: Unisender Go (OTP коды)
- **Shared Layer**: `shared/` -- единый источник типов/схем

### Key Directories
```
/server                 # Express server
  /routes              # API route handlers
    auth.ts            # Authentication (Yandex OAuth, Email OTP, JWT)
    generate.ts        # Worksheet generation (SSE)
    presentations.ts   # Presentation generation + CRUD (SSE)
    worksheets.ts      # Worksheet CRUD
    folders.ts         # Folder CRUD
    admin/             # Admin panel API (subdirectory)
      index.ts         # Admin router
      stats.ts         # Statistics
      users.ts         # User management
      generations.ts   # Generation logs
      payments.ts      # Payment logs
      alerts.ts        # Alert settings
      settings.ts      # Admin settings (Telegram chat ID)
      ai-costs.ts      # AI usage analytics
    billing.ts         # Prodamus payments
    telegram.ts        # Telegram bot webhook
    health.ts          # Health check
  /middleware          # Auth, rate-limit, cookies, audit-log, error-handler
/api                   # Backend utilities
  /_lib
    /generation        # Config-driven generation system
      /config
        /subjects      # Per-subject configs (math, algebra, geometry, russian)
          /math        # prompt.ts, grade-tiers.ts, difficulty.ts, index.ts
          /algebra     # prompt.ts, grade-tiers.ts, difficulty.ts, index.ts
          /geometry    # prompt.ts, grade-tiers.ts, difficulty.ts, index.ts
          /russian     # prompt.ts, grade-tiers.ts, difficulty.ts, index.ts
        /presentations # Presentation configs (subjects, templates)
          /subjects    # Presentation subject configs
          /templates   # Slide templates (minimalism, kids, school, types)
        task-types.ts
        worksheet-formats.ts
        difficulty.ts
        task-distribution.ts
        types.ts       # Config type definitions
      /validation      # Multi-agent validation system
        /agents        # Validation agents
          answer-verifier.ts
          task-fixer.ts
          quality-checker.ts
          content-checker.ts
          unified-checker.ts
          safe-json-parse.ts
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
      minimalism-generator.ts  # Minimalism template
      kids-generator.ts        # Kids template
      school-generator.ts      # School template
      pdf-generator.ts # Presentation PDF (Puppeteer)
      sanitize.ts      # HTML sanitization
    /ai                # AI modules (validator, schema, prompts)
    /auth              # Authentication (tokens, cookies, OAuth, encryption, audit-log)
    /alerts            # Alert system (generation-alerts)
    /telegram          # Telegram Bot API (bot, commands)
    pdf.ts             # Worksheet PDF generation (Puppeteer)
    ai-provider.ts     # AI provider orchestrator
    ai-models.ts       # Model selection logic (per subject, per tier, per grade)
    ai-usage.ts        # AI token usage and cost tracking
    email.ts           # Email sending (Unisender Go, OTP codes)
/src                   # Frontend React app
  /components          # UI components
    EditableWorksheetContent.tsx  # All 5 task types editing
    MathRenderer.tsx              # KaTeX rendering
    Header.tsx
    WorksheetManager.tsx
    EditModeToolbar.tsx
    UnsavedChangesDialog.tsx
    BuyGenerationsModal.tsx
    CookieConsent.tsx
    PdfTemplateModal.tsx
    /ui                # Reusable UI (CustomSelect)
    /presentations     # Presentation components (SlidePreview)
  /pages               # React Router pages (18 total)
    GeneratePage.tsx                  # Worksheet generation form
    GeneratePresentationPage.tsx      # Presentation generation form
    WorksheetPage.tsx                 # Session worksheet view/edit
    SavedWorksheetPage.tsx            # DB-backed worksheet view/edit
    WorksheetsListPage.tsx            # Saved worksheets list
    SavedPresentationPage.tsx         # Presentation view
    PresentationsListPage.tsx         # Saved presentations list
    DashboardPage.tsx                 # User dashboard
    LoginPage.tsx                     # Login (Yandex OAuth + Email OTP)
    PaymentSuccessPage.tsx
    PaymentCancelPage.tsx
    /admin                            # Admin panel (7 pages)
      AdminPage.tsx                   # Dashboard overview
      AdminUsersPage.tsx
      AdminUserDetailPage.tsx
      AdminGenerationsPage.tsx
      AdminPaymentsPage.tsx
      AdminSettingsPage.tsx           # Telegram alerts settings
      AdminAICostsPage.tsx            # AI usage analytics
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
  /presexample         # Presentation examples
  /alerts              # Alert system docs
/scripts               # Utility scripts (smoke tests, DB migrations, admin tools)
/fixtures              # Test fixtures (sample-worksheet.json)
/public/fonts          # Inter font files (TTF, WOFF2)
```

## AI Generation Flow

Система генерации полностью config-driven (`api/_lib/generation/`).

### 1. Конфигурация предметов (`api/_lib/generation/config/subjects/`)
Каждый предмет имеет отдельную директорию с файлами:
- `index.ts` -- основной конфиг
- `prompt.ts` -- системный промпт
- `grade-tiers.ts` -- темы по классам (из ФГОС)
- `difficulty.ts` -- настройки сложности

Диапазон классов: math: 1-6, algebra: 7-11, geometry: 7-11, russian: 1-11.

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
5. **Мульти-агентная валидация** (answer-verifier, task-fixer, quality-checker, unified-checker)
6. Конвертация в формат `Worksheet` (assignments + test + answers)
7. PDF генерация через Puppeteer (HTML -> PDF)
8. **AI usage tracking** -- логирование токенов и стоимости в таблицу `ai_usage`

### 5. Модели по типам (`api/_lib/ai-models.ts`)

| Назначение | Платные пользователи | Бесплатные пользователи |
|------------|---------------------|------------------------|
| Генерация листов | `gpt-4.1` (`AI_MODEL_PAID`) | `deepseek/deepseek-v3.2` (`AI_MODEL_FREE`) |
| Агенты валидации | `gpt-4.1-mini` (`AI_MODEL_AGENTS`) | -- |
| Верификатор (STEM 7-11) | `gemini-3-flash-preview` (reasoning: low) | -- |
| Верификатор (гуманитарные 7-11) | `gemini-2.5-flash-lite` (reasoning: off) | -- |
| Верификатор (1-6 классы) | `gpt-4.1-mini` (reasoning: off, дешевле) | -- |
| Фиксер (STEM 7-11) | `gemini-3-flash-preview` (reasoning: minimal) | -- |
| Презентации | `claude-sonnet-4.5` | -- |

**Grade-tiered verification**: Для математики 1-6 классов и русского 1-6 классов используется дешевая модель gpt-4.1-mini вместо Gemini (арифметика и базовая грамматика не требуют reasoning).

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
- 3 активных темы: professional, kids, school
- 10 типов слайдов: title, content, twoColumn, table, example, formula, diagram, chart, practice, conclusion
- PPTX генерация через `pptxgenjs`
- PDF генерация через Puppeteer
- SSE стриминг прогресса
- Max 15 презентаций на пользователя

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
AI_MODEL_FREE=deepseek/deepseek-v3.2      # Генерация для бесплатных
AI_MODEL_AGENTS=openai/gpt-4.1-mini       # Агенты валидации
AI_MODEL_VERIFIER_STEM=google/gemini-3-flash-preview    # Верификатор STEM
AI_MODEL_VERIFIER_HUMANITIES=google/gemini-2.5-flash-lite # Верификатор гуманитарных
AI_MODEL_PRESENTATION=anthropic/claude-sonnet-4.5  # Презентации

# Auth
AUTH_SECRET=your-dev-secret-min-32-chars

# OAuth (optional for local dev)
YANDEX_CLIENT_ID=xxx
YANDEX_CLIENT_SECRET=xxx

# Email OTP (optional for local dev)
UNISENDER_GO_API_KEY=xxx

# Telegram Bot (optional, for admin alerts)
TELEGRAM_BOT_TOKEN=xxx

# Payments (optional)
PRODAMUS_SECRET=xxx
PRODAMUS_PAYFORM_URL=https://your-shop.payform.ru/
APP_URL=http://localhost:3000
```

### Production
Те же переменные + разные секреты для dev/prod. Деплой через Dokploy на VPS.

### Provider Selection Logic (`api/_lib/ai-provider.ts`)
- `OpenAIProvider` если: `AI_PROVIDER=polza` или `=openai` (prod) или `=neuroapi`
- `ClaudeProvider` для презентаций (используется предпочтительно)
- Иначе `DummyProvider` (hardcoded ответ для разработки)

## Authentication

Два метода входа:
- **Yandex OAuth** -- OAuth 2.0 с PKCE
- **Email OTP** -- Passwordless вход через 6-значный код на email (Unisender Go)

Общая инфраструктура:
- **JWT tokens** -- Access (1h) + Refresh (7d) с ротацией и family tracking
- **httpOnly cookies** -- безопасное хранение
- **Rate limiting** -- Redis-backed с in-memory fallback

Key files:
- `api/_lib/auth/tokens.ts` -- JWT
- `api/_lib/auth/oauth.ts` -- PKCE, state validation (Yandex)
- `api/_lib/email.ts` -- Отправка OTP через Unisender Go
- `server/middleware/auth.ts` -- route protection
- `server/routes/auth.ts` -- auth endpoints

### Email OTP Flow
1. `POST /api/auth/email/send-code` -- отправляет 6-значный код на email
2. Код хранится в таблице `email_codes` (срок: 10 мин, max 5 попыток)
3. `POST /api/auth/email/verify-code` -- проверяет код (timing-safe comparison)
4. При успехе: создает/находит пользователя, выдает JWT токены

## Database Schema (`db/schema.ts`)

12 таблиц:
- `users` -- пользователи (role, provider: 'yandex'|'email', generationsLeft, telegramChatId, wantsAlerts)
- `folders` -- папки для листов и презентаций (вложенность, цвет, сортировка)
- `worksheets` -- рабочие листы (subject, grade, topic, difficulty, content JSON)
- `generations` -- лог генераций (status, errorMessage, startedAt, completedAt)
- `subscriptions` -- подписки (plan: free/basic/premium, status)
- `payments` -- платежи (amount в копейках, status)
- `payment_intents` -- интенты Prodamus (productCode, providerOrderId, metadata)
- `webhook_events` -- идемпотентность вебхуков (eventKey, rawPayloadHash)
- `refresh_tokens` -- JWT refresh tokens (jti, familyId, revokedAt)
- `email_codes` -- OTP коды (email, code, expiresAt, attempts, usedAt)
- `presentations` -- презентации (subject, grade, topic, themeType, themePreset, slideCount, structure JSON, pptxBase64)
- `ai_usage` -- трекинг AI вызовов (sessionId, callType, model, promptTokens, completionTokens, costKopecks, durationMs)

## Important Patterns

### Type Safety (Shared Layer)
Типы определены через Zod в `shared/worksheet.ts` и `shared/types.ts`:
- `Subject` = `'math' | 'algebra' | 'geometry' | 'russian'`
- `TaskTypeId` = `'single_choice' | 'multiple_choice' | 'open_question' | 'matching' | 'fill_blank'`
- `DifficultyLevel` = `'easy' | 'medium' | 'hard'`
- `WorksheetFormatId` = `'open_only' | 'test_only' | 'test_and_open'`
- `PresentationThemePreset` = `'professional' | 'educational' | 'minimal' | 'scientific' | 'kids' | 'school'`
- `GenerateSchema` -- валидация формы (subject, grade 1-11, topic, taskTypes, difficulty, format, variantIndex)
- `GeneratePresentationPayload` -- валидация формы презентации

### SSE Progress Streaming
`POST /api/generate` и `POST /api/presentations/generate` стримят через SSE:
- `{ type: 'progress', percent: 0-100 }`
- `{ type: 'result', data: { worksheet } }` / `{ type: 'result', data: { presentation } }`
- `{ type: 'error', code, message }`

### Protected Routes
```typescript
import { withAuth, withAdminAuth } from '../middleware/auth.js'

router.get('/protected', withAuth, (req, res) => { req.user!.id })
router.get('/admin', withAdminAuth, (req, res) => { })
```

### Error Handling
```typescript
import { ApiError } from '../middleware/error-handler.js'

throw ApiError.badRequest('Invalid input')
throw ApiError.unauthorized('Not authenticated')
throw ApiError.forbidden('Access denied')
throw ApiError.notFound('Resource not found')
throw ApiError.tooManyRequests('Rate limit exceeded')
throw ApiError.internal('Server error')
```

### API Endpoints Summary
- `POST /api/generate` -- генерация листа (SSE)
- `POST /api/generate/regenerate-task` -- перегенерация одного задания
- `POST /api/generate/rebuild-pdf` -- пересборка PDF без AI
- `POST /api/presentations/generate` -- генерация презентации (SSE)
- `GET/PATCH/DELETE /api/presentations/:id` -- CRUD презентаций
- `GET /api/presentations` -- список презентаций
- `GET/PATCH/DELETE /api/worksheets/:id` -- CRUD листов
- `GET /api/worksheets` -- список листов
- `GET/POST/PATCH/DELETE /api/folders` -- CRUD папок
- `/api/auth/me` -- текущий пользователь
- `/api/auth/logout` -- выход
- `/api/auth/refresh` -- обновление токена
- `/api/auth/yandex/redirect` -- начало Yandex OAuth
- `/api/auth/yandex/callback` -- callback Yandex OAuth
- `/api/auth/email/send-code` -- отправка OTP кода
- `/api/auth/email/verify-code` -- проверка OTP кода
- `/api/admin/*` -- админ-панель (stats, users, generations, payments, alerts, settings, ai-costs)
- `/api/billing/*` -- платежи (products, create-link, webhook, payment-status)
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
1. Создать директорию `api/_lib/generation/config/subjects/newsubject/` с файлами: index.ts, prompt.ts, grade-tiers.ts, difficulty.ts
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
7. Валидация: `api/_lib/generation/validation/`

### Modifying Presentations
1. Конфиги предметов: `api/_lib/generation/config/presentations/subjects/`
2. Шаблоны слайдов: `api/_lib/generation/config/presentations/templates/`
3. Генераторы тем: `api/_lib/presentations/` (kids-generator, school-generator, minimalism-generator)
4. PDF презентации: `api/_lib/presentations/pdf-generator.ts`

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
- `deepseek/deepseek-v3.2` (дешевле)

**Валидация/верификация:**
- STEM 7-11: `google/gemini-3-flash-preview` (с reasoning)
- Гуманитарные 7-11: `google/gemini-2.5-flash-lite` (без reasoning)
- 1-6 классы (все предметы): `openai/gpt-4.1-mini` (дешевый, без reasoning)

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
9. **Разные модели для платных/бесплатных** -- gpt-4.1 vs deepseek-v3.2
10. **Мульти-агентная валидация** -- разные модели для STEM и гуманитарных предметов
11. **Презентации** -- отдельная подсистема с Claude, PPTX через pptxgenjs, 3 активных темы
12. **Email OTP** -- passwordless вход через Unisender Go, не Telegram Login Widget
13. **Grade-tiered verification** -- 1-6 классы используют дешевую модель
14. **AI usage tracking** -- все AI вызовы логируются в таблицу ai_usage с токенами и стоимостью

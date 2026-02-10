# Tech Stack

## 1. Frontend

- **Framework**: React 18 (SPA)
- **Language**: TypeScript 5
- **Build Tool**: Vite 7
- **Routing**: React Router 6
- **State**: Zustand (global), React Query (async)
- **Styling**: Tailwind CSS 3 + Headless UI + tailwindcss-animate
- **Forms**: React Hook Form + Zod
- **Math**: KaTeX (рендеринг формул)
- **PDF (client)**: `pdf-lib` + `@pdf-lib/fontkit` (fallback/preview)
- **Presentations**: `pptxgenjs` (PPTX generation), `SlidePreview` (HTML preview)

## 2. Backend

- **Runtime**: Node.js 20+
- **Framework**: Express.js 5
- **Language**: TypeScript
- **API**: REST (JSON) + Server-Sent Events (SSE)
- **Validation**: Zod (shared schemas)
- **PDF**: Puppeteer Core + @sparticuz/chromium (HTML -> PDF)
- **Database**: PostgreSQL + Drizzle ORM
- **Payments**: Prodamus (webhook-based)
- **Rate Limiting**: rate-limiter-flexible (in-memory)

## 3. Authentication

- **Strategy**: Custom OAuth 2.0
- **Providers**: Yandex OAuth (PKCE), Telegram Login Widget (HMAC-SHA256)
- **Tokens**: JWT (access 1h + refresh 7d, rotation с family tracking)
- **Security**: PKCE, timing-safe comparisons, httpOnly cookies, SameSite=Lax

## 4. AI & Generation

### Модели (через polza.ai -- OpenAI SDK-compatible агрегатор)

| Назначение | Модель | Env var |
|------------|--------|---------|
| Генерация (платные) | `openai/gpt-4.1` | `AI_MODEL_PAID` |
| Генерация (бесплатные) | `deepseek/deepseek-chat` | `AI_MODEL_FREE` |
| Агенты валидации | `openai/gpt-4.1-mini` | `AI_MODEL_AGENTS` |
| Верификатор (STEM) | `google/gemini-3-flash-preview` | `AI_MODEL_VERIFIER_STEM` |
| Верификатор (гуманитарные) | `google/gemini-2.5-flash-lite` | `AI_MODEL_VERIFIER_HUMANITIES` |
| Презентации | `anthropic/claude-sonnet-4.5` | `AI_MODEL_PRESENTATION` |

### Конфигурация
- **Architecture**: Config-driven generation (`api/_lib/generation/config/`)
- **Task Types**: single_choice, multiple_choice, open_question, matching, fill_blank
- **Formats**: open_only, test_only, test_and_open (с вариантами количества)
- **Validation**: Мульти-агентная (answer-verifier, task-fixer, quality-checker)
- **Development**: `DummyProvider` (бесплатно, без API)

### Презентации
- **Генерация**: Claude (claude-sonnet-4.5)
- **Темы**: professional, educational, minimal, scientific
- **Слайды**: 12/18/24
- **Типы слайдов**: title, content, twoColumn, table, example, formula, diagram, chart, practice, conclusion
- **PPTX**: pptxgenjs
- **PDF**: Puppeteer

## 5. Shared Layer

- **Path**: `shared/`
- **Files**:
  - `worksheet.ts` -- Zod schemas, TypeScript типы (Subject, Worksheet, GenerateSchema)
  - `types.ts` -- Presentation types, dashboard types, error codes
- **Цель**: единый контракт frontend-backend

## 6. Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Migrations**: `drizzle-kit`
- **Tables** (10):
  - `users` -- пользователи (role, provider, generationsLeft, telegramChatId, wantsAlerts)
  - `folders` -- папки (вложенность через parentId, цвет, сортировка)
  - `worksheets` -- рабочие листы (subject, grade, topic, difficulty, content JSON)
  - `generations` -- лог генераций (status, errorMessage)
  - `subscriptions` -- подписки (plan: free/basic/premium, status)
  - `payments` -- платежи (amount в копейках, status)
  - `payment_intents` -- интенты Prodamus (productCode, providerOrderId, metadata)
  - `webhook_events` -- идемпотентность вебхуков (eventKey, rawPayloadHash)
  - `refresh_tokens` -- JWT refresh tokens (jti, familyId)
  - `presentations` -- презентации (subject, grade, topic, themeType, slideCount, structure JSON, pptxBase64)

## 7. Infrastructure & QA

- **Hosting**: VPS via Dokploy
- **Local Dev**:
  - `npm run dev` (Vite + Express concurrent)
  - Proxy: Vite proxies `/api` -> `localhost:3000`
- **Testing**:
  - Unit: Vitest
  - E2E: Playwright
  - Smoke: `tsx scripts/smoke-generate.ts`

## 8. Key Dependencies

### Production
```
express           # Web framework (v5)
drizzle-orm       # Database ORM
openai            # AI integration (OpenAI SDK)
puppeteer-core    # PDF generation (HTML -> PDF)
@sparticuz/chromium  # Chromium for Puppeteer
pptxgenjs         # PPTX presentation generation
pdf-lib           # Client-side PDF fallback
@pdf-lib/fontkit  # Custom fonts for pdf-lib
katex             # Math formula rendering
zod               # Validation (shared schemas)
react             # UI framework
zustand           # State management
@tanstack/react-query  # Async state
react-hook-form   # Form handling
@headlessui/react # Accessible UI components
tailwindcss-animate  # Animation utilities
cookie-parser     # Cookie parsing
ioredis           # Redis client (rate limiting)
rate-limiter-flexible  # Rate limiting
dotenv            # Environment variables
postgres          # PostgreSQL driver
```

### Development
```
vite              # Frontend build (v7)
typescript        # Type checking (v5)
vitest            # Unit tests
@vitest/ui        # Test UI
@playwright/test  # E2E tests
drizzle-kit       # DB migrations
tsx               # TypeScript execution
concurrently      # Parallel processes
autoprefixer      # CSS post-processing
postcss           # CSS toolchain
tailwindcss       # Utility-first CSS
```

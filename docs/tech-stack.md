# Tech Stack

## 1. Frontend

- **Framework**: React 18 (SPA)
- **Language**: TypeScript 5
- **Build Tool**: Vite 7
- **Routing**: React Router 6
- **State**: Zustand (global), React Query (async)
- **Styling**: Tailwind CSS 3 + Headless UI
- **Forms**: React Hook Form + Zod
- **Math**: KaTeX (рендеринг формул)
- **PDF (client)**: `pdf-lib` (fallback/preview)

## 2. Backend

- **Runtime**: Node.js 20+
- **Framework**: Express.js 5
- **Language**: TypeScript
- **API**: REST (JSON) + Server-Sent Events (SSE)
- **Validation**: Zod (shared schemas)
- **PDF**: `pdfkit` (server-side)
- **Database**: PostgreSQL + Drizzle ORM
- **Payments**: Prodamus (webhook-based)

## 3. Authentication

- **Strategy**: Custom OAuth 2.0
- **Providers**: Yandex OAuth, Telegram Login Widget
- **Tokens**: JWT (access 1h + refresh 7d, rotation)
- **Security**: PKCE, timing-safe comparisons, httpOnly cookies

## 4. AI & Generation

- **Generation Model**: `gpt-4.1-mini` (default, configurable через `AI_MODEL_GENERATION`)
- **Validation Model**: `gpt-4.1-nano` (default, configurable через `AI_MODEL_VALIDATION`)
- **Provider**: polza.ai (OpenAI SDK-compatible агрегатор)
- **Integration**: OpenAI Node.js SDK
- **Architecture**: Config-driven generation (`api/_lib/generation/config/`)
- **Task Types**: single_choice, multiple_choice, open_question, matching, fill_blank
- **Formats**: open_only, test_only, test_and_open (с вариантами количества)
- **Development**: `DummyProvider` (бесплатно, без API)

## 5. Shared Layer

- **Path**: `shared/`
- **Content**: Zod schemas, TypeScript типы
- **Цель**: единый контракт frontend-backend

## 6. Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Migrations**: `drizzle-kit`
- **Tables**: users, folders, worksheets, generations, subscriptions, payments, payment_intents, webhook_events, refresh_tokens

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
openai            # AI integration
pdfkit            # Server PDF (NOT in package.json -- via api/_lib/pdf.ts)
pdf-lib           # Client PDF (fallback)
katex             # Math formula rendering
zod               # Validation
react             # UI framework
zustand           # State management
@tanstack/react-query  # Async state
react-hook-form   # Form handling
cookie-parser     # Cookie parsing
puppeteer-core    # Browser automation (PDF?)
```

### Development
```
vite              # Frontend build (v7)
typescript        # Type checking (v5)
vitest            # Unit tests
playwright        # E2E tests
drizzle-kit       # DB migrations
tsx               # TypeScript execution
concurrently      # Parallel processes
```

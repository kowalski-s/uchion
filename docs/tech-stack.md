# Tech Stack Overview

## 1. Frontend

- **Framework**: React 18 (SPA)
- **Language**: TypeScript 5
- **Build Tool**: Vite 7
- **Routing**: React Router 6
- **State Management**: Zustand (global store), React Query (async state)
- **Styling**: Tailwind CSS + Headless UI
- **Forms**: React Hook Form + Zod
- **PDF Generation (Client)**: `pdf-lib` (fallback/preview)

## 2. Backend

- **Runtime**: Node.js 20+
- **Framework**: Express.js 5
- **Language**: TypeScript
- **API Style**: REST (JSON) + Server-Sent Events (SSE)
- **Validation**: Zod (shared schemas)
- **PDF Generation (Server)**: `pdfkit`
- **Database**: PostgreSQL + Drizzle ORM

## 3. Authentication

- **Strategy**: Custom OAuth 2.0
- **Providers**: Yandex OAuth, Telegram Login Widget
- **Tokens**: JWT (access 1h + refresh 7d with rotation)
- **Security**: PKCE, timing-safe comparisons, httpOnly cookies

## 4. AI & ML

- **Generation Model**: `gpt-5-mini`
- **Validation Model**: `gpt-4.1-mini`
- **Integration**: OpenAI Node.js SDK
- **Structured Output**: Zod schemas
- **Validator**: Custom LLM-based validation module

## 5. Shared Layer

- **Path**: `shared/`
- **Content**: Zod schemas, TypeScript interfaces
- **Goal**: Guarantee client-server compatibility

## 6. Database

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Hosting**: Supabase (current) or self-hosted
- **Migrations**: `drizzle-kit`

## 7. Infrastructure & QA

- **Hosting**: Self-hosted VPS via Dokploy
- **Local Dev**:
  - `npm run dev` (Vite + Express concurrent)
  - Proxy: Vite proxies `/api` → `localhost:3000`
- **Testing**:
  - Unit: Vitest
  - E2E: Playwright
  - Smoke: `tsx scripts/smoke-generate.ts`
- **Linting**: ESLint + Prettier

## 8. Key Dependencies

### Production
```
express           # Web framework
drizzle-orm       # Database ORM
openai            # AI integration
pdf-lib           # Client PDF
pdfkit (planned)  # Server PDF (via puppeteer-core)
zod               # Validation
react             # UI framework
zustand           # State management
@tanstack/react-query  # Async state
react-hook-form   # Form handling
```

### Development
```
vite              # Frontend build
typescript        # Type checking
vitest            # Unit tests
playwright        # E2E tests
drizzle-kit       # DB migrations
tsx               # TypeScript execution
concurrently      # Parallel processes
```

# Tech Stack Overview

## 1. Frontend

- **Framework**: React 18 (SPA).
- **Language**: TypeScript 5.
- **Build Tool**: Vite.
- **Routing**: React Router 6.
- **State Management**: Zustand (Global Store), React Query (Async State).
- **Styling**: Tailwind CSS + shadcn/ui.
- **Forms**: React Hook Form + Zod.
- **PDF Generation (Client)**: `pdf-lib` (для быстрого превью/фолбека).

## 2. Backend

- **Runtime**: Node.js 18+ (Vercel Serverless Functions).
- **API Style**: REST (JSON) + Server-Sent Events (SSE).
- **Validation**: Zod (Shared Schema).
- **PDF Generation (Server)**: `pdfkit` (для продакшн-качества).

## 3. AI & ML

- **Generation Model**: `gpt-5-mini`.
- **Validation Model**: `gpt-4.1-mini`.
- **Integration**: OpenAI Node.js SDK.
- **Structured Output**: Zod Schemas.
- **Validator**: Самописный модуль валидации на базе LLM.

## 4. Shared Layer

- **Path**: `shared/`
- **Content**: Zod схемы, TypeScript интерфейсы.
- **Goal**: Гарантия совместимости клиент-сервер.

## 5. Инфраструктура и QA

- **Hosting**: Vercel (Frontend + Functions).
- **Local Dev**:
  - `npm run dev` (Vite) + `vercel dev` (Functions).
  - Proxy: Vite proxy `/api` → `localhost:3000`.
- **Testing**:
  - Smoke Tests: `tsx scripts/smoke-generate.ts`.
  - PDF Visual Tests: `scripts/dump-pdf.ts`.
- **Linting**: ESLint + Prettier.

# Architecture Overview

## 1. General Concept

Uchion is a web service for generating worksheets for elementary school (grades 1-4) using artificial intelligence. The project implements a complete cycle: from teacher's topic input to generating a print-ready PDF file.

## 2. System Architecture

The system is built as a **Monorepo** with clear separation of concerns:

### 2.1 Client Side (Frontend)
- **Technologies**: React 18, Vite, TypeScript, Tailwind CSS
- **Routing**: SPA (Single Page Application) with React Router
  - `/` - Generation page (`GeneratePage`)
  - `/worksheet/:id` - View and download page (`WorksheetPage`)
  - `/dashboard` - User dashboard (authenticated)
- **State**: Zustand (global store) + React Query (async state)
- **API Interaction**: `fetch` + Server-Sent Events (SSE) for progress streaming

### 2.2 Server Side (Backend)
- **Technologies**: Express.js (Node.js 20+)
- **API Style**: RESTful JSON + SSE for streaming
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Custom OAuth 2.0 (Yandex, Telegram)
- **Key Endpoints**:
  - `POST /api/generate` - Worksheet generation (SSE)
  - `GET/POST/PATCH/DELETE /api/worksheets` - CRUD operations
  - `GET/POST/PATCH/DELETE /api/folders` - Folder management
  - `/api/auth/*` - Authentication endpoints

### 2.3 Shared Layer
- **Path**: `shared/`
- **Purpose**: Single source of truth for types and data schemas. Used by both client and server to guarantee contract consistency.

---

## 3. Data Flow

1. **Request**: User fills form (Subject, Grade, Topic) → Client sends `POST /api/generate`
2. **Generation (Server)**:
   - API calls `AIProvider`
   - `AIProvider` selects strategy (OpenAI for Prod, Dummy for Dev)
   - Draft JSON generated via LLM
3. **Validation and Regeneration**:
   - Draft passes through `Validator` (LLM-based quality check)
   - If errors found, partial regeneration of problem blocks starts
   - Process repeats until success or attempts exhausted
4. **Assembly**:
   - Final JSON converted to `Worksheet` object
   - PDF generated (Base64) on server
5. **Response**: Server streams events (Progress → Result) via SSE to client
6. **Render**: Client displays worksheet and offers PDF download

---

## 4. Key Modules

### AI Provider (`api/_lib/ai-provider.ts`)
Abstraction over LLM.
- **DummyProvider**: Local stub for development (free, works offline)
- **OpenAIProvider**: Production solution. Uses GPT models with optional Vector Store context.

### Validator (`api/_lib/ai/validator.ts`)
Quality control module.
- Analyzes structure and content
- Identifies logical errors (e.g., incorrect test answer)
- Manages self-correction cycle

### PDF Generator
Server-side generation:
- **Server (`api/_lib/pdf.ts`)**: Uses `pdfkit` for production-quality PDFs
- **Client (`src/lib/pdf-client.ts`)**: Uses `pdf-lib` for backup/preview

### Authentication (`server/routes/auth.ts`, `api/_lib/auth/`)
Custom OAuth 2.0 implementation:
- Yandex OAuth with PKCE
- Telegram Login Widget
- JWT tokens (access + refresh) with rotation
- Rate limiting per endpoint

---

## 5. Infrastructure

- **Hosting**: Self-hosted VPS via Dokploy
- **CI/CD**: Git push → Dokploy auto-deploy
- **Database**: PostgreSQL (Supabase or self-hosted)
- **Environment**:
  - `dev`: Vite + Express, Dummy AI
  - `prod`: Express server, OpenAI

---

## 6. Directory Structure

```
uchion/
├── server.ts              # Express entry point
├── server/
│   ├── routes/            # API route handlers
│   │   ├── auth.ts        # Authentication
│   │   ├── generate.ts    # AI generation
│   │   ├── worksheets.ts  # Worksheet CRUD
│   │   ├── folders.ts     # Folder CRUD
│   │   └── health.ts      # Health check
│   └── middleware/
│       ├── auth.ts        # Auth middleware
│       ├── cookies.ts     # Cookie handling
│       └── rate-limit.ts  # Rate limiting
├── api/
│   └── _lib/
│       ├── ai/            # AI modules
│       │   ├── prompts.ts # System prompts
│       │   ├── schema.ts  # JSON schemas
│       │   └── validator.ts
│       ├── auth/          # Auth utilities
│       │   ├── tokens.ts  # JWT handling
│       │   ├── oauth.ts   # OAuth helpers
│       │   └── cookies.ts # Cookie config
│       ├── ai-provider.ts # AI abstraction
│       └── pdf.ts         # PDF generation
├── src/                   # React frontend
├── shared/                # Shared types
├── db/                    # Database schema
└── docs/                  # Documentation
```

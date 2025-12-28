# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uchion is an AI-powered worksheet generator for elementary school (grades 1-4) in Russian. It generates structured educational worksheets with assignments, tests, and answers in PDF format. The system uses OpenAI models (gpt-5-mini for generation, gpt-4.1-mini for validation) with a self-correction validation loop.

**Key subjects**: Math and Russian language (following Russian FGOS educational standards).

## Development Commands

### Local Development
```bash
npm run dev              # Start Vite dev server (frontend only)
vercel dev              # Run full stack locally (frontend + serverless functions)
```

**Important**: Use `vercel dev` for testing API endpoints locally. The Vite dev server proxies `/api` to `localhost:3000`.

### Testing
```bash
npm run smoke           # Run smoke tests against all subject/grade combinations
SMOKE_REAL_AI=true npm run smoke  # Run smoke tests with real OpenAI (costs money)
```

### Build & Preview
```bash
npm run build           # Production build
npm run preview         # Preview production build
```

## Architecture

### Monorepo Structure
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
  - SPA with React Router
  - State: Zustand (sessions) + React Query (async)
  - Forms: React Hook Form + Zod validation
- **Backend**: Vercel Serverless Functions (Node.js)
  - Single endpoint: `POST /api/generate`
  - Responds via Server-Sent Events (SSE) for progress streaming
- **Shared Layer**: `shared/types.ts` - Single source of truth for types/schemas used by both client and server

### Key Directories
```
/api                    # Serverless functions (backend)
  /_lib                # Backend utilities
    /ai                # AI-specific modules (prompts, schema, validator)
    ai-provider.ts     # AI provider abstraction (OpenAI vs Dummy)
    pdf.ts             # Server-side PDF generation (pdfkit)
  generate.ts          # Main API endpoint
/src                   # Frontend React app
  /components          # UI components
  /pages               # React Router pages (GeneratePage, WorksheetPage)
  /lib                 # Frontend utilities (API client, schemas, pdf-lib)
  /store               # Zustand state management
/shared                # Shared types between frontend/backend
/docs                  # Architecture documentation
/scripts               # Testing scripts (smoke tests, PDF dumps)
```

## AI Generation Flow

The system implements a **two-phase generation-validation loop**:

1. **Generation Phase** (`api/_lib/ai-provider.ts`):
   - Model: `gpt-5-mini`
   - Uses subject-specific system prompts from `api/_lib/ai/prompts.ts`
   - Optional: Retrieves context from Vector Store (if `UCHION_VECTOR_STORE_ID` is set)
   - Outputs structured JSON matching `WORKSHEET_JSON_SCHEMA`

2. **Validation Phase** (`api/_lib/ai/validator.ts`):
   - Model: `gpt-4.1-mini`
   - Analyzes generated content for:
     - Structural correctness (7 assignments, 10 test questions)
     - Educational quality (age-appropriate, follows FGOS)
     - Answer correctness
     - Topic relevance
   - Returns validation score (0-10) and list of issues

3. **Self-Correction (CLEAN step)**:
   - If validation fails, identifies problem blocks (specific assignments or tests)
   - Regenerates only the problematic sections via `regenerateProblemBlocks`
   - Re-validates the patched result
   - Falls back to best attempt if score 10 is not achieved

4. **PDF Generation**:
   - Server-side using `pdfkit` in `api/_lib/pdf.ts`
   - Returns Base64-encoded PDF for download

## Environment Variables

### Development (.env.local)
```bash
AI_PROVIDER=dummy           # Use 'dummy' for local dev (free, no API calls)
# OPENAI_API_KEY=xxx        # Not needed if using dummy provider
```

### Production (Vercel)
```bash
AI_PROVIDER=openai          # Required for production
OPENAI_API_KEY=xxx          # Required for production
UCHION_VECTOR_STORE_ID=xxx  # Optional: enables RAG context retrieval
```

**Provider Selection Logic** (`api/_lib/ai-provider.ts`):
- Uses `OpenAIProvider` if `NODE_ENV=production` AND `AI_PROVIDER=openai` AND `OPENAI_API_KEY` is set
- Otherwise uses `DummyProvider` (returns hardcoded math worksheet)

## Important Patterns

### Type Safety (Shared Layer)
All data structures are defined in `shared/types.ts` with Zod schemas. Both frontend and backend import from this single source to maintain contract consistency.

**Key types**:
- `WorksheetJson` - Internal AI response format (strict structured output)
- `Worksheet` - Final format sent to client (includes PDF)
- `GeneratePayload` - API request params

### SSE Progress Streaming
The `/api/generate` endpoint uses Server-Sent Events to stream progress:
- Progress events: `{ type: 'progress', percent: 0-100 }`
- Success: `{ type: 'result', data: { worksheet } }`
- Error: `{ type: 'error', code, message }`

Frontend consumes via `EventSource` in `src/lib/api.ts`.

### AI Prompts Configuration
Subject-specific prompts are stored in `api/_lib/ai/prompts.ts` under `SUBJECT_CONFIG`:
- `RUSSIAN_SYSTEM_PROMPT` - Focuses on FGOS orthography, word transfer rules
- `MATH_SYSTEM_PROMPT` - Grade-appropriate arithmetic, word problems, geometry

When modifying prompts, ensure they:
1. Specify exact output structure (7 assignments, 10 tests)
2. Enforce age-appropriate content per grade level
3. Include FGOS compliance requirements

### PDF Generation Duality
- **Server** (`api/_lib/pdf.ts`): Production-quality PDF using `pdfkit`
- **Client** (`src/lib/pdf-client.ts`): Backup/preview using `pdf-lib`

Most users will only interact with server-generated PDFs.

## Testing Strategy

### Smoke Tests (`scripts/smoke-generate.ts`)
- Tests all combinations: 2 subjects × 4 grades = 8 test cases
- Validates:
  - Worksheet schema compliance
  - Correct counts (7 assignments, 10 tests)
  - Non-empty PDF generation
- Run with `npm run smoke` (uses DummyProvider, fast)
- Run with `SMOKE_REAL_AI=true npm run smoke` (uses OpenAI, costs money, slower)

**When to run smoke tests**:
- After modifying AI provider logic
- After changing worksheet schemas
- Before deploying to production

### Manual PDF Testing (`scripts/dump-pdf.ts`)
Visual inspection of PDF output quality.

## Common Modifications

### Adding a New Subject
1. Add subject to `SubjectSchema` in `shared/types.ts`
2. Create new system prompt in `api/_lib/ai/prompts.ts` under `SUBJECT_CONFIG`
3. Update frontend subject selector in `src/pages/GeneratePage.tsx`
4. Add test cases to smoke tests

### Modifying Worksheet Structure
1. Update `WORKSHEET_JSON_SCHEMA` in `api/_lib/ai/schema.ts` (AI output format)
2. Update corresponding types in `shared/types.ts`
3. Update parser in `api/_lib/ai-provider.ts` (`parseWorksheetText` method)
4. Update PDF layout in `api/_lib/pdf.ts` (`buildPdf` function)
5. Update validation logic in `api/_lib/ai/validator.ts`

### Adjusting Validation Strictness
Modify validation prompts and scoring in `api/_lib/ai/validator.ts`:
- `validateWorksheet` - Main validation function
- `analyzeValidationIssues` - Categorizes issues by type
- `regenerateProblemBlocks` - Handles self-correction

## Deployment

Deployed on Vercel with automatic deploys from `main` branch.

**Vercel Configuration** (`vercel.json`):
- API routes: `/api/*` → serverless functions
- SPA fallback: `/*` → `index.html`

**Build Output**:
- Frontend: Static files in `dist/`
- Functions: `api/*.ts` compiled to Node.js functions

## Critical Notes

1. **Never commit API keys** - Use environment variables via Vercel dashboard
2. **Validate all AI outputs** - The validation loop is critical for quality control
3. **Grade-level accuracy matters** - Content must match Russian FGOS standards for elementary school
4. **SSE connections have timeouts** - Vercel Functions have 10s timeout on Hobby plan, 60s on Pro
5. **Token limits** - `max_output_tokens: 6000` prevents cost overruns
6. **Dummy provider** - Always use for local dev to avoid API costs

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Uchion is an AI-powered worksheet generator for elementary school (grades 1-4) in Russian. It generates structured educational worksheets with assignments, tests, and answers in PDF format. The system uses OpenAI models (gpt-5-mini for generation, gpt-4.1-mini for validation) with a self-correction validation loop.

**Key subjects**: Math and Russian language (following Russian FGOS educational standards).

## Development Commands

### Local Development
```bash
npm run dev              # Start both frontend (Vite) and backend (Express) servers
npm run dev:frontend     # Start Vite dev server only (port 5173)
npm run dev:server       # Start Express API server only (port 3000)
```

**Important**: Use `npm run dev` for full-stack development. Vite proxies `/api` requests to the Express server on `localhost:3000`.

### Testing
```bash
npm run smoke                     # Run smoke tests (uses DummyProvider)
SMOKE_REAL_AI=true npm run smoke  # Run with real OpenAI (costs money)
npm run test                      # Run unit tests (Vitest)
npm run test:e2e                  # Run E2E tests (Playwright)
```

### Build & Production
```bash
npm run build            # Build frontend (Vite) + backend (TypeScript)
npm run start            # Start production server (node dist-server/server.js)
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
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
  - SPA with React Router
  - State: Zustand (sessions) + React Query (async)
  - Forms: React Hook Form + Zod validation
- **Backend**: Express.js (Node.js)
  - RESTful API with SSE for progress streaming
  - Authentication: Custom OAuth 2.0 (Yandex, Telegram)
  - Database: PostgreSQL with Drizzle ORM
- **Shared Layer**: `shared/` - Single source of truth for types/schemas

### Key Directories
```
/server                 # Express server
  /routes              # API route handlers
  /middleware          # Auth, rate-limit, cookies
/api                   # Legacy Vercel functions (being deprecated)
  /_lib                # Backend utilities (AI, PDF, auth)
    /ai                # AI-specific modules (prompts, schema, validator)
    /auth              # Authentication (tokens, cookies, OAuth)
/src                   # Frontend React app
  /components          # UI components
  /pages               # React Router pages
  /lib                 # Frontend utilities
  /store               # Zustand state management
/shared                # Shared types between frontend/backend
/db                    # Database schema and migrations
/docs                  # Architecture documentation
/scripts               # Testing scripts
```

## AI Generation Flow

The system implements a **two-phase generation-validation loop**:

1. **Generation Phase** (`api/_lib/ai-provider.ts`):
   - Model: Configurable via `AI_MODEL_GENERATION` (default: `openai/gpt-4.1-mini` on polza.ai)
   - Uses subject-specific system prompts from `api/_lib/ai/prompts.ts`
   - Optional: Retrieves context from Vector Store (if `UCHION_VECTOR_STORE_ID` is set - OpenAI only)
   - Outputs structured JSON matching `WORKSHEET_JSON_SCHEMA`
   - Token limit: `max_tokens: 6000` to prevent cost overruns

2. **Validation Phase** (`api/_lib/ai/validator.ts`):
   - Model: Configurable via `AI_MODEL_VALIDATION` (default: `openai/gpt-4.1-nano` on polza.ai)
   - Analyzes generated content for:
     - Structural correctness (7 assignments, 10 test questions)
     - Educational quality (age-appropriate, follows FGOS)
     - Answer correctness
     - Topic relevance
   - Returns validation score (0-10) and list of issues
   - Token limit: `max_tokens: 600` for cost efficiency

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
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# AI Provider - polza.ai (aggregator with 250+ models)
AI_PROVIDER=polza                           # Use 'dummy' for free local dev (no API calls)
OPENAI_API_KEY=sk-your-polza-api-key       # Get from https://polza.ai
AI_BASE_URL=https://api.polza.ai/api/v1    # polza.ai endpoint

# Models (format: provider/model-name)
# Recommended: GPT-4.1 family for best quality/price (~0.17₽ per worksheet)
AI_MODEL_GENERATION=openai/gpt-4.1-mini    # Cost-efficient generation
AI_MODEL_VALIDATION=openai/gpt-4.1-nano    # Ultra-cheap validation

# Auth
AUTH_SECRET=your-dev-secret-min-32-chars   # JWT signing secret

# OAuth (optional for local dev)
YANDEX_CLIENT_ID=xxx
YANDEX_CLIENT_SECRET=xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_BOT_USERNAME=xxx
VITE_TELEGRAM_BOT_USERNAME=xxx
```

### Production (Dokploy)
```bash
# Database
DATABASE_URL=postgresql://...

# AI Provider - polza.ai
AI_PROVIDER=polza
OPENAI_API_KEY=sk-prod-polza-api-key
AI_BASE_URL=https://api.polza.ai/api/v1

# Models - GPT-4.1 family recommended (~0.17₽ per worksheet)
AI_MODEL_GENERATION=openai/gpt-4.1-mini
AI_MODEL_VALIDATION=openai/gpt-4.1-nano
# Alternative: openai/gpt-4.1 for both (higher quality, ~0.7₽ per worksheet)

# Optional: Vector Store (only works with direct OpenAI, not through polza.ai)
# UCHION_VECTOR_STORE_ID=vs_...

# Auth (use different secret than dev!)
AUTH_SECRET=production-secret-min-32-chars

# OAuth
YANDEX_CLIENT_ID=xxx
YANDEX_CLIENT_SECRET=xxx
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_BOT_USERNAME=xxx
VITE_TELEGRAM_BOT_USERNAME=xxx
```

**Provider Selection Logic** (`api/_lib/ai-provider.ts`):
- Uses `OpenAIProvider` if:
  - (`NODE_ENV=production` AND `AI_PROVIDER=openai` AND `OPENAI_API_KEY` is set) OR
  - (`AI_PROVIDER=polza` AND `OPENAI_API_KEY` is set) OR
  - (`AI_PROVIDER=neuroapi` AND `OPENAI_API_KEY` is set - legacy)
- Otherwise uses `DummyProvider` (returns hardcoded math worksheet for free local development)

**Note**: polza.ai is fully OpenAI SDK-compatible, so the same `OpenAIProvider` class works for all providers by changing the `baseURL` parameter.

## Authentication

Custom OAuth 2.0 implementation with:
- **Yandex OAuth** - Primary login method
- **Telegram Login Widget** - Secondary login method
- **JWT tokens** - Access (1h) + Refresh (7d) with rotation
- **httpOnly cookies** - Secure token storage
- **Rate limiting** - In-memory (Redis planned)

Key files:
- `api/_lib/auth/tokens.ts` - JWT signing/verification
- `api/_lib/auth/oauth.ts` - PKCE, state validation
- `server/middleware/auth.ts` - Route protection
- `server/routes/auth.ts` - Auth endpoints

## Important Patterns

### Type Safety (Shared Layer)
All data structures are defined with Zod schemas. Both frontend and backend import from `shared/` to maintain contract consistency.

**Key types** (`shared/worksheet.ts`):
- `WorksheetJson` - Internal AI response format
- `Worksheet` - Final format sent to client
- `GeneratePayload` - API request params

### SSE Progress Streaming
The `/api/generate` endpoint uses Server-Sent Events to stream progress:
- Progress events: `{ type: 'progress', percent: 0-100 }`
- Success: `{ type: 'result', data: { worksheet } }`
- Error: `{ type: 'error', code, message }`

### Protected Routes
Use middleware from `server/middleware/auth.ts`:
```typescript
import { withAuth, withAdminAuth, withOptionalAuth } from '../middleware/auth.js'

// Requires authentication
router.get('/protected', withAuth, (req, res) => {
  const userId = req.user!.id
})

// Requires admin role
router.get('/admin', withAdminAuth, (req, res) => { })

// Optional auth (userId may be undefined)
router.get('/public', withOptionalAuth, (req, res) => { })
```

## Testing Strategy

### Smoke Tests (`scripts/smoke-generate.ts`)
- Tests all combinations: 2 subjects × 4 grades = 8 test cases
- Validates worksheet schema compliance, counts, PDF generation
- Run with `npm run smoke` (DummyProvider) or `SMOKE_REAL_AI=true npm run smoke` (OpenAI)

### Unit Tests (Vitest)
- `npm run test` - Watch mode
- `npm run test:run` - Single run
- `npm run test:coverage` - With coverage

### E2E Tests (Playwright)
- `npm run test:e2e` - Headless
- `npm run test:e2e:ui` - Interactive UI

## Common Modifications

### Adding a New Subject
1. Add subject to `SubjectSchema` in `shared/types.ts`
2. Create system prompt in `api/_lib/ai/prompts.ts` under `SUBJECT_CONFIG`
3. Update frontend subject selector
4. Add smoke test cases

### Modifying Worksheet Structure
1. Update `WORKSHEET_JSON_SCHEMA` in `api/_lib/ai/schema.ts`
2. Update types in `shared/types.ts`
3. Update parser in `api/_lib/ai-provider.ts`
4. Update PDF layout in `api/_lib/pdf.ts`
5. Update validation in `api/_lib/ai/validator.ts`

## Deployment

### Production Setup (Dokploy)
1. Build: `npm run build`
2. Start: `npm run start` (runs `node dist-server/server.js`)
3. Port: `3000` (configurable via `PORT` env var)
4. Health check: `GET /api/health`

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
COPY dist-server/ ./dist-server/
COPY public/ ./public/
EXPOSE 3000
CMD ["node", "dist-server/server.js"]
```

## Model Selection and Pricing

### Recommended Models (via polza.ai)

**Best Quality/Price Balance:**
- Generation: `openai/gpt-4.1-mini` (~0.15₽ per worksheet)
- Validation: `openai/gpt-4.1-nano` (~0.02₽ per validation)
- **Total: ~0.17₽ per complete worksheet**

**Higher Quality (2-4x more expensive):**
- Generation: `openai/gpt-4.1` (~0.7₽ per worksheet)
- Validation: `openai/gpt-4.1-mini` (~0.08₽ per validation)
- **Total: ~0.78₽ per complete worksheet**

**Avoid These (expensive reasoning models):**
- `openai/gpt-5-mini`, `openai/o1`, `openai/o3` series - they generate internal "reasoning tokens" (1500-3000 extra tokens) which multiply costs by 5-10x
- Example: `gpt-5-mini` costs ~1.5₽ per worksheet vs 0.17₽ for `gpt-4.1-mini`

### Token Limits
- Generation: `max_tokens: 6000` - prevents cost overruns while allowing full worksheet
- Validation: `max_tokens: 600` - sufficient for validation feedback

## Critical Notes

1. **Never commit API keys** - Use environment variables via Dokploy
2. **Different AUTH_SECRET for dev/prod** - Prevents token cross-environment usage
3. **Validate all AI outputs** - The validation loop is critical for quality
4. **Grade-level accuracy matters** - Content must match Russian FGOS standards
5. **Use cost-efficient models** - GPT-4.1 family provides best quality/price ratio
6. **Dummy provider** - Always use for local dev to avoid API costs

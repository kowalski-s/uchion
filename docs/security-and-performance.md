# Security & Performance

## 1. Threat Model and Protection

### 1.1 API Keys & Secrets
- **Principle**: Zero Trust to client
- **Implementation**:
  - `OPENAI_API_KEY` stored exclusively in server environment variables (Dokploy)
  - Client code contains no secrets
  - `AUTH_SECRET` different for dev and production environments
  - In `.env.local` developers use `DummyProvider` by default (safe mode)

### 1.2 Input Validation
- **Tool**: Zod (`shared/worksheet.ts`)
- **Measures**:
  - Strict typing of all fields (enum for subjects, range for grades)
  - Topic length limit (up to 200 chars) to prevent Prompt Injection and DoS attacks on LLM context
  - Input sanitization before sending to LLM

### 1.3 Content Safety
- **LLM Output**: We don't trust model output
  - All JSON validated by Zod schema
  - PDF generated on server, excluding XSS vectors (only text inserted into PDF)
  - HTML escaped in PDF generation (`escapeHtml()`)

### 1.4 Authentication Security
- **JWT**: HMAC-SHA256 signing with timing-safe comparison
- **OAuth**: PKCE implementation, state validation with timestamps
- **Cookies**: httpOnly, Secure (in production), SameSite=Lax
- **Tokens**: Refresh token rotation with database revocation tracking
- **Rate Limiting**: Per-endpoint limits (auth: 10/5min, generate: 5-20/hour)

---

## 2. Performance

### 2.1 Frontend (Vite + React)
- **Code Splitting**: Vite automatic chunk splitting
- **Assets**: Fonts (Inter) served from `public/fonts`
- **State Management**: Zustand for minimal re-renders
- **React Query**: Caching and background refetching

### 2.2 Backend (Express)
- **Streaming**: Server-Sent Events (SSE) allow users to see progress (0% -> 10% -> ... -> 100%) instead of long "white screen" wait
- **PDF Generation**:
  - Server generation (`pdfkit`) optimized for speed
  - Client generation (`pdf-lib`) used as fallback

### 2.3 AI Optimization
- **Model**: `gpt-5-mini` chosen as speed/quality balance
- **Caching**: (Planned) Cache popular topics in Redis for instant delivery
- **Token Limits**: `max_output_tokens: 6000` prevents cost overruns

---

## 3. Infrastructure and Deployment

### 3.1 Hosting (Dokploy)
- **Server**: VPS with Docker containers
- **SSL**: Automatic HTTPS via Dokploy/Traefik
- **Process Manager**: Docker with auto-restart

### 3.2 Security Headers
Applied via Express middleware:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; ...
```

### 3.3 Local Development
- **Proxy**: Vite proxies `/api` requests, simulating production environment
- **Dummy AI**: Allows developing interface and logic without internet connection and API quota spending

---

## 4. Monitoring and QA

- **Smoke Tests**: `npm run smoke` checks entire generation pipeline before each release
- **Unit Tests**: Vitest for component and function testing
- **E2E Tests**: Playwright for full user flow testing
- **Health Check**: `GET /api/health` for monitoring
- **Logs**: Express logging for error tracking

---

## 5. Security Checklist

### Authentication
- [x] JWT with timing-safe signature verification
- [x] AUTH_SECRET minimum 32 characters
- [x] Refresh token rotation with DB revocation
- [x] httpOnly, Secure, SameSite cookies
- [x] PKCE for OAuth
- [x] Rate limiting on auth endpoints

### Data Protection
- [x] Input validation (Zod)
- [x] SQL injection prevention (Drizzle ORM)
- [x] XSS prevention (HTML escaping)
- [x] CSRF protection (SameSite cookies)
- [ ] Encryption at rest for sensitive data (prepared, not applied)

### Infrastructure
- [x] Security headers
- [x] HTTPS only in production
- [x] Environment variable separation (dev/prod)
- [ ] Distributed rate limiting (Redis planned)

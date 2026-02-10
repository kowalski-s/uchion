# Security & Performance

## 1. Threat Model

### 1.1 API Keys & Secrets
- `OPENAI_API_KEY` только в серверных env variables (Dokploy)
- Клиент не содержит секретов
- `AUTH_SECRET` разный для dev/prod
- `PRODAMUS_SECRET` только на сервере
- Dev: `DummyProvider` по умолчанию (без API ключей)

### 1.2 Input Validation
- **Zod** на всех входах (`shared/worksheet.ts`, `shared/types.ts`)
- Strict typing: enum для subjects, range для grades (1-11)
- Topic: max 200 символов (защита от Prompt Injection)
- Sanitization перед отправкой в LLM
- HTML sanitization в презентациях (`api/_lib/presentations/sanitize.ts`)

### 1.3 Content Safety
- JSON ответ LLM валидируется (Zod schemas per task type)
- Мульти-агентная валидация ответов (answer-verifier, quality-checker)
- PDF генерируется через Puppeteer с контролируемым HTML
- HTML escaping в PDF шаблонах

### 1.4 Authentication
- JWT: HMAC-SHA256 с timing-safe comparison
- OAuth: PKCE (Yandex), HMAC-SHA256 signature (Telegram)
- Cookies: httpOnly, Secure (prod), SameSite=Lax
- Refresh token rotation с family tracking в БД (детекция кражи)
- Rate limiting по endpoint (auth, generate, worksheets, billing)
- Token revocation: revokeRefreshToken, revokeAllUserTokens

### 1.5 Payments (Prodamus)
- Webhook signature verification (HMAC-SHA256)
- Idempotency через `webhook_events` table (eventKey + rawPayloadHash)
- Payment intents с expiration
- Rate limiting на webhook endpoint
- Atomic generationsLeft increment

---

## 2. Performance

### 2.1 Frontend
- Vite code splitting
- Zustand для минимальных re-renders
- React Query с caching и background refetch
- KaTeX для client-side рендеринга формул
- pdf-lib для client-side PDF fallback
- tailwindcss-animate для плавных анимаций

### 2.2 Backend
- SSE streaming (пользователь видит прогресс 0-100%)
- Puppeteer PDF с переиспользованием browser instance
- @sparticuz/chromium для оптимизированного headless Chromium
- Retry для недостающих заданий (не полная регенерация)
- rate-limiter-flexible для производительного rate limiting

### 2.3 AI Optimization
- **Разные модели по тарифам**: gpt-4.1 для платных, deepseek-chat для бесплатных
- **Разные модели по предметам**: Gemini Flash с reasoning для STEM, Gemini Lite без reasoning для гуманитарных
- **Оптимизация токенов**: reasoning effort=minimal для task-fixer, отключение фиксов для гуманитарных
- `max_tokens: 16000` -- достаточно для больших листов
- `temperature: 0.5` -- более точное следование инструкциям
- Config-driven промпты -- минимум лишнего текста
- **Презентации**: Claude (claude-sonnet-4.5) -- оптимален для структурированного контента

### 2.4 Database
- Индексы на часто запрашиваемых полях (userId, createdAt, status, subject, grade)
- Soft delete (deletedAt) вместо физического удаления
- Max 20 листов на пользователя (автоочистка старых)
- Connection через `postgres` driver (без ORM overhead для критических запросов)

---

## 3. Infrastructure

### 3.1 Hosting (Dokploy)
- VPS с Docker
- Auto HTTPS (Traefik)
- Auto-restart

### 3.2 Security Headers
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: default-src 'self'; ...
```

---

## 4. Monitoring & QA

- **Smoke Tests**: `npm run smoke`
- **Unit Tests**: Vitest
- **E2E Tests**: Playwright
- **Health Check**: `GET /api/health`
- **Alerts**: Telegram Bot для админов (генерация, ошибки, качество)
- **Audit Logs**: события авторизации (auth.login, security.*, rate_limit)
- **Generation Alerts**: отслеживание качества генерации (validation scores)

---

## 5. Security Checklist

### Authentication
- [x] JWT с timing-safe verification
- [x] AUTH_SECRET min 32 символа
- [x] Refresh token rotation + family tracking + DB revocation
- [x] httpOnly, Secure, SameSite cookies
- [x] PKCE для Yandex OAuth
- [x] HMAC-SHA256 для Telegram auth
- [x] Rate limiting на auth endpoints
- [x] Audit logging

### Data Protection
- [x] Input validation (Zod)
- [x] SQL injection prevention (Drizzle ORM)
- [x] XSS prevention (HTML escaping, sanitization)
- [x] CSRF protection (SameSite cookies)
- [ ] Encryption at rest (подготовлено, не применено)

### Payments
- [x] Webhook signature verification
- [x] Idempotency (webhook_events table)
- [x] Payment intent tracking
- [x] Rate limiting
- [x] Atomic credit operations

### AI Security
- [x] Prompt injection mitigation (topic length limit, sanitization)
- [x] Response validation (Zod schemas)
- [x] Multi-agent verification (answer-verifier)
- [x] HTML sanitization for presentations

### Infrastructure
- [x] Security headers
- [x] HTTPS в production
- [x] Env separation (dev/prod)
- [ ] Distributed rate limiting (Redis planned)

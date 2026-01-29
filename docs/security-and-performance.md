# Security & Performance

## 1. Threat Model

### 1.1 API Keys & Secrets
- `OPENAI_API_KEY` только в серверных env variables (Dokploy)
- Клиент не содержит секретов
- `AUTH_SECRET` разный для dev/prod
- `PRODAMUS_SECRET` только на сервере
- Dev: `DummyProvider` по умолчанию (без API ключей)

### 1.2 Input Validation
- **Zod** на всех входах (`shared/worksheet.ts`)
- Strict typing: enum для subjects, range для grades (1-11)
- Topic: max 200 символов (защита от Prompt Injection)
- Sanitization перед отправкой в LLM

### 1.3 Content Safety
- JSON ответ LLM валидируется
- PDF генерируется на сервере (нет XSS-векторов)
- HTML escaping в PDF (`escapeHtml()`)

### 1.4 Authentication
- JWT: HMAC-SHA256 с timing-safe comparison
- OAuth: PKCE (Yandex), HMAC-SHA256 signature (Telegram)
- Cookies: httpOnly, Secure (prod), SameSite=Lax
- Refresh token rotation с revocation в БД
- Rate limiting по endpoint (auth: 10/5min, generate: 5-20/hour)

### 1.5 Payments (Prodamus)
- Webhook signature verification (HMAC-SHA256)
- Idempotency через `webhook_events` table (eventKey + rawPayloadHash)
- Payment intents с expiration
- Rate limiting на webhook endpoint

---

## 2. Performance

### 2.1 Frontend
- Vite code splitting
- Zustand для минимальных re-renders
- React Query с caching и background refetch
- KaTeX для client-side рендеринга формул

### 2.2 Backend
- SSE streaming (пользователь видит прогресс 0-100%)
- PDF через `pdfkit` (быстрее puppeteer)
- Retry для недостающих заданий (не полная регенерация)

### 2.3 AI Optimization
- Модель `gpt-4.1-mini`: баланс скорости и качества
- `max_tokens: 8000` -- предотвращает перерасход
- `temperature: 0.5` -- более точное следование инструкциям
- Config-driven промпты -- минимум лишнего текста в промптах

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
- **Alerts**: Telegram Bot для админов (генерация, ошибки)
- **Audit Logs**: события авторизации в console (auth.login, security.*)

---

## 5. Security Checklist

### Authentication
- [x] JWT с timing-safe verification
- [x] AUTH_SECRET min 32 символа
- [x] Refresh token rotation + DB revocation
- [x] httpOnly, Secure, SameSite cookies
- [x] PKCE для OAuth
- [x] Rate limiting на auth endpoints
- [x] Audit logging (console)

### Data Protection
- [x] Input validation (Zod)
- [x] SQL injection prevention (Drizzle ORM)
- [x] XSS prevention (HTML escaping)
- [x] CSRF protection (SameSite cookies)
- [ ] Encryption at rest (подготовлено, не применено)

### Payments
- [x] Webhook signature verification
- [x] Idempotency (webhook_events table)
- [x] Payment intent tracking
- [x] Rate limiting

### Infrastructure
- [x] Security headers
- [x] HTTPS в production
- [x] Env separation (dev/prod)
- [ ] Distributed rate limiting (Redis planned)

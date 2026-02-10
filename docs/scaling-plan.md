# Scaling Plan

## 1. Current State

### Architecture
- **Frontend**: SPA (React 18 / Vite 7)
- **Backend**: Express.js 5
- **AI**: Multiple models через polza.ai
  - Генерация: gpt-4.1 (платные) / deepseek-chat (бесплатные)
  - Валидация: gemini-3-flash (STEM) / gemini-2.5-flash-lite (гуманитарные)
  - Презентации: claude-sonnet-4.5
- **Database**: PostgreSQL + Drizzle ORM
- **Hosting**: VPS via Dokploy
- **Payments**: Prodamus
- **PDF**: Puppeteer + @sparticuz/chromium

### Implemented
- Auth (Yandex OAuth PKCE, Telegram)
- Worksheet generation (4 предмета, 1-11 классы, 5 типов заданий)
- Presentation generation (4 темы, PPTX + PDF)
- Multi-agent validation (answer-verifier, task-fixer, quality-checker)
- PDF generation (Puppeteer, HTML -> PDF)
- Personal cabinet (worksheets, folders)
- Rate limiting (in-memory, rate-limiter-flexible)
- Admin panel (stats, users, generations, payments, alerts)
- Prodamus payment integration (webhook idempotency)
- Telegram alerts for admins
- Different models per tier (paid vs free)
- Different models per subject type (STEM vs humanities)

---

## 2. Phase 1: Performance & Caching

### Goal
Снизить расходы на AI и ускорить доставку.

### Changes
1. **Semantic Caching**: поиск похожих тем, если совпадение >95% -- кеш
2. **Distributed Rate Limiting**: Redis (ioredis уже в зависимостях) вместо in-memory
3. **Response Caching**: кеш популярных шаблонов, CDN для статики
4. **Puppeteer Optimization**: переиспользование browser instance, pre-warming

---

## 3. Phase 2: Advanced AI

### Goal
Повысить качество контента.

### Changes
1. **Fine-tuning** на лучших генерациях (teacher-rated)
2. **Enhanced Multi-agent**: расширение агентов валидации
3. **Cost Routing**: автоматический выбор модели по сложности запроса
4. **Presentation Templates**: больше шаблонов слайдов

---

## 4. Phase 3: Horizontal Scaling

### When
- >1000 concurrent users
- Деградация response times

### Changes
1. **Load Balancing**: несколько Express instances за nginx/Traefik
2. **Queue System**: BullMQ для фоновой генерации (worksheets + presentations)
3. **DB Scaling**: connection pooling (pgBouncer), read replicas
4. **Separate Puppeteer Service**: отдельный microservice для PDF

---

## 5. Infrastructure Options

### Current: Dokploy на VPS
- Просто, дешево, <500 users

### Future
- **Kubernetes**: auto-scaling
- **Managed Services**: Render, Railway, Fly.io
- **Separate Services**: PDF generation, AI processing

---

## 6. Monitoring

### Current
- Health check endpoint (`GET /api/health`)
- Console logging
- Telegram alerts (admins)
- Admin panel (stats, generations, payments)

### Planned
1. **Metrics**: Prometheus + Grafana
2. **Alerting**: расширение Telegram alerts
3. **Logging**: Structured JSON logs, log aggregation
4. **AI Cost Tracking**: per-generation cost logging

---

## 7. Cost Optimization

### AI
- **Tiered models**: gpt-4.1 для платных, deepseek-chat для бесплатных
- **Subject-optimized verifiers**: Gemini Flash с reasoning для STEM, Gemini Lite без reasoning для гуманитарных
- **Token optimization**: reasoning effort=minimal для фиксеров, отключение фиксов для гуманитарных
- `max_tokens: 16000` (генерация)
- Кеширование популярных тем (planned)
- Презентации: Claude для структурированного контента

### Infrastructure
- Right-size VPS
- CDN для статики
- Оптимизация Docker images
- Puppeteer browser reuse

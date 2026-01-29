# Scaling Plan

## 1. Current State

### Architecture
- **Frontend**: SPA (React/Vite)
- **Backend**: Express.js 5
- **AI**: OpenAI через polza.ai (`gpt-4.1-mini`)
- **Database**: PostgreSQL (Supabase)
- **Hosting**: VPS via Dokploy
- **Payments**: Prodamus

### Implemented
- Auth (Yandex, Telegram OAuth)
- Worksheet generation (4 предмета, 1-11 классы)
- 5 типов заданий, 3 формата листов
- PDF generation
- Personal cabinet (worksheets, folders)
- Rate limiting (in-memory)
- Admin panel (stats, users, generations, payments)
- Prodamus payment integration
- Telegram alerts for admins

---

## 2. Phase 1: Performance & Caching

### Goal
Снизить расходы на AI и ускорить доставку.

### Changes
1. **Semantic Caching**: поиск похожих тем, если совпадение >95% -- кеш
2. **Distributed Rate Limiting**: Redis (Upstash) вместо in-memory
3. **Response Caching**: кеш популярных шаблонов, CDN для статики

---

## 3. Phase 2: Advanced AI

### Goal
Повысить качество контента.

### Changes
1. **Fine-tuning** на лучших генерациях (teacher-rated)
2. **Multi-agent**: Методист (структура), Автор (текст), Корректор (проверка)
3. **Multiple AI Providers**: fallback на альтернативные модели, cost routing

---

## 4. Phase 3: Horizontal Scaling

### When
- >1000 concurrent users
- Деградация response times

### Changes
1. **Load Balancing**: несколько Express instances за nginx/Traefik
2. **Queue System**: BullMQ для фоновой генерации
3. **DB Scaling**: connection pooling (pgBouncer), read replicas

---

## 5. Infrastructure Options

### Current: Dokploy на VPS
- Просто, дешево, <500 users

### Future
- **Kubernetes**: auto-scaling
- **Managed Services**: Render, Railway, Fly.io

---

## 6. Monitoring

### Current
- Health check endpoint
- Console logging
- Telegram alerts (admins)

### Planned
1. **Metrics**: Prometheus + Grafana
2. **Alerting**: PagerDuty
3. **Logging**: Structured JSON logs, log aggregation

---

## 7. Cost Optimization

### AI
- Token limits (generation: 8000, retry: 4000, validation: 600)
- Модель `gpt-4.1-mini` (~0.15 rub/лист)
- Кеширование популярных тем

### Infrastructure
- Right-size VPS
- CDN для статики
- Оптимизация Docker images

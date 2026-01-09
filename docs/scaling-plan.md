# Scaling Plan

## 1. Current State (MVP)

### Architecture
- **Frontend**: SPA (React/Vite)
- **Backend**: Express.js server
- **AI**: Direct OpenAI calls (gpt-5-mini)
- **Database**: PostgreSQL (Supabase)
- **Hosting**: VPS via Dokploy

### Implemented
- User authentication (Yandex, Telegram OAuth)
- Worksheet generation with AI
- PDF generation
- Personal cabinet (worksheets, folders)
- Rate limiting (in-memory)

---

## 2. Phase 1: Performance & Caching (Next)

### Goal
Reduce AI costs and speed up delivery.

### Changes
1. **Semantic Caching**:
   - Before generation, search for similar topics in Vector Store
   - If match > 95%, return cached JSON without LLM call
2. **Distributed Rate Limiting**:
   - Redis (Upstash) for request limiting by IP/User ID
   - Replace in-memory store
3. **Response Caching**:
   - Cache popular worksheet templates
   - CDN for static assets

---

## 3. Phase 2: Advanced AI (Later)

### Goal
Improve content quality.

### Changes
1. **Custom Fine-tuning**:
   - Train model on best generated worksheets (teacher-rated)
2. **Multi-agent System**:
   - Split into agents: Methodologist (structure), Author (text), Corrector (validation)
3. **Multiple AI Providers**:
   - Fallback to alternative models (YandexGPT)
   - Cost optimization routing

---

## 4. Phase 3: Horizontal Scaling (If Needed)

### When
- >1000 concurrent users
- Response times degrading
- Single server at capacity

### Changes
1. **Load Balancing**:
   - Multiple Express instances behind nginx/Traefik
   - Sticky sessions for SSE connections
2. **Queue System**:
   - Background job processing for AI generation
   - BullMQ or similar
3. **Database Scaling**:
   - Connection pooling (pgBouncer)
   - Read replicas if needed

---

## 5. Infrastructure Options

### Current: Dokploy on VPS
- Simple, cost-effective
- Good for <500 users
- Easy deployment via Git

### Future Options
1. **Kubernetes (K8s)**:
   - Auto-scaling
   - Complex but powerful
2. **Managed Services**:
   - Render, Railway, Fly.io
   - Simpler than K8s, more expensive

---

## 6. Monitoring & Observability

### Current
- Health check endpoint
- Console logging
- Dokploy dashboard

### Planned
1. **Metrics**:
   - Prometheus + Grafana
   - Request latency, error rates
2. **Alerting**:
   - PagerDuty or similar
   - Alerts for: high error rate, slow responses, AI failures
3. **Logging**:
   - Structured logs (JSON)
   - Log aggregation (Loki, Elasticsearch)

---

## 7. Cost Optimization

### AI Costs
- Monitor token usage per generation
- Set `max_output_tokens` limits
- Cache common topics
- Consider cheaper models for validation

### Infrastructure Costs
- Right-size VPS based on usage
- Use CDN for static assets
- Optimize Docker images

---

## 8. Migration Checklist

### Before Scaling
- [ ] Add Redis for rate limiting
- [ ] Implement semantic caching
- [ ] Add proper monitoring
- [ ] Load test current setup
- [ ] Document runbooks

### During Scaling
- [ ] Zero-downtime deployment
- [ ] Database migration plan
- [ ] Rollback procedures
- [ ] User communication plan

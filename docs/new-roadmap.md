# Roadmap Uchion v2

## Completed (MVP + Phases 1-3)

### Core
- [x] Monorepo (React + Express + Shared Layer)
- [x] API `/api/generate` с Zod-validation
- [x] AI Provider (OpenAI via polza.ai + Dummy)
- [x] PDF Generation (pdfkit server-side)
- [x] Config-driven generation (предметы, типы заданий, форматы, сложность)
- [x] 4 предмета: Математика (1-6), Алгебра (7-11), Геометрия (7-11), Русский (1-11)
- [x] 5 типов заданий (single_choice, multiple_choice, open_question, matching, fill_blank)
- [x] 3 формата листов (test_and_open, open_only, test_only)
- [x] KaTeX для математических формул

### Frontend
- [x] SPA Routing (Generate, Worksheet, Dashboard, Worksheets List, Saved, Login, Payment pages)
- [x] SSE Progress Streaming
- [x] PDF скачивание

### Database
- [x] PostgreSQL + Drizzle ORM
- [x] Схема: users, folders, worksheets, generations, subscriptions, payments, payment_intents, webhook_events, refresh_tokens
- [x] Миграции
- [ ] Бэкапы БД (автоматические)
- [ ] Миграция на РФ хостинг БД (ФЗ-152)

### Auth
- [x] Custom OAuth 2.0 (Yandex + Telegram)
- [x] JWT tokens (access 1h + refresh 7d, rotation)
- [x] Protected routes (withAuth, withAdminAuth, withOptionalAuth)
- [x] Rate limiting (in-memory)
- [x] Audit logging
- [x] PKCE, timing-safe comparisons
- [ ] Encryption at rest для sensitive данных
- [ ] Data export (ФЗ-152)

### Personal Cabinet
- [x] Dashboard
- [x] "Мои листы" (CRUD)
- [x] Организация в папки
- [x] Пользовательские названия листов
- [x] Редактирование worksheet
- [x] Лимиты генераций
- [x] Статус подписки
- [ ] Водяной знак на PDF

### Admin Panel
- [x] Статистика
- [x] Список пользователей
- [x] Лог генераций и ошибок
- [x] Список платежей
- [x] Telegram alerts для админов
- [ ] Перезапуск зависшей генерации
- [ ] Просмотр низкокачественных генераций (score <8)
- [ ] AI cost analytics
- [ ] User reports система

### Payments
- [x] Prodamus integration
- [x] Создание платежных ссылок
- [x] Webhook обработка с idempotency
- [x] Payment intents
- [ ] Rate limiting по пользователю (enforcement лимитов тарифа)
- [ ] AI cost мониторинг
- [ ] Реферальная система
- [ ] Бонус за подписку на Telegram

---

## Phase 4: Rate Limiting & Cost Control

- [ ] **По IP:** max 20 генераций/час (защита от abuse)
- [ ] **По пользователю:** enforcement лимитов тарифа в API middleware
- [ ] **AI cost мониторинг:** логирование стоимости каждой генерации
- [ ] **Dashboard с AI spending analytics** (для админа)

---

## Phase 5: Feature Improvements

### Generation
- [ ] 3 уровня сложности (UI готов, нужна доработка промптов)
- [ ] Перегенерация отдельного задания
- [ ] Компоновка листа (5 заданий -> новая страница)

### Multiple AI Providers
- [ ] Абстракция провайдера (интерфейс для разных AI)
- [ ] Роутинг по типу задания
- [ ] Fallback логика (таймауты, ретраи, переключение)

### New Formats
- [ ] Презентации
- [ ] Кастомизация стиля листов

---

## Phase 6: Deployment & Compliance

### ФЗ-152
- [ ] Юридический аудит
- [ ] Политика конфиденциальности (UI)
- [ ] Согласие на обработку ПД

### Infrastructure
- [ ] VPS в РФ (Yandex Cloud / Selectel / Timeweb)
- [ ] Миграция БД
- [ ] SSL, CI/CD
- [ ] Load testing (100 concurrent users)
- [ ] Test coverage >70% для критических модулей

---

## Cross-cutting

- [ ] Обработка ошибок на фронте (user-friendly)
- [ ] TypeScript strict mode без ошибок
- [ ] Версионирование AI промптов
- [ ] Hot-reload AI routing config

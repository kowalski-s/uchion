# Roadmap Uchion v2

## Completed (MVP)

### Core
- [x] Monorepo структура
- [x] Shared Layer (`shared/worksheet.ts`, `shared/types.ts`)
- [x] API `/api/generate` с Zod-валидацией
- [x] AI Provider (OpenAI + Dummy)
- [x] PDF Generation (Server: Puppeteer + Client: pdf-lib)

### Frontend
- [x] SPA Routing (15 страниц + 5 admin)
- [x] Генерация через SSE (Progress Streaming)
- [x] Просмотр и скачивание PDF
- [x] Inline-редактирование заданий
- [x] Перегенерация отдельных заданий

### QA & CI
- [x] Smoke Tests (`npm run smoke`)
- [x] Unit Tests (Vitest)
- [x] E2E Tests (Playwright)

---

## Фаза 1: База данных

- [x] PostgreSQL + Drizzle ORM
- [x] Спроектировать схему БД (10 таблиц)
- [x] Написать и провести миграции
- [ ] Бэкапы БД (автоматические, hourly)
- [ ] 30 дней retention для backups
- [ ] Миграция на российский хостинг БД (ФЗ-152 compliance)

---

## Фаза 2: Авторизация

- [x] Самописный OAuth 2.0
- [x] Яндекс OAuth (PKCE)
- [x] Вход через Telegram (HMAC-SHA256)
- [x] Защита роутов (middleware: withAuth, withAdminAuth, withOptionalAuth)
- [x] Ревью безопасности (timing-safe comparisons, security headers, rate limiting)
- [x] Логика сессий/токенов (refresh token rotation + family tracking, 1h access / 7d refresh)
- [x] Логаут + инвалидация токенов (revokeRefreshToken, revokeAllUserTokens)
- [x] Access logs для аудита
- [ ] **Encryption at rest** для sensitive данных
- [ ] **Data export capability** (ФЗ-152)

---

## Фаза 3: Личный кабинет

- [x] Страница dashboard
- [x] Раздел "Мои листы"
- [x] CRUD операции с листами
- [x] Организация в папки (вложенные, цветные, лимиты по подписке)
- [x] Понятное именование листов (custom titles)
- [x] Редактирование worksheet на сайте (inline editing, all 5 task types)
- [x] Перегенерация отдельного задания
- [x] Пересборка PDF после редактирования (rebuild-pdf endpoint)
- [x] Отображение лимитов генераций
- [x] Статус подписки пользователя
- [x] Скачивание PDF
- [ ] Водяной знак на PDF
- [ ] DOCX экспорт

---

## Фаза 4: Монетизация

### Rate Limiting
- [x] По пользователю: enforcement лимитов тарифа в API middleware
- [x] Graceful degradation при превышении лимитов
- [x] rate-limiter-flexible (in-memory)

### AI Cost Management
- [x] Бесплатные лимиты: 5 генераций для новых юзеров
- [x] Разные модели для платных/бесплатных (gpt-4.1 vs deepseek-chat)
- [ ] AI cost мониторинг (логирование стоимости каждой генерации)
- [ ] Dashboard с AI spending analytics (для админа)

### Платежная логика
- [x] Логика лимитов (атомарный декремент generationsLeft)
- [x] Интеграция Prodamus
- [x] Обработка webhook (idempotency, signature verification)
- [x] Начисление генераций
- [x] Проверка статуса payment intent
- [ ] Реферальная система
- [ ] Бонус за подписку на Telegram

---

## Фаза 5: Админ-панель

### Базовый функционал
- [x] Обзор статистики (users, generations, payments, uptime)
- [x] Список пользователей (с деталями)
- [x] Просмотр генераций и ошибок
- [x] Детальные логи генераций
- [x] Список платежей
- [x] Telegram alerts для админов

### Расширенные функции
- [x] Перезапуск зависшей генерации (возвращение кредитов + отслеживание зависших)
- [ ] Просмотр низкокачественных генераций (validation score <8) (отложим, обдумать надо ли)
- [x] Ручная обработка webhook
- [x] AI cost analytics по провайдерам
- [x] Reporting (uptime, активные подписчики, costs)
- [ ] User reports система (отложим, обдумать надо ли)

---

## Фаза 6: Допил фишек

### Улучшение генерации
- [x] 3 уровня сложности (easy / medium / hard)
- [x] Перегенерация отдельного задания
- [x] Выбор типов заданий через UI
- [x] Мульти-агентная валидация (answer-verifier, task-fixer, quality-checker)
- [x] Разные модели для STEM vs гуманитарных
- [x] Оптимизация токенов (reasoning effort, отключение фиксов)
- [ ] Компоновка листа (5 заданий = новая страница)

### Презентации
- [x] Генерация PPTX презентаций
- [x] 4 темы оформления (professional, educational, minimal, scientific)
- [x] 3 варианта объема (12/18/24 слайдов)
- [x] HTML preview слайдов
- [x] PDF экспорт презентаций
- [x] Claude (claude-sonnet-4.5) для генерации
- [x] Inter шрифты, layout, sanitize

### Множественные AI провайдеры
- [x] Разные модели для разных задач (generation, validation, presentation)
- [x] Разные модели по тарифам (paid vs free)
- [ ] Fallback логика (таймауты, переключение)
- [ ] Нормализация ответов (единый формат)

---

## Фаза 7: Деплой и Compliance

### ФЗ-152 Compliance
- [ ] Юридический аудит
- [ ] Политика конфиденциальности (UI)
- [ ] Документация согласия на обработку ПД

### Infrastructure
- [x] VPS via Dokploy
- [x] Health check endpoint
- [x] Auto HTTPS (Traefik)
- [ ] Russian-hosted database
- [ ] Load testing (100 concurrent users)
- [ ] Test coverage >= 70% (auth, payments, AI)
- [ ] Pilot testing с учителями

### Deployment
- [x] Деплой на прод (Dokploy)
- [x] Мониторинг (Telegram alerts)
- [ ] Structured logging
- [ ] CI/CD пайплайн

---

## Сквозное (Cross-cutting Concerns)

- [ ] Обработка ошибок на фронте (что видит юзер когда всё упало)
- [ ] TypeScript strict mode без ошибок
- [ ] Версионирование AI промптов
- [ ] Hot-reload AI routing config

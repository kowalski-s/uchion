# Architecture Overview

## 1. Общая концепция

Uchion -- веб-сервис генерации рабочих листов и презентаций для школьников 1-11 классов с помощью AI. Полный цикл: от ввода темы до PDF/PPTX файла.

**Предметы**: Математика (1-6), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11).

**Продукты**:
- **Рабочие листы** -- задания разных типов с ответами (PDF)
- **Презентации** -- учебные PPTX-презентации с 3 темами оформления

## 2. Архитектура системы

### 2.1 Frontend
- **Tech**: React 18, Vite 7, TypeScript, Tailwind CSS
- **Routing**: SPA (React Router)
  - `/` -- генерация листов (GeneratePage)
  - `/presentations/generate` -- генерация презентаций (GeneratePresentationPage)
  - `/worksheet/:sessionId` -- просмотр/редактирование (WorksheetPage, session-based)
  - `/worksheets` -- список сохраненных листов (WorksheetsListPage)
  - `/worksheets/:id` -- сохраненный лист (SavedWorksheetPage, DB-backed)
  - `/presentations` -- список презентаций (PresentationsListPage)
  - `/presentations/:id` -- сохраненная презентация (SavedPresentationPage)
  - `/dashboard` -- личный кабинет (DashboardPage)
  - `/login` -- вход (LoginPage: Yandex OAuth + Email OTP)
  - `/payment/success`, `/payment/cancel` -- результат оплаты
  - `/admin/*` -- админ-панель (overview, users, users/:id, generations, payments, settings, ai-costs)
- **State**: Zustand (глобальный) + React Query (async)
- **API**: `fetch` + SSE для стриминга прогресса
- **Math**: KaTeX для рендеринга формул
- **Presentations**: pptxgenjs (PPTX)
- **PDF (client)**: `pdf-lib` (fallback если серверный PDF недоступен)

### 2.2 Backend
- **Tech**: Express.js 5 (Node.js 20+)
- **API**: REST JSON + SSE streaming
- **Database**: PostgreSQL + Drizzle ORM (12 таблиц)
- **Auth**: Yandex OAuth (PKCE) + Email OTP (Unisender Go)
- **Payments**: Prodamus (webhook-based)
- **PDF**: Puppeteer + @sparticuz/chromium (HTML -> PDF)
- **Alerts**: Telegram Bot для админов
- **Key Endpoints**:
  - `POST /api/generate` -- генерация листа (SSE)
  - `POST /api/generate/regenerate-task` -- перегенерация одного задания
  - `POST /api/generate/rebuild-pdf` -- пересборка PDF без AI
  - `POST /api/presentations/generate` -- генерация презентации (SSE)
  - `GET/PATCH/DELETE /api/presentations/:id` -- CRUD презентаций
  - `GET/PATCH/DELETE /api/worksheets/:id` -- CRUD листов
  - `GET/POST/PATCH/DELETE /api/folders` -- папки
  - `/api/auth/*` -- аутентификация (Yandex, Email OTP, refresh, logout)
  - `/api/admin/*` -- админ-панель (stats, users, generations, payments, alerts, settings, ai-costs)
  - `/api/billing/*` -- платежи (products, create-link, webhook, payment-status)
  - `POST /api/telegram/webhook` -- Telegram bot webhook

### 2.3 Shared Layer
- **Path**: `shared/`
- **Файлы**:
  - `worksheet.ts` -- Zod-схемы для листов (Subject, TaskTypeId, Worksheet, GenerateSchema и др.)
  - `types.ts` -- типы презентаций (PresentationThemePreset, PresentationSlide), dashboard типы, коды ошибок

---

## 3. Data Flow

### 3.1 Генерация рабочих листов

1. **Запрос**: Пользователь заполняет форму (предмет, класс, тема, тип заданий, сложность, формат) -> `POST /api/generate`
2. **Генерация**:
   - Собираются промпты из config-driven системы (`api/_lib/generation/`)
   - Выбирается модель на основе тарифа (платный: gpt-4.1, бесплатный: deepseek-v3.2)
   - LLM генерирует JSON с массивом `tasks` (5 типов заданий)
   - Задания разделяются на тестовые и открытые
3. **Догенерация** (retry):
   - Если заданий не хватает, запускается retry для недостающих
4. **Мульти-агентная валидация**:
   - **answer-verifier**: проверка корректности ответов
     - STEM 7-11: Gemini Flash с reasoning
     - Гуманитарные 7-11: Gemini Lite без reasoning
     - 1-6 классы: gpt-4.1-mini (дешевый)
   - **task-fixer**: автоисправление ошибок
   - **quality-checker**: оценка образовательной ценности
5. **Сборка**:
   - Конвертация в формат `Worksheet` (assignments + test + answers)
   - PDF генерация через Puppeteer (HTML -> PDF, Base64)
6. **AI Usage**: Логирование токенов и стоимости в таблицу `ai_usage`
7. **Ответ**: SSE стрим (Progress -> Result) клиенту
8. **Сохранение**: Лист сохраняется в БД (если пользователь авторизован, max 20 листов)

### 3.2 Генерация презентаций

1. **Запрос**: Пользователь выбирает предмет, класс, тему, тему оформления, количество слайдов -> `POST /api/presentations/generate`
2. **Генерация**: Claude (claude-sonnet-4.5) генерирует структуру слайдов (JSON)
3. **Сборка**: Структура конвертируется в PPTX (pptxgenjs) и PDF (Puppeteer)
4. **Ответ**: SSE стрим с прогрессом, затем результат (pptxBase64, pdfBase64)
5. **Сохранение**: Презентация сохраняется в БД (max 15 презентаций)

---

## 4. Ключевые модули

### Generation Config (`api/_lib/generation/config/`)
Config-driven система генерации:
- **subjects/** -- конфиги предметов (math, algebra, geometry, russian), каждый в своей директории с prompt.ts, grade-tiers.ts, difficulty.ts
- **presentations/subjects/** -- конфиги презентаций по предметам
- **presentations/templates/** -- шаблоны слайдов (minimalism, kids, school)
- **task-types.ts** -- 5 типов заданий с Zod-валидацией и промпт-инструкциями
- **worksheet-formats.ts** -- форматы листов (open_only, test_only, test_and_open) с вариантами
- **difficulty.ts** -- уровни сложности (easy, medium, hard)
- **task-distribution.ts** -- распределение типов заданий

### AI Provider (`api/_lib/ai-provider.ts`, `ai-models.ts`)
- **DummyProvider**: локальный стаб для разработки
- **OpenAIProvider**: продакшн. Генерация + retry + мульти-агентная валидация
- **ClaudeProvider**: для презентаций (Claude-специфичный)
- **Модели**: разные для платных/бесплатных, для STEM/гуманитарных, для разных классов

### AI Usage Tracking (`api/_lib/ai-usage.ts`)
- Логирует каждый AI-вызов: sessionId, callType, model, tokens, cost, duration
- Данные в таблице `ai_usage`
- Аналитика доступна в админ-панели (`/admin/ai-costs`)

### Presentations (`api/_lib/presentations/`)
- **generator.ts** -- основной генератор
- **minimalism-generator.ts** -- генератор для темы "минимализм"
- **kids-generator.ts** -- генератор для детской темы
- **school-generator.ts** -- генератор для школьной темы
- **pdf-generator.ts** -- PDF из HTML через Puppeteer
- **sanitize.ts** -- очистка HTML-контента

### PDF Generator (`api/_lib/pdf.ts`)
- Server-side через Puppeteer + @sparticuz/chromium
- Inter шрифт (base64 TTF)
- LaTeX -> Unicode конвертация
- Многостраничный A4 layout

### Authentication (`server/routes/auth.ts`)
- Yandex OAuth (PKCE)
- Email OTP (6-значный код через Unisender Go)
- JWT tokens (access 1h + refresh 7d) с ротацией, family tracking
- Rate limiting

### Admin Panel (`server/routes/admin/`)
- Статистика (пользователи, генерации, платежи)
- Списки пользователей, генераций, ошибок
- Управление пользователями (блокировка, разблокировка)
- AI cost analytics (трекинг расходов по моделям)
- Настройки Telegram алертов

### Billing (`server/routes/billing.ts`)
- Prodamus integration
- Создание платежных ссылок (product catalog / custom amount)
- Webhook обработка с idempotency
- Проверка статуса payment intent

### Alerts (`api/_lib/alerts/`, `api/_lib/telegram/`)
- Telegram Bot для уведомлений админов
- Алерты: провал генерации, высокий error rate, AI таймауты, низкое качество, старт сервера

---

## 5. Infrastructure

- **Hosting**: VPS via Dokploy
- **CI/CD**: Git push -> Dokploy auto-deploy
- **Database**: PostgreSQL (12 таблиц)
- **Environment**:
  - `dev`: Vite + Express, DummyProvider
  - `prod`: Express server, AI через polza.ai

---

## 6. Directory Structure

```
uchion/
├── server.ts              # Express entry point
├── server/
│   ├── routes/
│   │   ├── auth.ts        # Authentication (Yandex OAuth, Email OTP)
│   │   ├── generate.ts    # Worksheet generation (SSE)
│   │   ├── presentations.ts # Presentation generation + CRUD
│   │   ├── worksheets.ts  # Worksheet CRUD
│   │   ├── folders.ts     # Folder CRUD
│   │   ├── admin/         # Admin panel (8 files)
│   │   │   ├── index.ts, stats.ts, users.ts, generations.ts
│   │   │   ├── payments.ts, alerts.ts, settings.ts, ai-costs.ts
│   │   ├── billing.ts     # Prodamus payments
│   │   ├── telegram.ts    # Telegram bot webhook
│   │   └── health.ts      # Health check
│   ├── middleware/
│   │   ├── auth.ts        # withAuth, withAdminAuth
│   │   ├── cookies.ts     # Cookie handling
│   │   ├── rate-limit.ts  # Rate limiting (Redis + in-memory)
│   │   ├── error-handler.ts # ApiError + global handler
│   │   └── audit-log.ts   # Auth event logging
│   └── lib/
│       └── prodamus.ts    # Prodamus helpers
├── api/_lib/
│   ├── generation/        # Config-driven generation
│   │   ├── config/
│   │   │   ├── subjects/  # math/, algebra/, geometry/, russian/
│   │   │   └── presentations/  # subjects/, templates/
│   │   ├── validation/    # Multi-agent validation (6 agents)
│   │   └── prompts.ts
│   ├── presentations/     # 3 theme generators + PDF + sanitize
│   ├── providers/         # OpenAI, Claude, Dummy, circuit-breaker
│   ├── auth/              # tokens, oauth, cookies, encryption, audit-log
│   ├── alerts/            # Generation alerts
│   ├── telegram/          # Bot API + commands
│   ├── ai-provider.ts     # AI provider abstraction
│   ├── ai-models.ts       # Model selection (subject, tier, grade)
│   ├── ai-usage.ts        # Token + cost tracking
│   ├── email.ts           # Unisender Go (OTP emails)
│   └── pdf.ts             # Worksheet PDF (Puppeteer)
├── src/                   # React frontend
│   ├── pages/             # 11 main + 7 admin = 18 pages
│   ├── components/        # UI components (9 + subdirs)
│   ├── hooks/             # useWorksheetEditor
│   ├── store/             # Zustand session store
│   └── lib/               # API clients, auth, pdf-client
├── shared/
│   ├── worksheet.ts       # Zod schemas
│   └── types.ts           # Presentation types, error codes
├── db/
│   └── schema.ts          # Drizzle ORM (12 tables)
└── docs/                  # Documentation
```

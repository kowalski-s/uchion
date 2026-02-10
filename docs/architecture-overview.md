# Architecture Overview

## 1. Общая концепция

Uchion -- веб-сервис генерации рабочих листов и презентаций для школьников 1-11 классов с помощью AI. Полный цикл: от ввода темы до PDF/PPTX файла.

**Предметы**: Математика (1-6), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11).

**Продукты**:
- **Рабочие листы** -- задания разных типов с ответами (PDF)
- **Презентации** -- учебные PPTX-презентации с 4 темами оформления

## 2. Архитектура системы

### 2.1 Frontend
- **Tech**: React 18, Vite 7, TypeScript, Tailwind CSS
- **Routing**: SPA (React Router)
  - `/` -- генерация листов (GeneratePage)
  - `/presentations/generate` -- генерация презентаций (GeneratePresentationPage)
  - `/worksheet/:sessionId` -- просмотр/редактирование (WorksheetPage, session-based)
  - `/worksheets` -- список сохраненных листов (WorksheetsListPage)
  - `/worksheets/:id` -- сохраненный лист (SavedWorksheetPage, DB-backed)
  - `/dashboard` -- личный кабинет (DashboardPage)
  - `/login` -- вход (LoginPage)
  - `/auth/telegram/callback` -- Telegram OAuth callback
  - `/payment/success`, `/payment/cancel` -- результат оплаты
  - `/admin/*` -- админ-панель (overview, users, users/:id, generations, payments)
- **State**: Zustand (глобальный) + React Query (async)
- **API**: `fetch` + SSE для стриминга прогресса
- **Math**: KaTeX для рендеринга формул
- **Presentations**: pptxgenjs (PPTX), SlidePreview компонент (HTML preview)
- **PDF (client)**: `pdf-lib` (fallback если серверный PDF недоступен)

### 2.2 Backend
- **Tech**: Express.js 5 (Node.js 20+)
- **API**: REST JSON + SSE streaming
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Custom OAuth 2.0 (Yandex, Telegram)
- **Payments**: Prodamus (webhook-based)
- **PDF**: Puppeteer + @sparticuz/chromium (HTML -> PDF)
- **Alerts**: Telegram Bot для админов
- **Key Endpoints**:
  - `POST /api/generate` -- генерация листа (SSE)
  - `POST /api/generate/regenerate-task` -- перегенерация одного задания
  - `POST /api/generate/rebuild-pdf` -- пересборка PDF без AI
  - `POST /api/presentations/generate` -- генерация презентации (SSE)
  - `GET/PATCH/DELETE /api/worksheets/:id` -- CRUD листов
  - `GET/POST/PATCH/DELETE /api/folders` -- папки
  - `/api/auth/*` -- аутентификация
  - `/api/admin/*` -- админ-панель (stats, users, generations, generation-logs, payments, alerts)
  - `/api/billing/*` -- платежи (create-link, webhook, payment-intent/:id)
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
   - Выбирается модель на основе тарифа (платный: gpt-4.1, бесплатный: deepseek-chat)
   - LLM генерирует JSON с массивом `tasks` (5 типов заданий)
   - Задания разделяются на тестовые и открытые
3. **Догенерация** (retry):
   - Если заданий не хватает, запускается retry для недостающих
4. **Мульти-агентная валидация**:
   - **answer-verifier**: проверка корректности ответов (Gemini для STEM, Gemini Lite для гуманитарных)
   - **task-fixer**: автоисправление ошибок
   - **quality-checker**: оценка образовательной ценности
5. **Сборка**:
   - Конвертация в формат `Worksheet` (assignments + test + answers)
   - PDF генерация через Puppeteer (HTML -> PDF, Base64)
6. **Ответ**: SSE стрим (Progress -> Result) клиенту
7. **Сохранение**: Лист сохраняется в БД (если пользователь авторизован)

### 3.2 Генерация презентаций

1. **Запрос**: Пользователь выбирает предмет, класс, тему, тему оформления, количество слайдов -> `POST /api/presentations/generate`
2. **Генерация**: Claude (claude-sonnet-4.5) генерирует структуру слайдов (JSON)
3. **Сборка**: Структура конвертируется в PPTX (pptxgenjs) и PDF (Puppeteer)
4. **Ответ**: SSE стрим с прогрессом, затем результат (pptxBase64, pdfBase64)
5. **Сохранение**: Презентация сохраняется в БД

---

## 4. Ключевые модули

### Generation Config (`api/_lib/generation/config/`)
Config-driven система генерации:
- **subjects/** -- конфиги предметов (math, algebra, geometry, russian) с темами по классам
- **presentations/subjects/** -- конфиги презентаций по предметам
- **presentations/templates/** -- шаблоны слайдов (minimalism)
- **task-types.ts** -- 5 типов заданий с Zod-валидацией и промпт-инструкциями
- **worksheet-formats.ts** -- форматы листов (open_only, test_only, test_and_open) с вариантами
- **difficulty.ts** -- уровни сложности (easy, medium, hard)
- **task-distribution.ts** -- распределение типов заданий

### AI Provider (`api/_lib/ai-provider.ts`, `ai-models.ts`)
- **DummyProvider**: локальный стаб для разработки
- **OpenAIProvider**: продакшн. Генерация + retry + мульти-агентная валидация
- **Модели**: разные для платных/бесплатных, для STEM/гуманитарных, для презентаций

### Presentations (`api/_lib/presentations/`)
- **generator.ts** -- основной генератор
- **minimalism-generator.ts** -- генератор для темы "минимализм"
- **pdf-generator.ts** -- PDF для презентаций (Puppeteer)
- **sanitize.ts** -- очистка HTML-контента

### PDF Generator (`api/_lib/pdf.ts`)
- Server-side через Puppeteer + @sparticuz/chromium
- Inter шрифт (base64 TTF)
- LaTeX -> Unicode конвертация
- Многостраничный A4 layout

### Authentication (`server/routes/auth.ts`)
- Yandex OAuth (PKCE)
- Telegram Login Widget (HMAC-SHA256)
- JWT tokens (access 1h + refresh 7d) с ротацией, family tracking
- Rate limiting

### Admin Panel (`server/routes/admin.ts`)
- Статистика (пользователи, генерации, платежи)
- Списки пользователей, генераций, ошибок
- Логи генераций
- Управление пользователями

### Billing (`server/routes/billing.ts`)
- Prodamus integration
- Создание платежных ссылок (product catalog / custom amount)
- Webhook обработка с idempotency
- Проверка статуса payment intent

### Alerts (`api/_lib/alerts/`, `api/_lib/telegram/`)
- Telegram Bot для уведомлений админов
- Алерты о качестве генерации

---

## 5. Infrastructure

- **Hosting**: VPS via Dokploy
- **CI/CD**: Git push -> Dokploy auto-deploy
- **Database**: PostgreSQL
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
│   │   ├── auth.ts        # Authentication (OAuth, JWT)
│   │   ├── generate.ts    # Worksheet generation (SSE)
│   │   ├── presentations.ts # Presentation generation (SSE)
│   │   ├── worksheets.ts  # Worksheet CRUD
│   │   ├── folders.ts     # Folder CRUD
│   │   ├── admin.ts       # Admin panel API
│   │   ├── billing.ts     # Prodamus payments
│   │   ├── telegram.ts    # Telegram bot webhook
│   │   └── health.ts      # Health check
│   ├── middleware/
│   │   ├── auth.ts        # Auth middleware (withAuth, withAdminAuth, withOptionalAuth)
│   │   ├── cookies.ts     # Cookie handling
│   │   └── rate-limit.ts  # Rate limiting
│   └── lib/
│       └── prodamus.ts    # Prodamus helpers
├── api/
│   └── _lib/
│       ├── generation/    # Config-driven generation
│       │   ├── config/
│       │   │   ├── subjects/        # math, algebra, geometry, russian
│       │   │   ├── presentations/   # Presentation configs
│       │   │   │   ├── subjects/    # Per-subject presentation configs
│       │   │   │   └── templates/   # Slide templates (minimalism)
│       │   │   ├── task-types.ts
│       │   │   ├── worksheet-formats.ts
│       │   │   ├── difficulty.ts
│       │   │   └── task-distribution.ts
│       │   └── prompts.ts
│       ├── presentations/ # Presentation generation
│       │   ├── generator.ts
│       │   ├── minimalism-generator.ts
│       │   ├── pdf-generator.ts
│       │   └── sanitize.ts
│       ├── ai/            # AI modules
│       │   ├── schema.ts
│       │   ├── validator.ts
│       │   └── prompts.ts
│       ├── auth/          # Auth utilities
│       ├── alerts/        # Generation alerts
│       ├── telegram/      # Telegram Bot API
│       ├── ai-provider.ts # AI provider abstraction
│       ├── ai-models.ts   # Model selection per subject/tier
│       └── pdf.ts         # PDF generation (Puppeteer)
├── src/                   # React frontend
│   ├── pages/
│   │   ├── GeneratePage.tsx           # Main worksheet generation
│   │   ├── GeneratePresentationPage.tsx # Presentation generation
│   │   ├── WorksheetPage.tsx          # Session worksheet view/edit
│   │   ├── SavedWorksheetPage.tsx     # DB-backed worksheet view/edit
│   │   ├── WorksheetsListPage.tsx     # Saved worksheets list
│   │   ├── DashboardPage.tsx          # User dashboard
│   │   ├── LoginPage.tsx              # Auth page
│   │   ├── TelegramCallbackPage.tsx   # Telegram auth callback
│   │   ├── PaymentSuccessPage.tsx     # Payment success
│   │   ├── PaymentCancelPage.tsx      # Payment cancel
│   │   └── admin/                     # Admin panel pages
│   │       ├── AdminPage.tsx
│   │       ├── AdminUsersPage.tsx
│   │       ├── AdminUserDetailPage.tsx
│   │       ├── AdminGenerationsPage.tsx
│   │       └── AdminPaymentsPage.tsx
│   ├── components/
│   │   ├── EditableWorksheetContent.tsx  # All 5 task types editing
│   │   ├── SlidePreview.tsx              # Presentation slide preview (4 themes)
│   │   ├── MathRenderer.tsx              # KaTeX rendering
│   │   ├── Header.tsx
│   │   ├── WorksheetManager.tsx
│   │   ├── EditModeToolbar.tsx
│   │   ├── UnsavedChangesDialog.tsx
│   │   ├── BuyGenerationsModal.tsx
│   │   ├── CookieConsent.tsx
│   │   └── CustomSelect.tsx
│   ├── hooks/
│   │   └── useWorksheetEditor.ts      # Central editing logic
│   ├── store/
│   │   └── session.ts                 # Zustand session store
│   └── lib/
│       ├── api.ts                     # REST/SSE API client
│       ├── presentation-api.ts        # Presentation SSE client
│       ├── auth.tsx                    # Auth hook & OAuth
│       ├── dashboard-api.ts           # Dashboard endpoints
│       ├── admin-api.ts               # Admin panel API
│       ├── pdf-client.ts              # Client PDF fallback (pdf-lib)
│       ├── limits.ts                  # Generation limits
│       └── schemas.ts                 # Zod exports
├── shared/
│   ├── worksheet.ts       # Zod schemas (Subject, Worksheet, GenerateSchema...)
│   └── types.ts           # Presentation types, dashboard types, error codes
├── db/
│   └── schema.ts          # Drizzle ORM schema (10 tables)
└── docs/                  # Documentation
    ├── subject/           # Reference materials per subject
    └── presexample/       # Presentation examples
```

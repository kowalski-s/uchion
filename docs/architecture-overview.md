# Architecture Overview

## 1. Общая концепция

Uchion -- веб-сервис генерации рабочих листов для школьников 1-11 классов с помощью AI. Полный цикл: от ввода темы до PDF-файла для печати.

**Предметы**: Математика (1-6), Алгебра (7-11), Геометрия (7-11), Русский язык (1-11).

## 2. Архитектура системы

### 2.1 Frontend
- **Tech**: React 18, Vite 7, TypeScript, Tailwind CSS
- **Routing**: SPA (React Router)
  - `/` -- генерация (GeneratePage)
  - `/worksheet/:id` -- просмотр и скачивание (WorksheetPage)
  - `/dashboard` -- личный кабинет
  - `/worksheets` -- список сохраненных листов
  - `/saved/:id` -- просмотр сохраненного листа
  - `/login` -- вход
  - `/payment/success`, `/payment/cancel` -- результат оплаты
- **State**: Zustand (глобальный) + React Query (async)
- **API**: `fetch` + SSE для стриминга прогресса
- **Math**: KaTeX для рендеринга формул

### 2.2 Backend
- **Tech**: Express.js 5 (Node.js 20+)
- **API**: REST JSON + SSE streaming
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: Custom OAuth 2.0 (Yandex, Telegram)
- **Payments**: Prodamus (webhook-based)
- **Alerts**: Telegram Bot для админов
- **Key Endpoints**:
  - `POST /api/generate` -- генерация листа (SSE)
  - `GET/POST/PATCH/DELETE /api/worksheets` -- CRUD листов
  - `GET/POST/PATCH/DELETE /api/folders` -- папки
  - `/api/auth/*` -- аутентификация
  - `/api/admin/*` -- админ-панель (stats, users, generations, payments)
  - `/api/billing/*` -- создание платежных ссылок, webhook Prodamus

### 2.3 Shared Layer
- **Path**: `shared/`
- **Цель**: единый источник типов и Zod-схем для клиента и сервера

---

## 3. Data Flow

1. **Запрос**: Пользователь заполняет форму (предмет, класс, тема, тип заданий, сложность, формат) -> `POST /api/generate`
2. **Генерация**:
   - Собираются промпты из config-driven системы (`api/_lib/generation/`)
   - LLM генерирует JSON с массивом `tasks` (5 типов заданий)
   - Задания разделяются на тестовые и открытые
3. **Догенерация** (retry):
   - Если заданий не хватает, запускается retry для недостающих
4. **Сборка**:
   - Конвертация в формат `Worksheet` (assignments + test + answers)
   - PDF генерация через `pdfkit` (Base64)
5. **Ответ**: SSE стрим (Progress -> Result) клиенту
6. **Сохранение**: Лист сохраняется в БД (если пользователь авторизован)

---

## 4. Ключевые модули

### Generation Config (`api/_lib/generation/config/`)
Config-driven система генерации:
- **subjects/** -- конфиги предметов (math, algebra, geometry, russian) с темами по классам
- **task-types.ts** -- 5 типов заданий с Zod-валидацией и промпт-инструкциями
- **worksheet-formats.ts** -- форматы листов (open_only, test_only, test_and_open) с вариантами
- **difficulty.ts** -- уровни сложности (easy, medium, hard)

### AI Provider (`api/_lib/ai-provider.ts`)
- **DummyProvider**: локальный стаб для разработки
- **OpenAIProvider**: продакшн. Генерация + retry недостающих заданий

### PDF Generator (`api/_lib/pdf.ts`)
- Server-side через `pdfkit`
- Поддержка KaTeX для мат. формул

### Authentication (`server/routes/auth.ts`)
- Yandex OAuth (PKCE)
- Telegram Login Widget
- JWT tokens (access + refresh) с ротацией
- Rate limiting

### Admin Panel (`server/routes/admin.ts`)
- Статистика (пользователи, генерации, платежи)
- Списки пользователей, генераций, ошибок
- Управление пользователями

### Billing (`server/routes/billing.ts`)
- Prodamus integration
- Создание платежных ссылок
- Webhook обработка с idempotency

### Alerts (`api/_lib/alerts/`, `api/_lib/telegram/`)
- Telegram Bot для уведомлений админов
- Алерты о качестве генерации

---

## 5. Infrastructure

- **Hosting**: VPS via Dokploy
- **CI/CD**: Git push -> Dokploy auto-deploy
- **Database**: PostgreSQL (Supabase или self-hosted)
- **Environment**:
  - `dev`: Vite + Express, DummyProvider
  - `prod`: Express server, OpenAI через polza.ai

---

## 6. Directory Structure

```
uchion/
├── server.ts              # Express entry point
├── server/
│   ├── routes/
│   │   ├── auth.ts        # Authentication
│   │   ├── generate.ts    # AI generation
│   │   ├── worksheets.ts  # Worksheet CRUD
│   │   ├── folders.ts     # Folder CRUD
│   │   ├── admin.ts       # Admin panel API
│   │   ├── billing.ts     # Prodamus payments
│   │   ├── telegram.ts    # Telegram bot
│   │   └── health.ts      # Health check
│   ├── middleware/
│   │   ├── auth.ts        # Auth middleware
│   │   ├── cookies.ts     # Cookie handling
│   │   └── rate-limit.ts  # Rate limiting
│   └── lib/
│       └── prodamus.ts    # Prodamus helpers
├── api/
│   └── _lib/
│       ├── generation/    # Config-driven generation
│       │   ├── config/
│       │   │   ├── subjects/   # math, algebra, geometry, russian
│       │   │   ├── task-types.ts
│       │   │   ├── worksheet-formats.ts
│       │   │   ├── difficulty.ts
│       │   │   └── types.ts
│       │   └── prompts.ts
│       ├── ai/            # AI modules
│       │   ├── schema.ts
│       │   └── validator.ts
│       ├── auth/          # Auth utilities
│       ├── alerts/        # Generation alerts
│       ├── telegram/      # Telegram Bot API
│       ├── ai-provider.ts # AI provider abstraction
│       └── pdf.ts         # PDF generation
├── src/                   # React frontend
│   ├── pages/             # GeneratePage, WorksheetPage, DashboardPage, etc.
│   ├── components/        # UI components
│   ├── store/             # Zustand stores
│   └── lib/               # Utilities
├── shared/                # Shared types (worksheet.ts)
├── db/                    # Schema + migrations
└── docs/                  # Documentation
    └── subject/           # Reference materials per subject
```

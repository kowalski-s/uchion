# API Design

## 1. General

- **Protocol**: HTTPS
- **Format**: JSON (requests), SSE (streaming responses)
- **Schemas**: Zod (`shared/worksheet.ts`, `shared/types.ts`)
- **Auth**: JWT tokens в httpOnly cookies

---

## 2. Authentication Endpoints

### `GET /api/auth/yandex/redirect`
Начать Yandex OAuth flow (PKCE). Redirect на Yandex.

### `GET /api/auth/yandex/callback`
Callback после Yandex OAuth. Устанавливает cookies и redirect на frontend.

### `POST /api/auth/email/send-code`
Отправить 6-значный OTP код на email через Unisender Go.

**Request (JSON)**:
```json
{ "email": "user@example.com" }
```

**Rate limit**: 3 per 10 min per email.

### `POST /api/auth/email/verify-code`
Проверить OTP код. При успехе -- создает/находит пользователя и устанавливает JWT cookies.

**Request (JSON)**:
```json
{ "email": "user@example.com", "code": "123456" }
```

**Rate limit**: 10 per 10 min per IP + per email.

### `GET /api/auth/me`
Текущий пользователь с подпиской. Требует `access_token` cookie.

**Response (200)**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "Name",
  "role": "user",
  "generationsLeft": 5,
  "subscription": { "plan": "free", "status": "active" }
}
```

### `POST /api/auth/logout`
Logout, revoke refresh token.

### `POST /api/auth/refresh`
Обновить access token через refresh token cookie. Token family tracking для обнаружения кражи.

---

## 3. Generation Endpoints

### `POST /api/generate`
Генерация рабочего листа через SSE.

**Request (JSON)**:
```typescript
{
  subject: "math" | "algebra" | "geometry" | "russian",
  grade: number (1-11),
  topic: string (3-200 chars),
  folderId?: string (UUID),
  taskTypes?: TaskTypeId[] (1-5 типов),
  difficulty?: "easy" | "medium" | "hard",
  format?: "open_only" | "test_only" | "test_and_open",
  variantIndex?: number (0-2)
}
```

**Response (SSE)**:

Progress:
```json
data: { "type": "progress", "percent": 10 }
```

Result:
```json
data: {
  "type": "result",
  "data": {
    "worksheet": {
      "id": "uuid",
      "subject": "math",
      "grade": "3 класс",
      "topic": "Сложение",
      "assignments": [...],
      "test": [...],
      "answers": {...},
      "pdfBase64": "JVBERi..."
    }
  }
}
```

Error:
```json
data: { "type": "error", "code": "AI_ERROR", "message": "..." }
```

**Notes**:
- Атомарный декремент `generationsLeft` перед генерацией
- Rollback при ошибке генерации
- Rate limiting: 6/hour (burst protection)
- Мульти-агентная валидация (answer-verifier, task-fixer)
- PDF генерируется через Puppeteer, возвращается как `pdfBase64`
- Сохраняется в БД (max 20 листов на пользователя, старые soft-delete)

### `POST /api/generate/regenerate-task`
Перегенерация одного задания. Стоимость: 1 генерация.

**Request (JSON)**:
```typescript
{
  taskIndex: number,
  taskType: TaskTypeId,
  subject: Subject,
  grade: number,
  topic: string,
  difficulty: DifficultyLevel
}
```

**Response (JSON)**:
```json
{
  "testQuestion": {...},    // если тестовое задание
  "assignment": {...},      // если открытое задание
  "answer": "..."
}
```

**Rate limit**: 10/min per user.

### `POST /api/generate/rebuild-pdf`
Пересборка PDF из отредактированного листа. Бесплатно, без AI.

**Request (JSON)**:
```typescript
{
  worksheet: Worksheet  // полная структура листа
}
```

**Response (JSON)**:
```json
{ "pdfBase64": "JVBERi..." }
```

**Rate limit**: 10/min per IP.

---

## 4. Presentation Endpoints

### `POST /api/presentations/generate`
Генерация презентации через SSE.

**Request (JSON)**:
```typescript
{
  subject: "math" | "algebra" | "geometry" | "russian",
  grade: number (1-11),
  topic: string,
  themeType: "preset" | "custom",
  themePreset?: "professional" | "kids" | "school",
  themeCustom?: string,
  slideCount: 12 | 18 | 24
}
```

**Response (SSE)**:

Progress:
```json
data: { "type": "progress", "percent": 50 }
```

Result:
```json
data: {
  "type": "result",
  "data": {
    "id": "uuid",
    "title": "Презентация: Сложение",
    "pptxBase64": "UEsDBBQ...",
    "pdfBase64": "JVBERi...",
    "slideCount": 12,
    "structure": {...}
  }
}
```

**Notes**:
- Стоимость: 1 генерация
- Генерация через Claude (claude-sonnet-4.5)
- PPTX через pptxgenjs, PDF через Puppeteer
- Сохраняется в БД (таблица `presentations`, max 15 на пользователя)

### `GET /api/presentations`
Список презентаций пользователя. Auth required.

**Rate limit**: 30/min per user.

### `GET /api/presentations/:id`
Одна презентация с контентом. Auth required (owner only).

**Rate limit**: 60/min per user.

### `PATCH /api/presentations/:id`
Обновить презентацию (title). Auth required (owner only).

**Rate limit**: 30/min per user.

### `DELETE /api/presentations/:id`
Soft delete. Auth required (owner only).

**Rate limit**: 10/min per user.

---

## 5. Worksheet Endpoints

### `GET /api/worksheets`
Список листов пользователя. Auth required.

**Query**: `limit` (1-100), `folderId` (UUID, optional)

**Rate limit**: 30/min per user.

### `GET /api/worksheets/:id`
Один лист с контентом. Auth required (owner only).

**Rate limit**: 60/min per user.

### `PATCH /api/worksheets/:id`
Обновить лист (title, folderId, content). Auth required (owner only).
Очищает `pdfBase64` при изменении content.

**Rate limit**: 30/min per user.

### `DELETE /api/worksheets/:id`
Soft delete. Auth required (owner only).

**Rate limit**: 10/min per user.

---

## 6. Folder Endpoints

### `GET /api/folders`
Список папок пользователя с количеством листов.

**Rate limit**: 60/min per user.

### `POST /api/folders`
Создать папку. `{ name, color?, parentId? }`

Лимиты по подписке: free=2, basic=10, premium=10.

**Rate limit**: 30/min per user.

### `PATCH /api/folders/:id`
Обновить папку (name, color, parentId, sortOrder).

**Rate limit**: 30/min per user.

### `DELETE /api/folders/:id`
Soft delete (листы перемещаются в корень).

**Rate limit**: 10/min per user.

---

## 7. Admin Endpoints

Все требуют `withAdminAuth`.

### `GET /api/admin/stats`
Общая статистика (пользователи, генерации, платежи, uptime).

### `GET /api/admin/users`
Список пользователей с фильтрами.

### `GET /api/admin/generations`
Лог генераций (фильтр по status/date).

### `GET /api/admin/generation-logs`
Детальные логи событий генерации.

### `GET /api/admin/payments`
Список платежей.

### `POST /api/admin/test-alert`
Отправить тестовый Telegram alert.

### `GET /api/admin/settings`
Настройки системы.

### `GET /api/admin/ai-costs`
Аналитика стоимости AI по моделям и провайдерам.

---

## 8. Billing Endpoints

### `POST /api/billing/create-link`
Создать платежную ссылку Prodamus. Auth required.

**Request**: `{ productCode }` или `{ generationsCount: 5-200 }`
Валидация email/phone, проверка product catalog.

**Rate limit**: 10/min per user.

### `POST /api/billing/webhook`
Webhook от Prodamus. Подпись через HMAC-SHA256.
Idempotent через webhook_events table (eventKey + rawPayloadHash).
Обновляет `generationsLeft` при успешной оплате.

### `GET /api/billing/payment-intent/:id`
Проверка статуса payment intent.

**Rate limit**: 30/min per user.

---

## 9. Telegram Endpoint

### `POST /api/telegram/webhook`
Webhook Telegram бота. Проверка `X-Telegram-Bot-Api-Secret-Token`.
Обработка команд, админ-уведомления.

---

## 10. Health Check

### `GET /api/health`
```json
{ "status": "ok", "timestamp": "..." }
```

---

## 11. Data Models

### Subject
```typescript
type Subject = "math" | "algebra" | "geometry" | "russian"
```

### TaskTypeId
```typescript
type TaskTypeId = "single_choice" | "multiple_choice" | "open_question" | "matching" | "fill_blank"
```

### PresentationThemePreset
```typescript
// Active on site:
type PresentationThemePreset = "professional" | "kids" | "school"
// Also in DB enum: "educational" | "minimal" | "scientific"
```

### Worksheet
```typescript
interface Worksheet {
  id: string
  subject: Subject
  grade: string          // "3 класс"
  topic: string
  assignments: Assignment[]   // Открытые задания
  test: TestQuestion[]        // Тестовые вопросы
  answers: WorksheetAnswers
  pdfBase64: string
}
```

### Assignment
```typescript
interface Assignment {
  title: string  // "Задание 1"
  text: string   // Текст задания (или HTML-комментарий с JSON для matching)
}
```

### TestQuestion
```typescript
interface TestQuestion {
  question: string
  options: string[]
  answer: string
}
```

---

## 12. Error Handling

### HTTP Status Codes
- `400` Bad Request -- validation errors, invalid input
- `401` Unauthorized -- missing or invalid authentication
- `403` Forbidden -- insufficient permissions, limit exceeded
- `404` Not Found -- resource does not exist
- `429` Too Many Requests -- rate limit exceeded
- `500` Internal Server Error -- server-side errors

### Standard Error Format
```json
{ "error": "Error message string" }
```

With field-level validation details:
```json
{
  "error": "Validation error",
  "details": {
    "topic": "Topic must be 3-200 characters"
  }
}
```

### Headers
- `Retry-After` (seconds) -- included with 429 responses

### Error Codes
- `VALIDATION_ERROR` -- invalid input (400)
- `UNAUTHORIZED` -- authentication required (401)
- `NOT_FOUND` -- resource not found (404)
- `RATE_LIMIT_EXCEEDED` -- rate limit hit (429)
- `FOLDER_LIMIT_EXCEEDED` -- folder limit reached (403)
- `LIMIT_EXCEEDED` -- generation limit reached (403)
- `AI_ERROR` -- AI generation failed (500)
- `PDF_ERROR` -- PDF generation failed (500)
- `SERVER_ERROR` -- internal server error (500)

### SSE Error Format
SSE endpoints (`/api/generate`, `/api/presentations/generate`) use:
```json
data: { "type": "error", "code": "AI_ERROR", "message": "..." }
```

---

## 13. Rate Limits

| Endpoint | Limit | Window | Per |
|----------|-------|--------|-----|
| `POST /api/generate` | 6 | 1 hour | user (burst) |
| `POST /api/generate/regenerate-task` | 10 | 1 min | user |
| `POST /api/generate/rebuild-pdf` | 10 | 1 min | IP |
| `GET /api/worksheets` | 30 | 1 min | user |
| `GET /api/worksheets/:id` | 60 | 1 min | user |
| `PATCH /api/worksheets/:id` | 30 | 1 min | user |
| `DELETE /api/worksheets/:id` | 10 | 1 min | user |
| `GET /api/folders` | 60 | 1 min | user |
| `POST /api/folders` | 30 | 1 min | user |
| `POST /api/billing/create-link` | 10 | 1 min | user |
| `POST /api/billing/webhook` | rate limited | -- | IP |
| `/api/auth/*` | varies | varies | IP/user |

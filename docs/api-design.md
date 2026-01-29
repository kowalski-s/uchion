# API Design

## 1. General

- **Protocol**: HTTPS
- **Format**: JSON (requests), SSE (streaming responses)
- **Schemas**: Zod (`shared/worksheet.ts`)
- **Auth**: JWT tokens в httpOnly cookies

---

## 2. Authentication Endpoints

### `GET /api/auth/yandex/redirect`
Начать Yandex OAuth flow. Redirect на Yandex.

### `GET /api/auth/yandex/callback`
Callback после Yandex OAuth. Устанавливает cookies и redirect на frontend.

### `GET /api/auth/telegram/callback`
Callback от Telegram Login Widget. Проверяет HMAC-SHA256 подпись.

### `GET /api/auth/me`
Текущий пользователь. Требует `access_token` cookie.

**Response (200)**:
```json
{ "id": "uuid", "email": "user@example.com", "name": "Name", "role": "user" }
```

### `POST /api/auth/logout`
Logout, revoke tokens.

### `POST /api/auth/refresh`
Обновить access token через refresh token cookie.

---

## 3. Generation Endpoint

### `POST /api/generate`

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

---

## 4. Worksheet Endpoints

### `GET /api/worksheets`
Список листов пользователя. Auth required.

**Query**: `limit`, `offset`, `folderId`

### `GET /api/worksheets/:id`
Один лист с контентом. Auth required (owner only).

### `PATCH /api/worksheets/:id`
Обновить лист (title, folderId, content). Auth required (owner only).

### `DELETE /api/worksheets/:id`
Удалить лист. Auth required (owner only).

---

## 5. Folder Endpoints

### `GET /api/folders`
Список папок пользователя.

### `POST /api/folders`
Создать папку. `{ name, parentId? }`

### `PATCH /api/folders/:id`
Обновить папку.

### `DELETE /api/folders/:id`
Удалить папку (листы перемещаются в корень).

---

## 6. Admin Endpoints

Все требуют `withAdminAuth`.

### `GET /api/admin/stats`
Общая статистика (пользователи, генерации, платежи).

### `GET /api/admin/users`
Список пользователей с фильтрами.

### `GET /api/admin/generations`
Лог генераций.

### `GET /api/admin/payments`
Список платежей.

---

## 7. Billing Endpoints

### `POST /api/billing/create-link`
Создать платежную ссылку Prodamus. Auth required.

### `POST /api/billing/webhook`
Webhook от Prodamus. Подпись проверяется через HMAC-SHA256. Idempotent через webhook_events table.

---

## 8. Data Models

### Subject
```typescript
type Subject = "math" | "algebra" | "geometry" | "russian"
```

### TaskTypeId
```typescript
type TaskTypeId = "single_choice" | "multiple_choice" | "open_question" | "matching" | "fill_blank"
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
  text: string   // Текст задания (или JSON для matching)
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

## 9. Error Handling

Error codes:
- `VALIDATION_ERROR` -- невалидный input
- `AI_ERROR` -- модель не смогла сгенерировать
- `PDF_ERROR` -- ошибка сборки PDF
- `SERVER_ERROR` -- внутренняя ошибка
- `RATE_LIMIT` -- превышен лимит
- `UNAUTHORIZED` -- нужна авторизация
- `FORBIDDEN` -- нет прав

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```

---

## 10. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/generate` (guest) | 5 | 1 hour |
| `/api/generate` (user) | 20 | 1 hour |
| `/api/auth/*` | 10-60 | varies |
| `/api/worksheets` | 100 | 1 min |
| `/api/admin/*` | 30 | 1 min |
| `/api/billing/create-link` | rate limited | per user |
| `/api/billing/webhook` | rate limited | per IP |

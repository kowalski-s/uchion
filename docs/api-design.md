# API Design

## 1. General Principles

- **Protocol**: HTTPS
- **Format**: JSON (requests), SSE (streaming responses)
- **Schemas**: Defined in `shared/worksheet.ts` (Zod)
- **Authentication**: JWT tokens in httpOnly cookies

---

## 2. Authentication Endpoints

### `GET /api/auth/yandex/redirect`
Start Yandex OAuth flow.

**Response**: Redirect to Yandex OAuth

### `GET /api/auth/yandex/callback`
Handle Yandex OAuth callback.

**Response**: Redirect to frontend with auth cookies set

### `GET /api/auth/telegram/callback`
Handle Telegram login.

**Query Parameters**:
```typescript
{
  id: string
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: string
  hash: string
}
```

**Response**: Redirect to frontend with auth cookies set

### `GET /api/auth/me`
Get current user info.

**Headers**: Requires `access_token` cookie

**Response (200)**:
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "User Name",
  "role": "user"
}
```

**Response (401)**: Not authenticated

### `POST /api/auth/logout`
Logout and revoke tokens.

**Response (200)**:
```json
{ "success": true }
```

### `POST /api/auth/refresh`
Refresh access token using refresh token.

**Headers**: Requires `refresh_token` cookie

**Response (200)**: New tokens set in cookies

---

## 3. Generation Endpoint

### `POST /api/generate`
Generate a worksheet with AI.

#### Request (JSON)
Schema `GenerateSchema`:
```typescript
{
  subject: "math" | "russian",
  grade: number (1-4),
  topic: string (3-200 chars),
  folderId?: string (UUID, optional)
}
```

#### Response (Server-Sent Events)

Progress streaming for real-time feedback.

**Events:**

1. **Progress**:
   ```json
   data: { "type": "progress", "percent": 10 }
   ```

2. **Result (Success)**:
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

3. **Error**:
   ```json
   data: {
     "type": "error",
     "code": "AI_ERROR" | "VALIDATION_ERROR" | "SERVER_ERROR",
     "message": "Error description"
   }
   ```

---

## 4. Worksheet Endpoints

### `GET /api/worksheets`
List user's worksheets.

**Auth**: Required

**Query Parameters**:
- `limit` (number, default 50, max 100)
- `offset` (number, default 0)
- `folderId` (UUID, optional)

**Response (200)**:
```json
{
  "worksheets": [
    {
      "id": "uuid",
      "title": "Worksheet Title",
      "subject": "math",
      "grade": 3,
      "topic": "Сложение",
      "folderId": "uuid" | null,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ],
  "total": 100
}
```

### `GET /api/worksheets/:id`
Get single worksheet with content.

**Auth**: Required (owner only)

**Response (200)**:
```json
{
  "id": "uuid",
  "title": "Worksheet Title",
  "subject": "math",
  "grade": 3,
  "topic": "Сложение",
  "content": {...},
  "folderId": "uuid" | null,
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

### `PATCH /api/worksheets/:id`
Update worksheet.

**Auth**: Required (owner only)

**Request**:
```json
{
  "title": "New Title",
  "folderId": "uuid" | null,
  "content": {...}
}
```

### `DELETE /api/worksheets/:id`
Delete worksheet.

**Auth**: Required (owner only)

---

## 5. Folder Endpoints

### `GET /api/folders`
List user's folders.

**Auth**: Required

### `POST /api/folders`
Create folder.

**Request**:
```json
{
  "name": "Folder Name",
  "parentId": "uuid" | null
}
```

### `PATCH /api/folders/:id`
Update folder.

### `DELETE /api/folders/:id`
Delete folder (moves worksheets to root).

---

## 6. Data Models

All types synchronized between client and server via `shared/worksheet.ts`.

### Worksheet
```typescript
interface Worksheet {
  id: string
  subject: "math" | "russian"
  grade: string
  topic: string
  assignments: Assignment[]
  test: TestQuestion[]
  answers: WorksheetAnswers
  pdfBase64: string
}
```

### Assignment
```typescript
interface Assignment {
  title: string  // "Задание 1"
  text: string   // Task text
}
```

### TestQuestion
```typescript
interface TestQuestion {
  question: string
  options: string[]  // ["Option 1", "Option 2", "Option 3"]
  answer: string     // Correct answer
}
```

---

## 7. Error Handling

Error codes (`ApiErrorCode`):
- `VALIDATION_ERROR`: Invalid input data (Zod)
- `AI_ERROR`: Model failed to generate valid content
- `PDF_ERROR`: PDF assembly error
- `SERVER_ERROR`: Internal server error
- `RATE_LIMIT`: Rate limit exceeded
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions

**Error Response Format**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable message"
  }
}
```

---

## 8. Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/generate` (guest) | 5 | 1 hour |
| `/api/generate` (user) | 20 | 1 hour |
| `/api/auth/*` | 10-60 | varies |
| `/api/worksheets` | 100 | 1 min |

---

## 9. Security

- **Validation**: Strict Zod schemas for all inputs
- **Sanitization**: AI output parsed and typed before client delivery
- **Authorization**: Owner checks on all protected resources
- **Rate Limiting**: Per-endpoint limits prevent abuse
- **Token Limits**: `max_output_tokens` for AI prevents cost overruns

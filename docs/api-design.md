# API Design

## 1. Общие принципы

- **Протокол**: HTTPS.
- **Формат**: JSON (запросы), SSE (ответы).
- **Схемы**: Описаны в `shared/worksheet.ts` (Zod).

---

## 2. Endpoints

### `POST /api/generate`

Генерация рабочего листа в режиме реального времени.

#### Request (JSON)
Схема `GenerateSchema`:
```typescript
{
  "subject": "math" | "russian",
  "grade": number (1-4),
  "topic": string (3-200 chars)
}
```

#### Response (Server-Sent Events)

Поток событий для отображения прогресса пользователю.

**События:**

1.  **Progress**:
    ```json
    data: { "type": "progress", "percent": 10 }
    ```
    
2.  **Result (Успех)**:
    ```json
    data: {
      "type": "result",
      "data": {
        "worksheet": {
          "id": "uuid",
          "subject": "math",
          "grade": "3 класс",
          "topic": "Сложение",
          "assignments": [...], // 7 заданий
          "test": [...], // 10 вопросов
          "answers": {...},
          "pdfBase64": "JVBERi..."
        }
      }
    }
    ```

3.  **Error (Ошибка)**:
    ```json
    data: {
      "type": "error",
      "code": "AI_ERROR" | "VALIDATION_ERROR" | "SERVER_ERROR",
      "message": "Описание ошибки"
    }
    ```

---

## 3. Модели Данных

Все типы синхронизированы между клиентом и сервером через `shared/worksheet.ts`.

### Worksheet (Основная сущность)
```typescript
interface Worksheet {
  id: string;
  subject: "math" | "russian";
  grade: string;
  topic: string;
  assignments: Assignment[]; // Массив из 7 заданий
  test: TestQuestion[];      // Массив из 10 вопросов
  answers: WorksheetAnswers; // Ответы для учителя
  pdfBase64: string;         // Готовый файл
}
```

### Assignment (Задание)
```typescript
interface Assignment {
  title: string; // "Задание 1"
  text: string;  // Текст задания
}
```

### TestQuestion (Вопрос теста)
```typescript
interface TestQuestion {
  question: string;
  options: string[]; // ["Вариант 1", "Вариант 2", "Вариант 3"]
  answer: string;    // Правильный ответ
}
```

---

## 4. Обработка Ошибок

Коды ошибок (`ApiErrorCode`):
- `VALIDATION_ERROR`: Неверные входные данные (Zod).
- `AI_ERROR`: Модель не смогла сгенерировать валидный контент после всех попыток регенерации.
- `PDF_ERROR`: Ошибка при сборке PDF.
- `SERVER_ERROR`: Внутренняя ошибка сервера.
- `RATE_LIMIT`: Превышен лимит запросов (планируется).

---

## 5. Безопасность

- **Валидация**: Строгая проверка всех входных полей через Zod.
- **Санитизация**: Данные от AI проходят парсинг и типизацию перед отправкой клиенту.
- **Лимиты**: `max_output_tokens` для AI, таймауты для Vercel Functions.

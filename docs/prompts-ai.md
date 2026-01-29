# AI Generation Architecture

## 1. Структура

Вся логика генерации находится в `api/_lib/generation/` и `api/_lib/ai-provider.ts`.

### Компоненты:
1. **`generation/config/subjects/`** -- конфиги предметов (темы, ограничения, промпты по классам)
2. **`generation/config/task-types.ts`** -- 5 типов заданий с Zod-схемами и промпт-инструкциями
3. **`generation/config/worksheet-formats.ts`** -- форматы листов (количество заданий)
4. **`generation/config/difficulty.ts`** -- уровни сложности
5. **`generation/prompts.ts`** -- сборка system/user промптов из конфигов
6. **`ai-provider.ts`** -- оркестратор (генерация, парсинг, retry, конвертация)

---

## 2. Предметы

Каждый предмет определен в `generation/config/subjects/`:

| Предмет | Файл | Классы | ID |
|---------|------|--------|----|
| Математика | `math.ts` | 1-6 | `math` |
| Алгебра | `algebra.ts` | 7-11 | `algebra` |
| Геометрия | `geometry.ts` | 7-11 | `geometry` |
| Русский язык | `russian.ts` | 1-11 | `russian` |

Конфиг предмета (`SubjectConfig`):
- `id`, `name` -- идентификатор и название
- `gradeRange` -- диапазон классов
- `grades` -- конфиг для каждого класса:
  - `topics` -- список тем из ФГОС
  - `constraints.allowed` -- разрешенные понятия
  - `constraints.softForbidden` -- запрещенные понятия
  - `promptHint` -- подсказка для LLM
- `systemPrompt` -- системный промпт для предмета

---

## 3. Типы заданий

5 типов (`generation/config/task-types.ts`):

| Тип | Описание | Пример |
|-----|----------|--------|
| `single_choice` | Один правильный ответ из 3-5 вариантов | "Чему равно 24 / 6 + 3?" |
| `multiple_choice` | 2+ правильных из 4-6 вариантов | "Какие числа делятся на 3?" |
| `open_question` | Короткий ответ (число/слово) | "Найдите периметр квадрата" |
| `matching` | Соединение двух столбцов (3-6 пар) | "Соедини выражение с результатом" |
| `fill_blank` | Вставка пропущенного (1-4 пропуска) | "Из ___(1)___ вычесть ___(2)___" |

Каждый тип имеет:
- Zod-схему для валидации ответа LLM
- Промпт-инструкцию (как генерировать)
- Пример валидного задания
- Подсказки по предметам

---

## 4. Форматы листов

3 формата (`generation/config/worksheet-formats.ts`):

| Формат | Описание | Варианты |
|--------|----------|----------|
| `test_and_open` | Тест + задания (default) | 5+10 / 10+15 / 15+20 |
| `open_only` | Только задания | 5 / 10 / 15 |
| `test_only` | Только тест | 10 / 15 / 20 |

Каждый вариант имеет стоимость в генерациях (1 / 2 / 3).

---

## 5. Процесс генерации

### Шаг 1: Сборка промптов (`generation/prompts.ts`)
- `buildSystemPrompt(subject)` -- системный промпт из конфига предмета
- `buildUserPrompt(params)` -- пользовательский промпт с:
  - Темой и классом
  - Типами заданий и их инструкциями
  - Количеством заданий (из формата)
  - Уровнем сложности
  - JSON-форматом ответа

### Шаг 2: LLM вызов (`ai-provider.ts`)
- Модель: `AI_MODEL_GENERATION` (default: `gpt-4.1-mini`)
- `max_tokens: 8000`, `temperature: 0.5`
- Ответ: JSON с массивом `tasks`, каждый с полем `type`

### Шаг 3: Парсинг
- Извлечение JSON из markdown-обертки (regex `/{[\s\S]*}/`)
- Разделение на тестовые (single/multiple_choice) и открытые (остальные)

### Шаг 4: Retry (догенерация)
- Если заданий меньше, чем нужно -- отдельный LLM вызов для недостающих
- `max_tokens: 4000` для retry

### Шаг 5: Конвертация в Worksheet
- `convertToWorksheet()` -- преобразует `GeneratedTask[]` в `Assignment[]` + `TestQuestion[]` + `WorksheetAnswers`
- Matching задания сериализуются в HTML-комментарий: `<!--MATCHING:{...}-->`

---

## 6. Модели

| Назначение | Env var | Default |
|------------|---------|---------|
| Генерация | `AI_MODEL_GENERATION` | `gpt-4.1-mini` |
| Валидация | `AI_MODEL_VALIDATION` | `gpt-4.1-nano` |
| Разработка | -- | `DummyProvider` (hardcoded) |

Token limits:
- Генерация: `max_tokens: 8000`
- Retry: `max_tokens: 4000`
- Валидация: `max_tokens: 600`

---

## 7. Добавление нового предмета

1. Создать `api/_lib/generation/config/subjects/newsubject.ts`
2. Определить `SubjectConfig`: gradeRange, grades (topics, constraints, promptHint), systemPrompt
3. Зарегистрировать в `subjects/index.ts` и `config/index.ts`
4. Добавить в `SubjectSchema` (`shared/worksheet.ts`) и `subjectEnum` (`db/schema.ts`)
5. Обновить frontend (селектор предмета)

# AI Generation Architecture

## 1. Структура

Логика генерации находится в `api/_lib/generation/`, `api/_lib/ai-provider.ts`, `api/_lib/ai-models.ts` и `api/_lib/presentations/`.

### Компоненты:
1. **`generation/config/subjects/`** -- конфиги предметов (темы, ограничения, промпты по классам)
2. **`generation/config/task-types.ts`** -- 5 типов заданий с Zod-схемами и промпт-инструкциями
3. **`generation/config/worksheet-formats.ts`** -- форматы листов (количество заданий)
4. **`generation/config/difficulty.ts`** -- уровни сложности
5. **`generation/config/task-distribution.ts`** -- распределение типов заданий
6. **`generation/prompts.ts`** -- сборка system/user промптов из конфигов
7. **`ai-provider.ts`** -- оркестратор (генерация, парсинг, retry, конвертация, валидация)
8. **`ai-models.ts`** -- выбор модели по типу пользователя и предмету
9. **`ai/validator.ts`** -- мульти-агентная валидация
10. **`presentations/`** -- генерация презентаций (отдельная подсистема)

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
| `multiple_choice` | 2-3 правильных из 5 вариантов | "Какие числа делятся на 3?" |
| `open_question` | Короткий ответ (число/слово/фраза) | "Найдите периметр квадрата" |
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

| Формат | Вариант 0 | Вариант 1 (Профи) | Вариант 2 (Профи+) |
|--------|-----------|--------------------|--------------------|
| `test_and_open` | 5 open + 10 test (1 gen) | 10 open + 15 test (2 gen) | 15 open + 20 test (3 gen) |
| `open_only` | 5 open (1 gen) | 10 open (2 gen) | 15 open (3 gen) |
| `test_only` | 10 test (1 gen) | 15 test (2 gen) | 20 test (3 gen) |

---

## 5. Процесс генерации рабочих листов

### Шаг 1: Сборка промптов (`generation/prompts.ts`)
- `buildSystemPrompt(subject)` -- системный промпт из конфига предмета
- `buildUserPrompt(params)` -- пользовательский промпт с:
  - Темой и классом
  - Типами заданий и их инструкциями
  - Количеством заданий (из формата)
  - Уровнем сложности
  - JSON-форматом ответа

### Шаг 2: LLM вызов (`ai-provider.ts`)
- Выбор модели через `getGenerationModel(isPaid)`:
  - Платные: `gpt-4.1` (default)
  - Бесплатные: `deepseek/deepseek-chat` (default)
- `max_tokens: 16000`, `temperature: 0.5`
- Ответ: JSON с массивом `tasks`, каждый с полем `type`

### Шаг 3: Парсинг
- Извлечение JSON из markdown-обертки (regex `/{[\s\S]*}/`)
- Фикс обрезанного JSON (если ответ обрезан по token limit)
- Разделение на тестовые (single/multiple_choice) и открытые (остальные)

### Шаг 4: Retry (догенерация)
- Если заданий меньше, чем нужно -- отдельный LLM вызов для недостающих

### Шаг 5: Детерминистическая валидация
- Количество слов в заданиях
- Количество вариантов ответов (3-5 для single_choice, 5 для multiple_choice)
- Количество пропусков (1-4 для fill_blank)

### Шаг 6: Мульти-агентная валидация (`ai/validator.ts`)
- **answer-verifier** -- проверяет корректность ответов
  - STEM: `gemini-3-flash-preview` с reasoning effort=low
  - Гуманитарные: `gemini-2.5-flash-lite` без reasoning
- **task-fixer** -- автоисправляет ошибки
  - STEM: `gemini-3-flash-preview` с reasoning effort=minimal
  - Гуманитарные: `gemini-2.5-flash-lite` без reasoning
  - Отключен для гуманитарных предметов (оптимизация токенов)
- **quality-checker** -- оценивает образовательную ценность

### Шаг 7: Конвертация в Worksheet
- `convertToWorksheet()` -- преобразует `GeneratedTask[]` в `Assignment[]` + `TestQuestion[]` + `WorksheetAnswers`
- Matching задания сериализуются в HTML-комментарий: `<!--MATCHING:{...}-->`

### Шаг 8: PDF генерация
- Puppeteer (HTML -> PDF)
- Возвращается как `pdfBase64`

---

## 6. Процесс генерации презентаций

### Компоненты (`api/_lib/presentations/`)
- `generator.ts` -- основной генератор
- `minimalism-generator.ts` -- генератор для темы "минимализм"
- `pdf-generator.ts` -- PDF из HTML через Puppeteer
- `sanitize.ts` -- очистка HTML контента

### Конфиги (`generation/config/presentations/`)
- `subjects/` -- конфиги по предметам (math, algebra, geometry, russian)
- `templates/` -- шаблоны слайдов (minimalism.ts)

### Процесс
1. Модель: `claude-sonnet-4.5` через `getPresentationModel()`
2. Системный промпт из конфига предмета + шаблона
3. 10 типов слайдов: title, content, twoColumn, table, example, formula, diagram, chart, practice, conclusion
4. Генерация JSON-структуры -> PPTX (pptxgenjs) + PDF (Puppeteer)
5. 4 темы оформления: professional, educational, minimal, scientific

---

## 7. Модели

### Выбор модели (`api/_lib/ai-models.ts`)

| Назначение | Функция | Платные | Бесплатные |
|------------|---------|---------|------------|
| Генерация листов | `getGenerationModel(isPaid)` | `gpt-4.1` | `deepseek/deepseek-chat` |
| Агенты | `getAgentsModel()` | `gpt-4.1-mini` | -- |
| Верификатор STEM | `getVerifierModelConfig(subject)` | `gemini-3-flash-preview` (reasoning: low) | -- |
| Верификатор гуманитарные | `getVerifierModelConfig(subject)` | `gemini-2.5-flash-lite` (reasoning: off) | -- |
| Фиксер STEM | `getFixerModelConfig(subject)` | `gemini-3-flash-preview` (reasoning: minimal) | -- |
| Фиксер гуманитарные | `getFixerModelConfig(subject)` | `gemini-2.5-flash-lite` (reasoning: off) | -- |
| Презентации | `getPresentationModel()` | `claude-sonnet-4.5` | -- |

### Разделение STEM vs Гуманитарные
- STEM: math, algebra, geometry -- нужен mathematical reasoning
- Гуманитарные: russian -- не нужен reasoning, дешевле

### Env Variables
```bash
AI_MODEL_PAID=openai/gpt-4.1                        # Генерация (платные)
AI_MODEL_FREE=deepseek/deepseek-chat                 # Генерация (бесплатные)
AI_MODEL_AGENTS=openai/gpt-4.1-mini                  # Агенты
AI_MODEL_VERIFIER_STEM=google/gemini-3-flash-preview  # Верификатор STEM
AI_MODEL_VERIFIER_HUMANITIES=google/gemini-2.5-flash-lite # Верификатор гуманитарных
AI_MODEL_PRESENTATION=anthropic/claude-sonnet-4.5     # Презентации
```

---

## 8. Добавление нового предмета

1. Создать `api/_lib/generation/config/subjects/newsubject.ts`
2. Определить `SubjectConfig`: gradeRange, grades (topics, constraints, promptHint), systemPrompt
3. Зарегистрировать в `subjects/index.ts` и `config/index.ts`
4. Добавить в `SubjectSchema` (`shared/worksheet.ts`) и `subjectEnum` (`db/schema.ts`)
5. Создать `api/_lib/generation/config/presentations/subjects/newsubject.ts`
6. Обновить frontend (селектор предмета)

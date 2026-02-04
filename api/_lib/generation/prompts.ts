import {
  getSubjectConfig,
  getGradeConfig,
  type TaskTypeId,
  getTaskType,
  type DifficultyLevel,
  getDifficultyPrompt,
  type WorksheetFormatId,
  getWorksheetFormat,
  getFormatVariant,
} from './config/index.js'
import { distributeOpenTasks, distributeTestTasks, type TaskDistribution } from './config/task-distribution.js'
import { sanitizeUserInput } from './sanitize.js'

// =============================================================================
// Types
// =============================================================================

export interface PromptParams {
  subject: string
  grade: number
  topic: string
  taskTypes: TaskTypeId[]
  difficulty: DifficultyLevel
  format: WorksheetFormatId
  variantIndex: number
}

// =============================================================================
// Block 1: Role and Context
// =============================================================================

const BASE_ROLE_PROMPT = `
Ты - опытный методист и составитель учебных материалов для российских школ.

Твоя задача - создавать качественные задания для рабочих листов, которые:
- Соответствуют российской школьной программе (ФГОС)
- Подходят по сложности для указанного класса
- Имеют однозначные правильные ответы
- Используют понятные формулировки для возраста ученика

Все задания на русском языке.
`.trim()

// =============================================================================
// Block 2: Subject
// =============================================================================

function getSubjectBlock(subjectId: string): string {
  const config = getSubjectConfig(subjectId)
  if (!config) return ''

  // Если systemPrompt заполнен - используем его
  if (config.systemPrompt) {
    return `ПРЕДМЕТ: ${config.name}\n\n${config.systemPrompt}`
  }

  // Базовые блоки по предметам (пока systemPrompt пустой)
  const basePrompts: Record<string, string> = {
    math: `
ПРЕДМЕТ: Математика (1-6 класс)

Особенности:
- Все вычисления должны быть корректными и проверяемыми
- Числа соответствуют уровню класса
- Текстовые задачи на реальные жизненные ситуации
- Ответы - конкретные числа или выражения
    `.trim(),

    algebra: `
ПРЕДМЕТ: Алгебра (7-11 класс)

Особенности:
- Строгая математическая запись
- Уравнения и выражения записывать корректно
- Ответы могут быть числами, выражениями или множествами
- Использовать стандартные обозначения (x, y, a, b)
    `.trim(),

    geometry: `
ПРЕДМЕТ: Геометрия (7-11 класс)

Особенности:
- Чёткие геометрические формулировки
- Если нужен чертёж - описать словами условие
- Теоремы применять строго по программе класса
- Обозначения точек заглавными буквами (A, B, C)
    `.trim(),

    russian: `
ПРЕДМЕТ: Русский язык (1-11 класс)

Особенности:
- Примеры только из современного литературного языка
- Все примеры орфографически и пунктуационно верны
- Термины соответствуют классу
- Никакого сленга и устаревшей лексики
    `.trim(),
  }

  return basePrompts[subjectId] || `ПРЕДМЕТ: ${config.name}`
}

// =============================================================================
// Block 3: Grade and Topics
// =============================================================================

function getGradeBlock(subjectId: string, grade: number): string {
  const config = getGradeConfig(subjectId, grade as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11)
  if (!config) return `КЛАСС: ${grade}`

  const topicsList = config.topics.map((t) => `- ${t}`).join('\n')

  return `
КЛАСС: ${grade}

${config.promptHint}

Темы программы этого класса:
${topicsList}

Используй понятия и термины, соответствующие этому классу.
  `.trim()
}

// =============================================================================
// Block 4: User Topic
// =============================================================================

function getTopicBlock(topic: string): string {
  const safeTopic = sanitizeUserInput(topic)
  return `
ТЕМА ЗАДАНИЯ: <user_topic>${safeTopic}</user_topic>

Все задания должны быть строго по этой теме.
Если тема выходит за рамки указанного класса - всё равно создай задания, но адаптируй сложность.
  `.trim()
}

// =============================================================================
// Block 5: Task Types
// =============================================================================

function formatDistributionLine(d: TaskDistribution): string {
  const taskType = getTaskType(d.type)
  const name = taskType?.name ?? d.type
  return `- Создай РОВНО ${d.count} ${d.count === 1 ? 'задание' : d.count < 5 ? 'задания' : 'заданий'} типа ${d.type} (${name})`
}

function getTaskTypesBlock(
  taskTypes: TaskTypeId[],
  formatId: WorksheetFormatId,
  variantIndex: number
): string {
  const variant = getFormatVariant(formatId, variantIndex)
  if (!variant) {
    return 'СОЗДАЙ ЗАДАНИЯ по указанным типам.'
  }

  const totalTasks = variant.testQuestions + variant.openTasks

  // Calculate exact distribution per type
  const testDist = distributeTestTasks(variant.testQuestions, taskTypes)
  const openDist = distributeOpenTasks(variant.openTasks, taskTypes)
  const allDist = [...testDist, ...openDist]

  let instructions = `
═══════════════════════════════════════════════════════════════
КРИТИЧЕСКИ ВАЖНО: ТОЧНОЕ КОЛИЧЕСТВО ЗАДАНИЙ КАЖДОГО ТИПА
═══════════════════════════════════════════════════════════════

Ты ОБЯЗАН создать РОВНО ${totalTasks} заданий. Не ${totalTasks - 1}, не ${totalTasks + 1}, а ИМЕННО ${totalTasks}.

ТОЧНОЕ РАСПРЕДЕЛЕНИЕ ПО ТИПАМ:
`

  // Test part
  if (testDist.length > 0) {
    instructions += `\nТЕСТОВАЯ ЧАСТЬ (${variant.testQuestions} шт.):\n`
    for (const d of testDist) {
      instructions += `${formatDistributionLine(d)}\n`
    }
  }

  // Open part
  if (openDist.length > 0) {
    instructions += `\nЗАДАНИЯ С РАЗВЁРНУТЫМ ОТВЕТОМ (${variant.openTasks} шт.):\n`
    for (const d of openDist) {
      instructions += `${formatDistributionLine(d)}\n`
    }
  }

  // Shuffle instruction
  if (testDist.length > 1) {
    instructions += `\nПОРЯДОК ТЕСТОВЫХ ЗАДАНИЙ: Перемешай задания разных типов в случайном порядке внутри тестовой части. НЕ группируй по типу — чередуй single_choice и multiple_choice произвольно.\n`
  }
  if (openDist.length > 1) {
    instructions += `\nПОРЯДОК ОТКРЫТЫХ ЗАДАНИЙ: Перемешай задания разных типов в случайном порядке внутри открытой части. НЕ группируй по типу — чередуй open_question, matching и fill_blank произвольно.\n`
  }

  instructions += `
КОНТРОЛЬНАЯ ПРОВЕРКА (сверься перед ответом):
В финальном JSON массив "tasks" должен содержать РОВНО ${totalTasks} элементов.
Подсчитай количество каждого типа — оно ОБЯЗАНО совпадать:
${allDist.map((d) => `  ✓ ${d.type}: РОВНО ${d.count} шт.`).join('\n')}
Если хотя бы один тип имеет неверное количество — ИСПРАВЬ перед выдачей ответа.

`

  // Per-type instructions (only for types that have count > 0)
  instructions += 'ИНСТРУКЦИИ ПО ТИПАМ:\n\n'

  for (const d of allDist) {
    const taskType = getTaskType(d.type)
    if (taskType) {
      instructions += `${taskType.name.toUpperCase()} (${d.type}) — РОВНО ${d.count} шт.:\n`
      instructions += `${taskType.promptInstruction}\n\n`
    }
  }

  instructions += `ВАЖНО: Соблюдай ТОЧНОЕ количество заданий каждого типа. Не пропускай ни один тип. Перемешай порядок заданий внутри каждого блока.`

  return instructions.trim()
}

// =============================================================================
// Block 6: Difficulty (усиленный, идёт сразу после темы)
// =============================================================================

function getDifficultyBlock(level: DifficultyLevel, subject: string, grade: number): string {
  const difficultyContent = getDifficultyPrompt(level, subject, grade)

  // Определяем название уровня для сообщений
  const levelNames: Record<DifficultyLevel, string> = {
    easy: 'БАЗОВЫЙ',
    medium: 'СРЕДНИЙ',
    hard: 'ПОВЫШЕННЫЙ'
  }
  const levelName = levelNames[level]

  // Инструкции по соблюдению уровня
  let enforcementRules = ''
  if (level === 'easy') {
    enforcementRules = `
СТРОГИЕ ОГРАНИЧЕНИЯ (БАЗОВЫЙ уровень):
✗ ЗАПРЕЩЕНЫ сложные многоступенчатые задачи (более 2 шагов)
✗ ЗАПРЕЩЕНЫ нестандартные формулировки и подвохи
✗ ЗАПРЕЩЕНЫ задания олимпиадного типа
✓ Только прямое применение правил и формул
✓ Простые числа и примеры из учебника
✓ Однозначные формулировки`
  } else if (level === 'medium') {
    enforcementRules = `
СТРОГИЕ ОГРАНИЧЕНИЯ (СРЕДНИЙ уровень):
✗ ЗАПРЕЩЕНЫ слишком простые задания в 1 шаг
✗ ЗАПРЕЩЕНЫ олимпиадные и нестандартные задачи
✓ Стандартные ситуации из учебника
✓ Решение в 2-3 шага
✓ Требуется понимание темы, но без подвохов`
  } else {
    enforcementRules = `
СТРОГИЕ ОГРАНИЧЕНИЯ (ПОВЫШЕННЫЙ уровень):
✗ ЗАПРЕЩЕНЫ простые задачи в 1-2 действия
✗ ЗАПРЕЩЕНЫ задания с очевидным ответом
✓ Нестандартные формулировки и контексты
✓ Решение в 3-5 шагов
✓ Комбинирование нескольких тем или правил
✓ Задания олимпиадного типа`
  }

  return `
═══════════════════════════════════════════════════════════════
⚠️ УРОВЕНЬ СЛОЖНОСТИ — КРИТИЧЕСКИ ВАЖНО ⚠️
═══════════════════════════════════════════════════════════════

${difficultyContent}

${enforcementRules}

Каждое задание ДОЛЖНО соответствовать уровню ${levelName}.
Перед добавлением задания проверь: "Соответствует ли это уровню ${levelName}?"
`.trim()
}

// =============================================================================
// Block 6.5: Diversity (разнообразие заданий)
// =============================================================================

function getSubjectDiversityHints(subject: string): string {
  switch (subject) {
    case 'math':
    case 'algebra':
    case 'geometry':
      return `
Для математических предметов обязательно включи:
• Задания на знание ФОРМУЛ (запиши формулу, выбери правильную формулу)
• Задания на ПОНИМАНИЕ (что изменится если..., верно ли что..., объясни)
• Задания на ВЫЧИСЛЕНИЕ (реши, найди, вычисли)
• Задания на АНАЛИЗ (найди ошибку, сравни способы решения, верно ли утверждение)`

    case 'russian':
      return `
Для русского языка обязательно включи:
• Задания на знание ПРАВИЛ (сформулируй правило, выбери правильное объяснение)
• Задания на ОПРЕДЕЛЕНИЕ (найди подлежащее, определи часть речи, укажи тип)
• Задания на ПРИМЕНЕНИЕ (вставь букву, расставь знаки, исправь ошибку)
• Задания на АНАЛИЗ (объясни написание, сравни предложения, найди ошибку)`

    default:
      return ''
  }
}

function getDiversityBlock(subject: string): string {
  const subjectHints = getSubjectDiversityHints(subject)

  return `
═══════════════════════════════════════════════════════════════
РАЗНООБРАЗИЕ ЗАДАНИЙ — ОБЯЗАТЕЛЬНОЕ ТРЕБОВАНИЕ
═══════════════════════════════════════════════════════════════

Задания ОБЯЗАНЫ покрывать РАЗНЫЕ аспекты темы.
ЗАПРЕЩЕНО делать все задания одного вида (например, все на вычисления).

Распредели задания по категориям:
1. ТЕОРИЯ (20-30%): знание формул, правил, определений, свойств
2. ПОНИМАНИЕ (20-30%): объяснение, сравнение, "что будет если..."
3. ПРИМЕНЕНИЕ (30-40%): решение, вычисление, практическое применение
4. АНАЛИЗ (10-20%): найди ошибку, сравни способы, верно ли утверждение
${subjectHints}

НИКОГДА не генерируй все задания только на один аспект!
Тестовые вопросы тоже должны быть разнообразны: на теорию, понимание, применение.
`.trim()
}

// =============================================================================
// Block 7: Output Format
// =============================================================================

function getFormatBlock(): string {
  return `
ФОРМАТ ОТВЕТА:

Верни ТОЛЬКО валидный JSON без текста до или после:

{
  "tasks": [
    {
      "type": "single_choice",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "..."
    },
    {
      "type": "multiple_choice",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndices": [0, 2],
      "explanation": "..."
    },
    {
      "type": "open_question",
      "question": "...",
      "correctAnswer": "...",
      "acceptableVariants": ["...", "..."],
      "explanation": "..."
    },
    {
      "type": "matching",
      "instruction": "Соотнеси...",
      "leftColumn": ["...", "...", "..."],
      "rightColumn": ["...", "...", "..."],
      "correctPairs": [[0, 1], [1, 0], [2, 2]]
    },
    {
      "type": "fill_blank",
      "textWithBlanks": "Текст с ___(1)___ пропусками ___(2)___",
      "blanks": [
        {"position": 1, "correctAnswer": "...", "acceptableVariants": ["..."]},
        {"position": 2, "correctAnswer": "..."}
      ]
    }
  ]
}

ВАЖНО: Никакого markdown, никакого текста - только JSON.
  `.trim()
}

// =============================================================================
// Block 8: Anti-Patterns
// =============================================================================

const ANTI_PATTERNS_PROMPT = `
═══════════════════════════════════════════════════════════════
УНИКАЛЬНОСТЬ И КАЧЕСТВО ЗАДАНИЙ
═══════════════════════════════════════════════════════════════

КАЖДОЕ ЗАДАНИЕ ДОЛЖНО БЫТЬ УНИКАЛЬНЫМ:
• Нельзя повторять одинаковые или похожие формулировки вопросов
• Нельзя использовать одни и те же числа/примеры в разных заданиях
• Каждое задание должно проверять РАЗНЫЙ аспект темы
• Если 2 задания можно объединить в одно — значит одно из них лишнее

ВАРИАНТЫ ОТВЕТОВ В ТЕСТАХ:
• Варианты ответов НЕ должны повторяться между разными заданиями
• В каждом задании варианты должны быть правдоподобными (не абсурдными)
• Правильный ответ должен быть на РАЗНЫХ позициях в разных заданиях
• Дистракторы (неправильные ответы) должны отражать типичные ошибки учеников

РАЗНООБРАЗИЕ СОДЕРЖАНИЯ:
• НЕ делай все задания только на вычисления/решение
• Включи задания на ТЕОРИЮ: "Какая формула...", "Что называется...", "Выбери верное определение..."
• Включи задания на ПОНИМАНИЕ: "Что произойдёт, если...", "Верно ли утверждение...", "Объясни..."
• Включи задания на АНАЛИЗ: "Найди ошибку в решении...", "Сравни способы...", "Почему неверно..."

ЗАПРЕЩЕНО:
• Задания не по указанной теме
• Задания с неоднозначным или спорным ответом
• Слишком длинные формулировки (более 2-3 предложений)
• Пояснения вне JSON
• Пустые или null значения
`.trim()

// =============================================================================
// Main Functions
// =============================================================================

/**
 * Собрать финальный промпт из всех блоков
 *
 * Порядок блоков оптимизирован для качества генерации:
 * 1. Роль + предмет (контекст)
 * 2. Класс + тема (что генерируем)
 * 3. СЛОЖНОСТЬ (сразу после темы — критически важно!)
 * 4. Типы заданий (сколько и каких)
 * 5. РАЗНООБРАЗИЕ (после типов — как разнообразить)
 * 6. Формат ответа (JSON)
 * 7. Антипаттерны (запреты)
 */
export function buildPrompt(params: PromptParams): string {
  const blocks = [
    BASE_ROLE_PROMPT,
    getSubjectBlock(params.subject),
    getGradeBlock(params.subject, params.grade),
    getTopicBlock(params.topic),
    getDifficultyBlock(params.difficulty, params.subject, params.grade), // Сложность сразу после темы!
    getTaskTypesBlock(params.taskTypes, params.format, params.variantIndex),
    getDiversityBlock(params.subject), // Разнообразие после типов
    getFormatBlock(),
    ANTI_PATTERNS_PROMPT,
  ]

  return blocks.filter(Boolean).join('\n\n---\n\n')
}

/**
 * Получить только системный промпт (роль + предмет)
 */
export function buildSystemPrompt(subjectId: string): string {
  return [BASE_ROLE_PROMPT, getSubjectBlock(subjectId)].join('\n\n')
}

/**
 * Получить user prompt (остальные блоки)
 *
 * Порядок блоков оптимизирован:
 * 1. Класс + тема
 * 2. СЛОЖНОСТЬ (сразу после темы!)
 * 3. Типы заданий
 * 4. РАЗНООБРАЗИЕ
 * 5. Формат + антипаттерны
 */
export function buildUserPrompt(
  params: Omit<PromptParams, 'subject'> & { subject: string }
): string {
  const blocks = [
    getGradeBlock(params.subject, params.grade),
    getTopicBlock(params.topic),
    getDifficultyBlock(params.difficulty, params.subject, params.grade), // Сложность сразу после темы!
    getTaskTypesBlock(params.taskTypes, params.format, params.variantIndex),
    getDiversityBlock(params.subject), // Разнообразие после типов
    getFormatBlock(),
    ANTI_PATTERNS_PROMPT,
  ]

  return blocks.filter(Boolean).join('\n\n---\n\n')
}

/**
 * Получить количество заданий из варианта формата
 */
export function getTaskCounts(
  formatId: WorksheetFormatId,
  variantIndex: number
): { openTasks: number; testQuestions: number } {
  const variant = getFormatVariant(formatId, variantIndex)
  if (!variant) {
    return { openTasks: 5, testQuestions: 10 }
  }
  return {
    openTasks: variant.openTasks,
    testQuestions: variant.testQuestions,
  }
}

/**
 * Получить рекомендуемые типы заданий для формата
 */
export function getRecommendedTaskTypes(formatId: WorksheetFormatId): TaskTypeId[] {
  switch (formatId) {
    case 'test_only':
      return ['single_choice', 'multiple_choice']
    case 'open_only':
      return ['open_question', 'matching', 'fill_blank']
    case 'test_and_open':
    default:
      return ['single_choice', 'multiple_choice', 'open_question', 'matching', 'fill_blank']
  }
}

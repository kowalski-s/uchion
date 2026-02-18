import {
  getSubjectConfig,
  getGradeConfig,
  type TaskTypeId,
  getTaskType,
  type DifficultyLevel,
  getDifficultyPrompt,
  type WorksheetFormatId,
  getFormatVariant,
} from './config/index.js'
import type { SubjectPromptConfig, GradeTierConfig } from './config/types.js'
import { distributeOpenTasks, distributeTestTasks, type TaskDistribution } from './config/task-distribution.js'
import { sanitizeUserInput } from './sanitize.js'

// Per-subject prompt configs (new config-driven path)
import { russianPromptConfig, getRussianGradeTier } from './config/subjects/russian/index.js'
import { mathPromptConfig, getMathGradeTier } from './config/subjects/math/index.js'
import { algebraPromptConfig, getAlgebraGradeTier } from './config/subjects/algebra/index.js'
import { geometryPromptConfig, getGeometryGradeTier } from './config/subjects/geometry/index.js'

// Per-subject difficulty prompts (new config-driven path)
import { getRussianDifficultyPrompt } from './config/subjects/russian/difficulty.js'
import { getMathDifficultyPrompt } from './config/subjects/math/difficulty.js'
import { getAlgebraDifficultyPrompt } from './config/subjects/algebra/difficulty.js'
import { getGeometryDifficultyPrompt } from './config/subjects/geometry/difficulty.js'

// =============================================================================
// Per-subject config registry
// =============================================================================

const SUBJECT_PROMPT_CONFIGS: Record<string, SubjectPromptConfig> = {
  russian: russianPromptConfig,
  math: mathPromptConfig,
  algebra: algebraPromptConfig,
  geometry: geometryPromptConfig,
}

function getSubjectPromptConfig(subject: string): SubjectPromptConfig | null {
  return SUBJECT_PROMPT_CONFIGS[subject] ?? null
}

const GRADE_TIER_GETTERS: Record<string, (grade: number) => GradeTierConfig | null> = {
  russian: getRussianGradeTier,
  math: getMathGradeTier,
  algebra: getAlgebraGradeTier,
  geometry: getGeometryGradeTier,
}

function getGradeTierForGrade(subject: string, grade: number): GradeTierConfig | null {
  const getter = GRADE_TIER_GETTERS[subject]
  return getter ? getter(grade) : null
}

const SUBJECT_DIFFICULTY_GETTERS: Record<string, (grade: number, level: DifficultyLevel) => string> = {
  russian: getRussianDifficultyPrompt,
  math: getMathDifficultyPrompt,
  algebra: getAlgebraDifficultyPrompt,
  geometry: getGeometryDifficultyPrompt,
}

function getSubjectDifficultyPrompt(subject: string, grade: number, level: DifficultyLevel): string | null {
  const getter = SUBJECT_DIFFICULTY_GETTERS[subject]
  return getter ? getter(grade, level) : null
}

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
// Block 2: Subject (now handled by per-subject configs in buildSystemPrompt)
// =============================================================================

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
// Block 5.5: Curriculum Context (prior and upcoming knowledge)
// =============================================================================

function buildCurriculumContext(subjectId: string, grade: number, level: DifficultyLevel): string {
  const config = getSubjectConfig(subjectId)
  if (!config) return ''

  const gradeRange = config.gradeRange
  const lines: string[] = []

  // For easy: only show current grade topics (for context within class)
  // For medium/hard: also show prior grades
  if (level !== 'easy') {
    for (let g = gradeRange.from; g < grade; g++) {
      const gradeConfig = config.grades[g]
      if (gradeConfig?.promptHint) {
        lines.push(`  ${g} класс: ${gradeConfig.promptHint}`)
      }
    }
  }

  // Current grade topics (to see what's before/after the user's topic)
  const currentGrade = config.grades[grade]
  if (currentGrade?.topics?.length) {
    lines.push(`  ${grade} класс (текущий, темы по порядку): ${currentGrade.topics.join('; ')}`)
  }

  // For hard: also show next grade topics (±1-2 topics ahead)
  if (level === 'hard') {
    const nextGrade = config.grades[grade + 1]
    if (nextGrade?.topics?.length) {
      const preview = nextGrade.topics.slice(0, 3).join('; ')
      lines.push(`  ${grade + 1} класс (что будет дальше): ${preview}`)
    }
  }

  if (lines.length === 0) return ''

  return `\nПрограмма по предмету "${config.name}" (для межтемной интеграции):\n${lines.join('\n')}`
}

// =============================================================================
// Block 5.6: Grade Cognitive Calibration
// =============================================================================

/**
 * Builds a cognitive depth calibration block that ensures tasks match
 * the intellectual level expected for the grade, regardless of difficulty setting.
 * Difficulty (easy/medium/hard) adjusts within this level but never below it.
 */
function getGradeCalibrationBlock(grade: number, level: DifficultyLevel, subject: string): string {
  // Build the curriculum awareness instruction
  const curriculumContext = buildCurriculumContext(subject, grade, level)

  // For grades 1-4, calibration is light — just prior knowledge
  if (grade <= 4) {
    let priorKnowledge = ''
    if (grade > 1) {
      priorKnowledge = `
ОПОРА НА ПРОЙДЕННЫЙ МАТЕРИАЛ:
Формулируй задания так, как они звучали бы в реальном учебнике для ${grade} класса.
Ученик уже владеет материалом предыдущих лет — используй это.${curriculumContext}`
    }
    return priorKnowledge ? priorKnowledge.trim() : ''
  }

  // For grades 5+, build anti-pattern rules based on cognitive tier
  let forbiddenPatterns: string
  let requiredPatterns: string
  let examContext = ''

  if (grade <= 6) {
    // 5-6: comparison and classification
    forbiddenPatterns = `ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ (уровень 1-4 класса — слишком просто для ${grade} класса):
❌ "Вычисли / Реши" без проверки или обоснования → ЗАМЕНИ на "Вычисли и проверь обратным действием" или "Реши и объясни способ"
❌ "Определи [одно понятие]" → ЗАМЕНИ на "Классифицируй несколько объектов и объясни принцип"
❌ "Запиши / Назови" → ЗАМЕНИ на "Сравни два варианта и объясни различие"
❌ Задания с одним действием без размышления → ЗАМЕНИ на задания со сравнением, выбором способа или объяснением`

    requiredPatterns = `ОБЯЗАТЕЛЬНЫЕ ЭЛЕМЕНТЫ В КАЖДОМ ЗАДАНИИ (минимум один):
✓ СРАВНЕНИЕ: "сравни", "чем отличается", "что общего"
✓ КЛАССИФИКАЦИЯ: "распредели по группам", "определи тип каждого и объясни"
✓ ОБОСНОВАНИЕ: "объясни почему", "докажи что", "как ты определил"
✓ ПРОВЕРКА: "проверь результат", "верно ли утверждение"`
  } else if (grade <= 8) {
    // 7-8: analysis and connections
    forbiddenPatterns = `ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ (уровень 5-6 класса — слишком просто для ${grade} класса):
❌ "Определи тип/вид [X]" по одному примеру → ЗАМЕНИ на "Определи тип, объясни по каким признакам, приведи контрпример"
❌ "Образуй / Запиши форму" → ЗАМЕНИ на "Образуй и объясни, какие свойства сохранились, какие изменились"
❌ "Найди [X]" без анализа → ЗАМЕНИ на "Найди, объясни метод, проверь результат"
❌ Соотнесение по одному слову/числу → ЗАМЕНИ на соотнесение с объяснением или с контекстом из 2-3 предложений`

    requiredPatterns = `ОБЯЗАТЕЛЬНЫЕ ЭЛЕМЕНТЫ В КАЖДОМ ЗАДАНИИ (минимум один):
✓ АНАЛИЗ: "объясни почему", "в чём причина", "как связаны"
✓ СВЯЗИ: "используя знания о [тема из прошлого]", "как это связано с"
✓ ВЕРИФИКАЦИЯ: "проверь", "найди ошибку", "верно ли утверждение и почему"
✓ СРАВНЕНИЕ МЕТОДОВ: "реши двумя способами", "какой способ эффективнее"`
  } else {
    // 9-11: synthesis, evaluation, argumentation
    forbiddenPatterns = `ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ (уровень 5-6 класса — КАТЕГОРИЧЕСКИ НЕ ДОПУСТИМЫ для ${grade} класса):
❌ "Определи тип/вид [X]" по одному предложению/примеру → ЗАМЕНИ на анализ текста из 3-5 предложений с обоснованием и указанием языковых/математических маркеров
❌ "Соотнеси [X] и [Y]" по одному слову/примеру → ЗАМЕНИ на соотнесение на основе текстовых фрагментов или многошаговых задач с объяснением
❌ "Как называется..." / "Что такое..." → ЗАМЕНИ на "Сравни два явления, объясни различия на конкретных примерах"
❌ "Какой [X] используется в..." → ЗАМЕНИ на "Проанализируй фрагмент: какие [X] используются, как взаимодействуют, какова роль каждого"
❌ Вставь пропущенное слово без контекста → ЗАМЕНИ на работу с текстом, где нужно вставить И обосновать выбор
❌ Любое задание с однословным ответом без аргументации → ЗАМЕНИ на задание, требующее объяснения или работы с контекстом

САМОПРОВЕРКА — ВЫПОЛНИ ДЛЯ КАЖДОГО ЗАДАНИЯ:
Прочитай задание и спроси себя: "Мог бы ученик 6 класса решить это задание?"
Если ДА — задание слишком простое для ${grade} класса. Переделай его, добавив:
- работу с развёрнутым контекстом (текст, задача в несколько шагов)
- требование обосновать/аргументировать ответ
- связь с другими темами или разделами предмета`

    requiredPatterns = `ОБЯЗАТЕЛЬНЫЕ ЭЛЕМЕНТЫ В КАЖДОМ ЗАДАНИИ (минимум один):
✓ КОНТЕКСТ: задание работает с текстом/фрагментом/ситуацией, а НЕ с изолированным примером
✓ АРГУМЕНТАЦИЯ: "обоснуй", "докажи", "объясни выбор", "приведи аргументы"
✓ СИНТЕЗ: комбинирование текущей темы с ранее изученным (пунктуация + орфография, функции + уравнения, и т.д.)
✓ ОЦЕНКА: "верно ли", "найди ошибку в рассуждении", "оцени правильность"`

    // Exam calibration
    if (grade === 9) {
      examContext = `
ПРИВЯЗКА К ЭКЗАМЕНУ — ОГЭ:
Задания должны соответствовать уровню ОГЭ, а НЕ уровню контрольной работы за 6 класс.`
    } else {
      examContext = `
ПРИВЯЗКА К ЭКЗАМЕНУ — ЕГЭ:
Задания должны соответствовать уровню ЕГЭ, а НЕ уровню школьного теста за средние классы.`
    }
  }

  // Subject-specific content requirements — HOW tasks should be structured
  const promptConfig = getSubjectPromptConfig(subject)
  const subjectContentReqs = promptConfig
    ? promptConfig.contentRequirements(grade, level)
    : ''

  // Prior knowledge instruction
  let priorKnowledgeInstruction = ''
  if (level === 'easy') {
    priorKnowledgeInstruction = `
ОПОРА НА ПРОЙДЕННЫЙ МАТЕРИАЛ:
Формулируй задания как в реальном учебнике для ${grade} класса — ученик владеет всем материалом прошлых лет.${curriculumContext}`
  } else {
    priorKnowledgeInstruction = `
ОПОРА НА ПРОЙДЕННЫЙ МАТЕРИАЛ:
Задания ОБЯЗАНЫ комбинировать текущую тему с ранее изученным.
Именно это отличает ${grade} класс от более младших.${curriculumContext}`
  }

  return `
═══════════════════════════════════════════════════════════════
⛔ КАЛИБРОВКА КОГНИТИВНОГО УРОВНЯ ДЛЯ ${grade} КЛАССА ⛔
═══════════════════════════════════════════════════════════════

${forbiddenPatterns}

${requiredPatterns}
${subjectContentReqs}
${examContext}${priorKnowledgeInstruction}
`.trim()
}

// Subject-specific content requirements — now in per-subject configs (contentRequirements)

// =============================================================================
// Block 6: Difficulty (усиленный, идёт сразу после темы)
// =============================================================================

function getDifficultyBlock(level: DifficultyLevel, subject: string, grade: number): string {
  const difficultyContent = getSubjectDifficultyPrompt(subject, grade, level) ?? getDifficultyPrompt(level, subject, grade)

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
✓ Однозначные формулировки

НАРАСТАНИЕ СЛОЖНОСТИ (даже на базовом уровне):
Задания должны идти от совсем простых к чуть более сложным:
- Первые задания: самое простое, прямое применение одного правила/формулы
- Средние задания: чуть сложнее, может потребоваться 2 шага или подстановка
- Последние задания: самые сложные из базовых, но всё ещё в рамках одной темы
Все задания остаются в рамках базового уровня, но НЕ одинаковой сложности!`
  } else if (level === 'medium') {
    enforcementRules = `
СТРОГИЕ ОГРАНИЧЕНИЯ (СРЕДНИЙ уровень):
✗ ЗАПРЕЩЕНЫ слишком простые задания в 1 шаг
✗ ЗАПРЕЩЕНЫ олимпиадные и нестандартные задачи
✓ Стандартные ситуации из учебника
✓ Решение в 2-3 шага
✓ Требуется понимание темы, но без подвохов

МЕЖТЕМНАЯ ИНТЕГРАЦИЯ (СРЕДНИЙ уровень):
Задания ОБЯЗАНЫ включать ранее изученный материал:
- ~40% заданий: чисто по текущей теме (но не тривиальные, 2+ шага)
- ~40% заданий: комбинируют текущую тему с РАНЕЕ пройденными темами этого или предыдущих классов
  (например, для алгебры 8 класса "Квадратные уравнения" — задачи, где нужно сначала упростить выражение с одночленами из 7 класса, а потом решить уравнение)
- ~20% заданий: усложнённые, требуют нескольких навыков одновременно

НАРАСТАНИЕ СЛОЖНОСТИ:
Задания должны идти от менее сложных к более сложным:
- Первые: по текущей теме, 2 шага
- Средние: интеграция с ранее изученным, 2-3 шага
- Последние: самые сложные, комбинируют несколько тем и навыков`
  } else {
    enforcementRules = `
СТРОГИЕ ОГРАНИЧЕНИЯ (ПОВЫШЕННЫЙ уровень):
✗ ЗАПРЕЩЕНЫ простые задачи в 1-2 действия
✗ ЗАПРЕЩЕНЫ задания с очевидным ответом
✗ ЗАПРЕЩЕНЫ задания только по одной теме без синтеза — это НЕ повышенный уровень!
✓ Нестандартные формулировки и контексты
✓ Решение в 3-5 шагов
✓ Комбинирование нескольких тем или правил
✓ Задания олимпиадного типа

СИНТЕЗ ТЕМ — КЛЮЧЕВОЕ ТРЕБОВАНИЕ (ПОВЫШЕННЫЙ уровень):
Каждое задание ОБЯЗАНО комбинировать знания из НЕСКОЛЬКИХ тем:
- Текущая тема + ранее пройденные темы этого класса
- Текущая тема + материал предыдущих классов
- В самых сложных заданиях: элементы тем, которые идут ПОСЛЕ текущей (на 1-2 темы вперёд по программе), если ученик способен догадаться

Примеры синтеза:
• Алгебра 8кл "Квадратные уравнения" → задача, где нужно разложить многочлен (7кл), привести к квадратному уравнению, решить через дискриминант, и проверить через подстановку
• Геометрия 8кл "Площади" → задача на площадь фигуры, составленной из нескольких четырёхугольников, с использованием теоремы Пифагора и подобия
• Русский 7кл "Причастный оборот" → предложение со сложной пунктуацией, где нужно учесть и причастный оборот, и однородные члены, и вводные слова

НАРАСТАНИЕ СЛОЖНОСТИ:
Каждое следующее задание ДОЛЖНО быть сложнее предыдущего:
- Первые ~25% заданий: повышенный уровень по текущей теме + 1 тема из прошлого
- Средние ~50% заданий: синтез текущей темы с 2-3 ранее пройденными, многошаговые
- Последние ~25% заданий: самые сложные, олимпиадного типа, комбинируют максимум тем, могут включать элементы из будущих тем программы`
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

function getDiversityBlock(subject: string): string {
  const promptConfig = getSubjectPromptConfig(subject)
  const subjectHints = promptConfig ? promptConfig.diversityHints : ''

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
• Слишком длинные формулировки БЕЗ содержательного текста (вопрос без текстового фрагмента не должен быть длиннее 2-3 предложений, но задание С текстовым фрагментом может быть длиннее)
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
  // For combined prompt, use the new system prompt (includes cognitive contract)
  const systemBlock = buildSystemPrompt(params.subject, params.grade, params.difficulty)
  const blocks = [
    systemBlock,
    getGradeBlock(params.subject, params.grade),
    getTopicBlock(params.topic),
    getGradeCalibrationBlock(params.grade, params.difficulty, params.subject), // Калибровка по классу!
    getDifficultyBlock(params.difficulty, params.subject, params.grade), // Сложность сразу после калибровки!
    getTaskTypesBlock(params.taskTypes, params.format, params.variantIndex),
    getDiversityBlock(params.subject), // Разнообразие после типов
    getFormatBlock(),
    ANTI_PATTERNS_PROMPT,
  ]

  return blocks.filter(Boolean).join('\n\n---\n\n')
}

/**
 * Получить только системный промпт (роль + предмет + когнитивный контракт)
 *
 * Новый путь: config-driven — systemPrompt из конфига, cognitiveContract и exampleTask из grade tier.
 * Старый путь: fallback на getSubjectBlock() если конфиг не найден.
 */
export function buildSystemPrompt(subjectId: string, grade?: number, difficulty?: DifficultyLevel): string {
  const promptConfig = getSubjectPromptConfig(subjectId)
  const tier = grade != null ? getGradeTierForGrade(subjectId, grade) : null

  if (promptConfig && tier) {
    // NEW config-driven path
    const parts = [
      BASE_ROLE_PROMPT,
      promptConfig.systemPrompt,
    ]

    if (tier.cognitiveContract) {
      parts.push(`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
\u26D4 \u041A\u041E\u0413\u041D\u0418\u0422\u0418\u0412\u041D\u042B\u0419 \u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422 \u0414\u041B\u042F ${grade} \u041A\u041B\u0410\u0421\u0421\u0410 \u26D4
\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n\n${tier.cognitiveContract}`)
    }

    if (tier.exampleTask) {
      parts.push(`\u041F\u0420\u0418\u041C\u0415\u0420 \u0425\u041E\u0420\u041E\u0428\u0415\u0413\u041E \u0417\u0410\u0414\u0410\u041D\u0418\u042F:\n${tier.exampleTask}`)
    }

    if (tier.examContext) {
      parts.push(tier.examContext)
    }

    return parts.filter(Boolean).join('\n\n')
  }

  // FALLBACK: base role prompt only (no per-subject config found)
  return BASE_ROLE_PROMPT
}

/**
 * Получить user prompt (остальные блоки)
 *
 * Порядок блоков оптимизирован:
 * 1. Класс + тема
 * 2. КАЛИБРОВКА ПО КЛАССУ (когнитивная глубина!)
 * 3. СЛОЖНОСТЬ (внутри когнитивного уровня!)
 * 4. Типы заданий
 * 5. РАЗНООБРАЗИЕ
 * 6. Формат + антипаттерны
 */
export function buildUserPrompt(
  params: Omit<PromptParams, 'subject'> & { subject: string }
): string {
  const blocks = [
    getGradeBlock(params.subject, params.grade),
    getTopicBlock(params.topic),
    getGradeCalibrationBlock(params.grade, params.difficulty, params.subject), // Калибровка по классу!
    getDifficultyBlock(params.difficulty, params.subject, params.grade), // Сложность после калибровки!
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

import OpenAI from 'openai'
import { getAgentsModel } from '../../../ai-models.js'
import { trackFromContext } from '../../../ai-usage.js'
import { safeJsonParse } from './safe-json-parse.js'
import type { TaskTypeId } from '../../config/task-types.js'
import type { DifficultyLevel } from '../../config/difficulty.js'
import type { AgentResult, AgentTaskResult, AgentIssue } from './index.js'

interface GeneratedTask {
  type: TaskTypeId
  question?: string
  options?: string[]
  correctIndex?: number
  correctIndices?: number[]
  explanation?: string
  correctAnswer?: string
  acceptableVariants?: string[]
  instruction?: string
  leftColumn?: string[]
  rightColumn?: string[]
  correctPairs?: [number, number][]
  textWithBlanks?: string
  blanks?: { position: number; correctAnswer: string; acceptableVariants?: string[] }[]
}

const DIFFICULTY_NAMES: Record<DifficultyLevel, string> = {
  easy: 'лёгкий',
  medium: 'средний',
  hard: 'повышенный',
}

const SUBJECT_PROMPTS: Record<string, string> = {
  russian: `Ты — методист по русскому языку. Проверь качество каждого задания.
ПРОВЕРЬ КАЖДОЕ ЗАДАНИЕ:

КОРРЕКТНОСТЬ ФОРМУЛИРОВКИ:
- Если в вопросе есть пример — убедись что он соответствует тому, о чём спрашивается
- Классификация частей речи, членов предложения, типов предложений должна быть верной
- Термины должны использоваться правильно

ВАРИАНТЫ ОТВЕТОВ (для тестов):
- Среди вариантов ДОЛЖЕН быть хотя бы один правильный
- Если ни один вариант не подходит — это ошибка

СЛОЖНОСТЬ:
- easy: простые примеры, прямое применение правил
- medium: стандартные случаи из учебника
- hard: сложные случаи, исключения`,

  math: `Ты — методист по математике начальной и средней школы. Проверь качество каждого задания.
ПРОВЕРЬ КАЖДОЕ ЗАДАНИЕ:

КОРРЕКТНОСТЬ ФОРМУЛИРОВКИ:
- Условие задачи полное и однозначное
- Данные не противоречат друг другу
- Задача имеет решение

ВАРИАНТЫ ОТВЕТОВ (для тестов):
- Среди вариантов ДОЛЖЕН быть правильный
- Неправильные варианты — правдоподобные (типичные ошибки учеников)

СЛОЖНОСТЬ:
- easy: 1-2 действия, круглые числа
- medium: 2-3 действия, обычные числа
- hard: 3+ действий, составные задачи`,

  algebra: `Ты — методист по алгебре. Проверь качество каждого задания.
ПРОВЕРЬ КАЖДОЕ ЗАДАНИЕ:

КОРРЕКТНОСТЬ ФОРМУЛИРОВКИ:
- Условие полное и однозначное
- Уравнения/неравенства записаны корректно
- Задача имеет решение в рамках изученного материала

ВАРИАНТЫ ОТВЕТОВ (для тестов):
- Среди вариантов ДОЛЖЕН быть правильный
- Неправильные варианты — правдоподобные

СЛОЖНОСТЬ:
- easy: 1-2 шага, стандартные преобразования
- medium: 2-3 шага, типовые методы
- hard: 3+ шагов, комбинирование методов`,

  geometry: `Ты — методист по геометрии. Проверь качество каждого задания.
ПРОВЕРЬ КАЖДОЕ ЗАДАНИЕ:

КОРРЕКТНОСТЬ ФОРМУЛИРОВКИ:
- Условие полное, фигура определена однозначно
- Данные не противоречат друг другу
- Задача имеет решение

ВАРИАНТЫ ОТВЕТОВ (для тестов):
- Среди вариантов ДОЛЖЕН быть правильный
- Неправильные варианты — правдоподобные

СЛОЖНОСТЬ:
- easy: прямое применение одной теоремы/формулы
- medium: 2-3 шага, стандартные задачи
- hard: комбинирование теорем, нестандартные построения`,
}

function formatTaskForPrompt(task: GeneratedTask, index: number): string {
  const parts = [`--- Задание ${index} (тип: ${task.type}) ---`]

  switch (task.type) {
    case 'single_choice':
    case 'multiple_choice':
      parts.push(`Вопрос: ${task.question}`)
      parts.push(`Варианты: ${(task.options || []).join('; ')}`)
      break
    case 'open_question':
      parts.push(`Вопрос: ${task.question}`)
      break
    case 'matching':
      parts.push(`Инструкция: ${task.instruction}`)
      parts.push(`Левый столбец: ${(task.leftColumn || []).join('; ')}`)
      parts.push(`Правый столбец: ${(task.rightColumn || []).join('; ')}`)
      break
    case 'fill_blank':
      parts.push(`Текст: ${task.textWithBlanks}`)
      break
  }

  return parts.join('\n')
}

interface LLMQualityResult {
  index: number
  status: 'ok' | 'warning' | 'error'
  issue?: string
}

export async function checkQuality(
  tasks: GeneratedTask[],
  subject: string,
  grade: number,
  difficulty: DifficultyLevel
): Promise<AgentResult> {
  const agentName = 'quality-checker'
  const start = Date.now()

  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL
  const model = getAgentsModel()
  console.log(`[${agentName}] Agent model: ${model}`)

  if (!apiKey) {
    console.warn(`[${agentName}] No API key, skipping`)
    return emptyResult(agentName)
  }

  const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) })
  const subjectPrompt = SUBJECT_PROMPTS[subject] || SUBJECT_PROMPTS.math
  const difficultyName = DIFFICULTY_NAMES[difficulty] || difficulty

  const tasksText = tasks.map((t, i) => formatTaskForPrompt(t, i)).join('\n\n')

  const userPrompt = `${subjectPrompt}

Класс: ${grade}
Уровень сложности: ${difficultyName} (${difficulty})

Вот задания для проверки:

${tasksText}

Верни ТОЛЬКО JSON (без markdown):
{
  "tasks": [
    {"index": 0, "status": "ok"},
    {"index": 1, "status": "error", "issue": "Описание проблемы с формулировкой"},
    {"index": 5, "status": "warning", "issue": "Задание не соответствует выбранному уровню сложности"}
  ]
}

Проверь ВСЕ ${tasks.length} заданий. Индексы от 0 до ${tasks.length - 1}.
- "error" — формулировка некорректна, нет правильного варианта, или задание нерешаемо
- "warning" — сложность не соответствует уровню ${difficultyName}
- "ok" — задание в порядке`

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 4000,
      temperature: 0.1,
    })

    if (completion.usage) {
      trackFromContext({
        callType: 'quality_checker',
        model: completion.model || model,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        durationMs: Date.now() - start,
      })
    }

    const content = completion.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.warn(`[${agentName}] No JSON in response`)
      return emptyResult(agentName, 'NO_JSON_RESPONSE')
    }

    const parsed = safeJsonParse<{ tasks: LLMQualityResult[] }>(jsonMatch[0], agentName)
    if (!parsed) {
      return emptyResult(agentName, 'JSON_PARSE_ERROR')
    }
    const llmTasks = parsed.tasks || []

    const taskResults: AgentTaskResult[] = llmTasks.map((t) => {
      const issues: AgentIssue[] = []
      if ((t.status === 'error' || t.status === 'warning') && t.issue) {
        issues.push({
          code: t.status === 'error' ? 'BAD_FORMULATION' : 'DIFFICULTY_MISMATCH',
          message: t.issue,
          suggestion: t.status === 'error'
            ? 'Переформулировать задание или исправить варианты ответов'
            : 'Скорректировать сложность задания',
        })
      }
      return {
        taskIndex: t.index,
        status: t.status,
        issues,
      }
    })

    const totalErrors = taskResults.filter(t => t.status === 'error').length
    const totalWarnings = taskResults.filter(t => t.status === 'warning').length
    const duration = Date.now() - start
    console.log(`[${agentName}] Done in ${duration}ms: ${totalErrors} errors, ${totalWarnings} warnings`)

    return { agentName, tasks: taskResults, totalErrors, totalWarnings }
  } catch (error) {
    const duration = Date.now() - start
    console.error(`[${agentName}] Failed in ${duration}ms:`, error)
    return emptyResult(agentName, 'AGENT_ERROR')
  }
}

function emptyResult(agentName: string, warningCode?: string): AgentResult {
  const issues: AgentIssue[] = warningCode
    ? [{ code: warningCode, message: 'Agent could not complete quality check' }]
    : []

  return {
    agentName,
    tasks: issues.length > 0
      ? [{ taskIndex: -1, status: 'warning' as const, issues }]
      : [],
    totalErrors: 0,
    totalWarnings: issues.length,
  }
}

import OpenAI from 'openai'
import { getFixerModelConfig } from '../../../ai-models.js'
import { trackFromContext } from '../../../ai-usage.js'
import { safeJsonParse } from './safe-json-parse.js'
import type { TaskTypeId } from '../../config/task-types.js'
import type { DifficultyLevel } from '../../config/difficulty.js'
import { difficultyLevels } from '../../config/difficulty.js'
import type { AgentIssue } from './index.js'

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

export interface FixResult {
  success: boolean
  originalTask: GeneratedTask
  fixedTask?: GeneratedTask
  fixDescription?: string
  error?: string
}

const SUBJECT_NAMES: Record<string, string> = {
  math: 'Математика',
  algebra: 'Алгебра',
  geometry: 'Геометрия',
  russian: 'Русский язык',
}

const MAX_FIXES_PER_GENERATION = 10

export async function fixTask(
  task: GeneratedTask,
  issue: AgentIssue,
  context: { subject: string; grade: number; topic: string; difficulty?: DifficultyLevel }
): Promise<FixResult> {
  const start = Date.now()
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL
  const { model, reasoning } = getFixerModelConfig(context.subject, context.grade)
  console.log(`[task-fixer] Model: ${model}, reasoning:`, JSON.stringify(reasoning))

  if (!apiKey) {
    return { success: false, originalTask: task, error: 'No API key' }
  }

  const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) })
  const subjectName = SUBJECT_NAMES[context.subject] || context.subject

  const suggestionLine = issue.suggestion
    ? `\nРЕКОМЕНДАЦИЯ: ${issue.suggestion}`
    : ''

  const isDifficultyMismatch = issue.code === 'DIFFICULTY_MISMATCH'
  const difficultyName = context.difficulty
    ? difficultyLevels[context.difficulty]?.nameRu || context.difficulty
    : ''

  const userPrompt = isDifficultyMismatch && context.difficulty
    ? `Ты — редактор учебных материалов. Пересоздай задание целиком под нужный уровень сложности.
Предмет: ${subjectName}
Класс: ${context.grade}
Тема: "${context.topic}"
Требуемый уровень сложности: ${difficultyName}

ТЕКУЩЕЕ ЗАДАНИЕ (не соответствует уровню сложности):
${JSON.stringify(task, null, 2)}

ПРОБЛЕМА:
${issue.message}${suggestionLine}

ЗАДАЧА:
1. Создай НОВОЕ задание по той же теме, но строго уровня "${difficultyName}"
2. Убедись что ответ правильный
3. Сохрани тип и формат задания (type: "${task.type}")

Верни новое задание в том же JSON формате.
Только JSON, без пояснений.`
    : `Ты — редактор учебных материалов. Исправь ошибку в задании.
Предмет: ${subjectName}
Класс: ${context.grade}
Тема: "${context.topic}"

ЗАДАНИЕ С ОШИБКОЙ:
${JSON.stringify(task, null, 2)}

НАЙДЕННАЯ ОШИБКА:
${issue.message}${suggestionLine}

ЗАДАЧА:
1. Исправь ошибку
2. Убедись что ответ правильный
3. Сохрани тип и формат задания (type: "${task.type}")

Верни исправленное задание в том же JSON формате.
Только JSON, без пояснений.`

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 3000, // Gemini counts thinking tokens as output; need headroom
      temperature: 0.2,
      ...({ reasoning } as Record<string, unknown>),
    })

    if (completion.usage) {
      trackFromContext({
        callType: 'fixer',
        model: completion.model || model,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        durationMs: Date.now() - start,
      })
    }

    const content = completion.choices[0]?.message?.content || ''

    // Try markdown code block first, then raw JSON
    const mdMatch = content.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    const rawMatch = content.match(/\{[\s\S]*\}/)
    const jsonStr = mdMatch?.[1] || rawMatch?.[0]

    if (!jsonStr) {
      const duration = Date.now() - start
      console.warn(`[task-fixer] No JSON in response (${duration}ms), keeping original task`)
      return { success: false, originalTask: task, error: 'No JSON in LLM response' }
    }

    const fixedTask = safeJsonParse<GeneratedTask>(jsonStr, 'task-fixer')

    if (!fixedTask) {
      const duration = Date.now() - start
      console.warn(`[task-fixer] JSON parse failed (${duration}ms), keeping original task`)
      return { success: false, originalTask: task, error: `JSON parse failed after ${duration}ms` }
    }

    // Ensure type is preserved
    if (fixedTask.type !== task.type) {
      fixedTask.type = task.type
    }

    const duration = Date.now() - start
    const fixDescription = `${issue.code}: исправлено за ${duration}ms`
    console.log(`[task-fixer] Fixed in ${duration}ms (${issue.code})`)

    return { success: true, originalTask: task, fixedTask, fixDescription }
  } catch (error) {
    const duration = Date.now() - start
    const errMsg = error instanceof Error ? error.message : String(error)
    console.error(`[task-fixer] Failed in ${duration}ms:`, errMsg)
    return { success: false, originalTask: task, error: errMsg }
  }
}

export { MAX_FIXES_PER_GENERATION }

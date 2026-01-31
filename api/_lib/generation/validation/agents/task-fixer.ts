import OpenAI from 'openai'
import type { TaskTypeId } from '../../config/task-types.js'
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

const MAX_FIXES_PER_GENERATION = 5

export async function fixTask(
  task: GeneratedTask,
  issue: AgentIssue,
  context: { subject: string; grade: number; topic: string }
): Promise<FixResult> {
  const start = Date.now()
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL
  const model = process.env.AI_MODEL_GENERATION || 'gpt-4.1-mini'

  if (!apiKey) {
    return { success: false, originalTask: task, error: 'No API key' }
  }

  const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) })
  const subjectName = SUBJECT_NAMES[context.subject] || context.subject

  const suggestionLine = issue.suggestion
    ? `\nРЕКОМЕНДАЦИЯ: ${issue.suggestion}`
    : ''

  const userPrompt = `Ты — редактор учебных материалов. Исправь ошибку в задании.
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
      max_tokens: 2000,
      temperature: 0.2,
    })

    const content = completion.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      const duration = Date.now() - start
      console.warn(`[task-fixer] No JSON in response (${duration}ms)`)
      return { success: false, originalTask: task, error: 'No JSON in LLM response' }
    }

    const fixedTask = JSON.parse(jsonMatch[0]) as GeneratedTask

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

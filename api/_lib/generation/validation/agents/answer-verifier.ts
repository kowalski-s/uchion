import OpenAI from 'openai'
import { getVerifierModelConfig } from '../../../ai-models.js'
import type { TaskTypeId } from '../../config/task-types.js'
import type { AgentResult, AgentTaskResult, AgentIssue } from './index.js'

// Same shape as in ai-provider.ts / deterministic.ts
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

const SUBJECT_PROMPTS: Record<string, string> = {
  math: `Ты -- проверяющий учитель математики начальной и средней школы (1-6 класс).
Для каждого задания:
1. Реши его самостоятельно
2. Сравни свой ответ с указанным
3. Если не совпадают -- укажи ошибку и правильный ответ

Проверяй: арифметику, дроби, проценты, простые уравнения.`,

  algebra: `Ты -- проверяющий учитель алгебры (7-11 класс).
Для каждого задания:
1. Реши его самостоятельно
2. Сравни свой ответ с указанным
3. Если не совпадают -- укажи ошибку и правильный ответ

Проверяй: уравнения, функции, графики, производные, логарифмы, тригонометрию.`,

  geometry: `Ты -- проверяющий учитель геометрии (7-11 класс).
Для каждого задания:
1. Реши его самостоятельно
2. Сравни свой ответ с указанным
3. Если не совпадают -- укажи ошибку и правильный ответ

Проверяй: теоремы, формулы площадей и объёмов, векторы, координаты.`,

  russian: `Ты -- проверяющий учитель русского языка (1-11 класс).
Для каждого задания:
1. Проверь правильность ответа по правилам русского языка
2. Если ответ неверный -- укажи ошибку и правильный ответ

Проверяй: орфографию, пунктуацию, грамматику, части речи, синтаксис.`,
}

function formatTaskForPrompt(task: GeneratedTask, index: number): string {
  const parts = [`--- Задание ${index} (тип: ${task.type}) ---`]

  switch (task.type) {
    case 'single_choice':
      parts.push(`Вопрос: ${task.question}`)
      parts.push(`Варианты: ${(task.options || []).map((o, i) => `${i}) ${o}`).join('; ')}`)
      parts.push(`Указанный правильный ответ: вариант ${task.correctIndex} (${task.options?.[task.correctIndex ?? 0]})`)
      break
    case 'multiple_choice':
      parts.push(`Вопрос: ${task.question}`)
      parts.push(`Варианты: ${(task.options || []).map((o, i) => `${i}) ${o}`).join('; ')}`)
      parts.push(`Указанные правильные: ${(task.correctIndices || []).map(i => `${i}) ${task.options?.[i]}`).join('; ')}`)
      break
    case 'open_question':
      parts.push(`Вопрос: ${task.question}`)
      parts.push(`Указанный ответ: ${task.correctAnswer}`)
      break
    case 'matching':
      parts.push(`Инструкция: ${task.instruction}`)
      parts.push(`Левый столбец: ${(task.leftColumn || []).map((v, i) => `${i}) ${v}`).join('; ')}`)
      parts.push(`Правый столбец: ${(task.rightColumn || []).map((v, i) => `${i}) ${v}`).join('; ')}`)
      parts.push(`Указанные пары: ${(task.correctPairs || []).map(([l, r]) => `${l}-${r}`).join(', ')}`)
      break
    case 'fill_blank':
      parts.push(`Текст: ${task.textWithBlanks}`)
      parts.push(`Пропуски: ${(task.blanks || []).map(b => `(${b.position}) ${b.correctAnswer}`).join('; ')}`)
      break
  }

  return parts.join('\n')
}

interface LLMTaskResult {
  index: number
  status: 'ok' | 'error'
  issue?: string
}

export async function verifyAnswers(
  tasks: GeneratedTask[],
  subject: string
): Promise<AgentResult> {
  const agentName = 'answer-verifier'
  const start = Date.now()

  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL
  const { model, reasoning } = getVerifierModelConfig(subject)
  console.log(`[${agentName}] Verifier model: ${model}, reasoning:`, JSON.stringify(reasoning))

  if (!apiKey) {
    console.warn(`[${agentName}] No API key, skipping`)
    return emptyResult(agentName)
  }

  const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) })
  const subjectPrompt = SUBJECT_PROMPTS[subject] || SUBJECT_PROMPTS.math

  const tasksText = tasks.map((t, i) => formatTaskForPrompt(t, i)).join('\n\n')

  const userPrompt = `${subjectPrompt}

Вот задания для проверки:

${tasksText}

Верни ТОЛЬКО JSON (без markdown):
{
  "tasks": [
    {"index": 0, "status": "ok"},
    {"index": 1, "status": "error", "issue": "Неверный ответ. Указано: ... Правильно: ..."}
  ]
}

Проверь ВСЕ ${tasks.length} заданий. Индексы от 0 до ${tasks.length - 1}.`

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 4000,
      temperature: 0.1,
      ...({ reasoning } as Record<string, unknown>),
    })

    const content = completion.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.warn(`[${agentName}] No JSON in response`)
      return emptyResult(agentName, 'NO_JSON_RESPONSE')
    }

    const parsed = JSON.parse(jsonMatch[0]) as { tasks: LLMTaskResult[] }
    const llmTasks = parsed.tasks || []

    const taskResults: AgentTaskResult[] = llmTasks.map((t) => {
      const issues: AgentIssue[] = []
      if (t.status === 'error' && t.issue) {
        issues.push({
          code: 'WRONG_ANSWER',
          message: t.issue,
          suggestion: 'Пересгенерировать задание или исправить ответ',
        })
      }
      return {
        taskIndex: t.index,
        status: t.status === 'error' ? 'error' as const : 'ok' as const,
        issues,
      }
    })

    const totalErrors = taskResults.filter(t => t.status === 'error').length
    const duration = Date.now() - start
    console.log(`[${agentName}] Done in ${duration}ms: ${totalErrors} errors found`)

    return { agentName, tasks: taskResults, totalErrors, totalWarnings: 0 }
  } catch (error) {
    const duration = Date.now() - start
    console.error(`[${agentName}] Failed in ${duration}ms:`, error)
    return emptyResult(agentName, 'AGENT_ERROR')
  }
}

function emptyResult(agentName: string, warningCode?: string): AgentResult {
  const issues: AgentIssue[] = warningCode
    ? [{ code: warningCode, message: 'Agent could not complete verification' }]
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

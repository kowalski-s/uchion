import OpenAI from 'openai'
import { getAgentsModel } from '../../../ai-models.js'
import { safeJsonParse } from './safe-json-parse.js'
import { getGradeConfig } from '../../config/index.js'
import type { TaskTypeId } from '../../config/task-types.js'
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

const SUBJECT_NAMES: Record<string, string> = {
  math: 'Математика',
  algebra: 'Алгебра',
  geometry: 'Геометрия',
  russian: 'Русский язык',
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

interface LLMContentResult {
  index: number
  status: 'ok' | 'warning' | 'error'
  issue?: string
}

export async function checkContent(
  tasks: GeneratedTask[],
  subject: string,
  grade: number,
  topic: string
): Promise<AgentResult> {
  const agentName = 'content-checker'
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

  // Get topics from grade config
  const gradeConfig = getGradeConfig(subject, grade as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11)
  const gradeTopics = gradeConfig?.topics?.join(', ') || 'не найдены'
  const subjectName = SUBJECT_NAMES[subject] || subject

  const tasksText = tasks.map((t, i) => formatTaskForPrompt(t, i)).join('\n\n')

  const userPrompt = `Ты -- методист. Проверь каждое задание:
Предмет: ${subjectName}
Класс: ${grade}
Тема: "${topic}"

Темы программы ${grade} класса по предмету "${subjectName}":
${gradeTopics}

Вот задания для проверки:

${tasksText}

Для каждого задания проверь:
1. Соответствует ли теме "${topic}"
2. Не выходит ли за рамки программы ${grade} класса
3. Не используются ли термины, которые ученик ещё не знает

Верни ТОЛЬКО JSON (без markdown):
{
  "tasks": [
    {"index": 0, "status": "ok"},
    {"index": 2, "status": "warning", "issue": "Описание проблемы..."},
    {"index": 3, "status": "error", "issue": "Задание не соответствует теме..."}
  ]
}

Проверь ВСЕ ${tasks.length} заданий. Индексы от 0 до ${tasks.length - 1}.
- "error" -- задание полностью не соответствует теме или классу
- "warning" -- задание частично выходит за рамки или использует сложные термины
- "ok" -- задание в порядке`

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: userPrompt }],
      max_tokens: 4000,
      temperature: 0.1,
    })

    const content = completion.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.warn(`[${agentName}] No JSON in response`)
      return emptyResult(agentName, 'NO_JSON_RESPONSE')
    }

    const parsed = safeJsonParse<{ tasks: LLMContentResult[] }>(jsonMatch[0], agentName)
    if (!parsed) {
      return emptyResult(agentName, 'JSON_PARSE_ERROR')
    }
    const llmTasks = parsed.tasks || []

    const taskResults: AgentTaskResult[] = llmTasks.map((t) => {
      const issues: AgentIssue[] = []
      if ((t.status === 'error' || t.status === 'warning') && t.issue) {
        issues.push({
          code: t.status === 'error' ? 'OFF_TOPIC' : 'PARTIAL_MISMATCH',
          message: t.issue,
          suggestion: t.status === 'error'
            ? 'Пересгенерировать задание по указанной теме'
            : 'Проверить соответствие уровню класса',
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
    ? [{ code: warningCode, message: 'Agent could not complete content check' }]
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

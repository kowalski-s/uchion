import type { Worksheet, Subject, TestQuestion, Assignment, WorksheetAnswers } from '../../shared/types'
import OpenAI from 'openai'
import {
  buildSystemPrompt,
  buildUserPrompt,
  getTaskCounts,
  getRecommendedTaskTypes,
  type PromptParams
} from './generation/prompts.js'
import {
  type TaskTypeId,
  type DifficultyLevel,
  type WorksheetFormatId,
  getTaskType,
  getDifficultyPrompt,
  validateTask
} from './generation/config/index.js'
import { timedLLMCall } from './ai/validator.js'
import { checkValidationScore } from './alerts/generation-alerts.js'
import { validateWorksheet as validateTasksDeterministic } from './generation/validation/deterministic.js'
import { runMultiAgentValidation } from './generation/validation/agents/index.js'

import { getGenerationModel, getAgentsModel } from './ai-models.js'

// Re-export for convenience
export { getGenerationModel, getAgentsModel }

// =============================================================================
// Types
// =============================================================================

export type GenerateParams = {
  subject: Subject
  grade: number
  topic: string
  // Extended generation params
  taskTypes?: TaskTypeId[]
  difficulty?: DifficultyLevel
  format?: WorksheetFormatId
  variantIndex?: number
  isPaid?: boolean
}

export type RegenerateTaskParams = {
  subject: Subject
  grade: number
  topic: string
  difficulty: DifficultyLevel
  taskType: TaskTypeId
  isTest: boolean
  isPaid?: boolean
}

export type RegenerateTaskResult = {
  testQuestion?: TestQuestion
  assignment?: Assignment
  answer: string
}

export interface AIProvider {
  generateWorksheet(params: GenerateParams, onProgress?: (percent: number) => void): Promise<Worksheet>
  regenerateTask(params: RegenerateTaskParams): Promise<RegenerateTaskResult>
}

// New unified task structure from AI
interface GeneratedTask {
  type: TaskTypeId
  // single_choice / multiple_choice
  question?: string
  options?: string[]
  correctIndex?: number
  correctIndices?: number[]
  explanation?: string
  // open_question
  correctAnswer?: string
  acceptableVariants?: string[]
  // matching
  instruction?: string
  leftColumn?: string[]
  rightColumn?: string[]
  correctPairs?: [number, number][]
  // fill_blank
  textWithBlanks?: string
  blanks?: { position: number; correctAnswer: string; acceptableVariants?: string[] }[]
}

interface GeneratedWorksheetJson {
  tasks: GeneratedTask[]
}

// =============================================================================
// DummyProvider - для разработки без API
// =============================================================================

class DummyProvider implements AIProvider {
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] DummyProvider.generateWorksheet called', params)

    // Получаем количество заданий из формата
    const format = params.format || 'test_and_open'
    const variantIndex = params.variantIndex ?? 0
    const { openTasks, testQuestions } = getTaskCounts(format, variantIndex)

    // Генерируем dummy задания
    const assignments: Assignment[] = []
    for (let i = 0; i < openTasks; i++) {
      assignments.push({
        title: `Задание ${i + 1}`,
        text: `Демо-задание ${i + 1} по теме "${params.topic}"`
      })
    }

    const test: TestQuestion[] = []
    for (let i = 0; i < testQuestions; i++) {
      test.push({
        question: `Демо-вопрос ${i + 1} по теме "${params.topic}"?`,
        options: ['Вариант А', 'Вариант Б', 'Вариант В', 'Вариант Г'],
        answer: 'Вариант А'
      })
    }

    const answers: WorksheetAnswers = {
      assignments: assignments.map((_, i) => `Ответ ${i + 1}`),
      test: test.map(() => 'Вариант А')
    }

    return {
      id: 'dummy-id',
      subject: params.subject,
      grade: `${params.grade} класс`,
      topic: params.topic,
      assignments,
      test,
      answers,
      pdfBase64: ''
    }
  }

  async regenerateTask(params: RegenerateTaskParams): Promise<RegenerateTaskResult> {
    console.log('[УчиОн] DummyProvider.regenerateTask called', params)

    if (params.isTest) {
      return {
        testQuestion: {
          question: `Перегенерированный вопрос по теме "${params.topic}"?`,
          options: ['Вариант А', 'Вариант Б', 'Вариант В', 'Вариант Г'],
          answer: 'Вариант А'
        },
        answer: 'Вариант А'
      }
    }

    return {
      assignment: {
        title: 'Задание',
        text: `Перегенерированное задание по теме "${params.topic}"`
      },
      answer: 'Ответ на перегенерированное задание'
    }
  }
}

// =============================================================================
// OpenAIProvider - реальная генерация через AI
// =============================================================================

class OpenAIProvider implements AIProvider {
  private client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseURL && { baseURL })
    })
    console.log('[УчиОн] OpenAIProvider initialized', { baseURL: baseURL || 'default (api.openai.com)' })
  }

  async generateWorksheet(params: GenerateParams, onProgress?: (percent: number) => void): Promise<Worksheet> {
    console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params)
    const totalStart = Date.now()
    onProgress?.(5)

    // Получаем параметры генерации
    const format: WorksheetFormatId = params.format || 'test_and_open'
    const variantIndex = params.variantIndex ?? 0
    const difficulty: DifficultyLevel = params.difficulty || 'medium'
    const taskTypes: TaskTypeId[] = params.taskTypes?.length
      ? params.taskTypes
      : getRecommendedTaskTypes(format)

    const { openTasks, testQuestions } = getTaskCounts(format, variantIndex)
    const totalTasks = openTasks + testQuestions

    console.log('[УчиОн] Generation params:', { format, variantIndex, difficulty, taskTypes, openTasks, testQuestions })

    // Собираем промпты
    const promptParams: PromptParams = {
      subject: params.subject,
      grade: params.grade,
      topic: params.topic,
      taskTypes,
      difficulty,
      format,
      variantIndex
    }

    const systemPrompt = buildSystemPrompt(params.subject)
    const userPrompt = buildUserPrompt(promptParams)

    onProgress?.(15)

    // Генерируем задания
    const isPaid = params.isPaid ?? false
    const generationModel = getGenerationModel(isPaid)
    console.log(`[УчиОн] Generation model: ${generationModel} (isPaid: ${isPaid})`)

    let completion
    try {
      completion = await timedLLMCall(
        "new-generation",
        () => this.client.chat.completions.create({
          model: generationModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 8000,
          temperature: 0.5 // Ниже для более точного следования инструкциям
        })
      )
    } catch (error) {
      console.error('[УчиОн] OpenAI API Error:', error)
      throw new Error('AI_ERROR')
    }

    onProgress?.(60)

    // Парсим ответ
    const content = completion.choices[0]?.message?.content || ''
    console.log('[УчиОн] Raw AI response length:', content.length)

    let generatedJson: GeneratedWorksheetJson
    try {
      // Извлекаем JSON из ответа (может быть обёрнут в markdown)
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[УчиОн] No JSON found in response')
        throw new Error('AI_ERROR')
      }
      generatedJson = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('[УчиОн] JSON parse error:', e)
      throw new Error('AI_ERROR')
    }

    onProgress?.(75)

    // Валидируем и преобразуем задания
    let tasks = generatedJson.tasks || []
    console.log('[УчиОн] Generated tasks count:', tasks.length, 'Expected:', totalTasks)

    // Разделяем задания на тестовые и открытые
    let testTasks: GeneratedTask[] = []
    let openTasksList: GeneratedTask[] = []

    for (const task of tasks) {
      if (task.type === 'single_choice' || task.type === 'multiple_choice') {
        testTasks.push(task)
      } else {
        openTasksList.push(task)
      }
    }

    console.log('[УчиОн] Split: testTasks=', testTasks.length, 'openTasksList=', openTasksList.length)
    console.log('[УчиОн] Targets: testQuestions=', testQuestions, 'openTasks=', openTasks)

    // RETRY: Если не хватает заданий - догенерируем
    const missingOpen = openTasks - openTasksList.length
    const missingTest = testQuestions - testTasks.length

    if (missingOpen > 0 || missingTest > 0) {
      console.log(`[УчиОн] RETRY: Need ${missingOpen} more open tasks, ${missingTest} more test tasks`)

      try {
        const retryTasks = await this.generateMissingTasks(
          params,
          missingOpen,
          missingTest,
          taskTypes,
          difficulty
        )

        for (const task of retryTasks) {
          if (task.type === 'single_choice' || task.type === 'multiple_choice') {
            testTasks.push(task)
          } else {
            openTasksList.push(task)
          }
        }

        console.log('[УчиОн] After retry: testTasks=', testTasks.length, 'openTasksList=', openTasksList.length)
      } catch (retryError) {
        console.error('[УчиОн] Retry failed:', retryError)
        // Continue with what we have
      }
    }

    // Детерминированная валидация заданий (без LLM)
    const allTasks = [...testTasks, ...openTasksList]
    const validationResult = validateTasksDeterministic(allTasks, params.subject, params.grade)

    if (!validationResult.valid) {
      console.warn(`[УчиОн] Validation errors (${validationResult.errors.length}):`,
        validationResult.errors.map(e => `  [${e.taskIndex}] ${e.code}: ${e.message}`).join('\n')
      )

      // Filter out tasks with critical errors
      const badTaskIndices = new Set(validationResult.errors.map(e => e.taskIndex))
      const cleanTest = testTasks.filter((_, idx) => !badTaskIndices.has(idx))
      const testOffset = testTasks.length
      const cleanOpen = openTasksList.filter((_, idx) => !badTaskIndices.has(idx + testOffset))

      if (cleanTest.length < testTasks.length || cleanOpen.length < openTasksList.length) {
        console.log(`[УчиОн] Removed ${testTasks.length - cleanTest.length} test + ${openTasksList.length - cleanOpen.length} open invalid tasks`)
        testTasks = cleanTest
        openTasksList = cleanOpen
      }
    }

    if (validationResult.warnings.length > 0) {
      console.log(`[УчиОн] Validation warnings (${validationResult.warnings.length}):`,
        validationResult.warnings.map(w => `  [${w.taskIndex}] ${w.code}: ${w.message}`).join('\n')
      )
    }

    // Мультиагентная валидация (LLM-based, параллельно) + auto-fix
    const allTasksForAgents = [...testTasks, ...openTasksList]
    const agentValidation = await runMultiAgentValidation(
      allTasksForAgents,
      { subject: params.subject, grade: params.grade, topic: params.topic, difficulty },
      { autoFix: true }
    )

    if (agentValidation.problemTasks.length > 0) {
      console.warn(`[УчиОн] Agent validation: ${agentValidation.problemTasks.length} problem tasks:`,
        agentValidation.allIssues.map(i => `  [${i.taskIndex}] (${i.agent}) ${i.issue.code}: ${i.issue.message}`).join('\n')
      )
      const fixedCount = agentValidation.fixResults.filter(r => r.success).length
      console.log(`[УчиОн] Fixed ${fixedCount} of ${agentValidation.fixResults.length} problem tasks`)
    } else {
      console.log('[УчиОн] Agent validation: all tasks OK')
    }

    // Use fixed tasks instead of originals
    const finalTasks = agentValidation.fixedTasks
    const testOffset = testTasks.length
    testTasks = finalTasks.slice(0, testOffset) as typeof testTasks
    openTasksList = finalTasks.slice(testOffset) as typeof openTasksList

    // Преобразуем в формат Worksheet
    const worksheet = this.convertToWorksheet(params, testTasks, openTasksList, testQuestions, openTasks)

    onProgress?.(90)

    // Алерт о низком качестве (если мало заданий)
    if (tasks.length < totalTasks * 0.8) {
      checkValidationScore({
        score: Math.round((tasks.length / totalTasks) * 10),
        topic: params.topic,
        subject: params.subject,
        grade: params.grade,
      }).catch((e) => console.error('[Alerts] Failed to check:', e))
    }

    console.log("[GENERATION] Total duration ms =", Date.now() - totalStart)
    onProgress?.(95)

    return worksheet
  }

  /**
   * Преобразует сгенерированные задания в формат Worksheet
   */
  private convertToWorksheet(
    params: GenerateParams,
    testTasks: GeneratedTask[],
    openTasksList: GeneratedTask[],
    targetTestCount: number,
    targetOpenCount: number
  ): Worksheet {
    // Преобразуем тестовые задания
    const test: TestQuestion[] = testTasks.slice(0, targetTestCount).map(task => {
      if (task.type === 'single_choice') {
        const options = task.options || []
        const correctIdx = task.correctIndex ?? 0
        return {
          question: task.question || '',
          options,
          answer: options[correctIdx] || options[0] || ''
        }
      } else if (task.type === 'multiple_choice') {
        const options = task.options || []
        const correctIdxs = task.correctIndices || [0]
        const answers = correctIdxs.map(i => options[i]).filter(Boolean)
        return {
          question: task.question || '',
          options,
          answer: answers.join(', ')
        }
      }
      return { question: '', options: [], answer: '' }
    })

    // Преобразуем открытые задания
    const assignments: Assignment[] = openTasksList.slice(0, targetOpenCount).map((task, i) => {
      let text = ''

      if (task.type === 'open_question') {
        text = task.question || ''
      } else if (task.type === 'matching') {
        // Store matching as JSON for proper rendering in component
        const matchingData = {
          type: 'matching',
          instruction: task.instruction || 'Соотнеси элементы',
          leftColumn: task.leftColumn || [],
          rightColumn: task.rightColumn || [],
        }
        text = `<!--MATCHING:${JSON.stringify(matchingData)}-->`
      } else if (task.type === 'fill_blank') {
        text = task.textWithBlanks || ''
      }

      return {
        title: `Задание ${i + 1}`,
        text
      }
    })

    // Собираем ответы
    const answersAssignments: string[] = openTasksList.slice(0, targetOpenCount).map((task, i) => {
      let answer = ''
      if (task.type === 'open_question') {
        answer = task.correctAnswer || ''
      } else if (task.type === 'matching') {
        const pairs = task.correctPairs || []
        answer = pairs.map(([l, r]) => `${l + 1}-${String.fromCharCode(65 + r)}`).join(', ')
      } else if (task.type === 'fill_blank') {
        const blanks = task.blanks || []
        answer = blanks.map(b => `(${b.position}) ${b.correctAnswer}`).join('; ')
      }
      if (!answer) {
        console.warn(`[УчиОн] Empty answer for open task ${i} (type: ${task.type})`, {
          hasCorrectAnswer: !!task.correctAnswer,
          hasCorrectPairs: !!(task.correctPairs?.length),
          hasBlanks: !!(task.blanks?.length),
        })
      }
      return answer
    })

    const answersTest: string[] = testTasks.slice(0, targetTestCount).map((task, i) => {
      let answer = ''
      if (task.type === 'single_choice') {
        const options = task.options || []
        const idx = task.correctIndex ?? 0
        if (idx >= options.length) {
          console.warn(`[УчиОн] single_choice task ${i}: correctIndex ${idx} out of bounds (options: ${options.length})`)
        }
        answer = options[idx] || options[0] || ''
      } else if (task.type === 'multiple_choice') {
        const options = task.options || []
        const idxs = task.correctIndices || [0]
        const outOfBounds = idxs.filter(idx => idx >= options.length)
        if (outOfBounds.length > 0) {
          console.warn(`[УчиОн] multiple_choice task ${i}: correctIndices ${outOfBounds.join(',')} out of bounds (options: ${options.length})`)
        }
        answer = idxs.map(idx => options[idx]).filter(Boolean).join(', ')
      }
      if (!answer) {
        console.warn(`[УчиОн] Empty answer for test task ${i} (type: ${task.type})`, {
          hasOptions: !!(task.options?.length),
          correctIndex: task.correctIndex,
          correctIndices: task.correctIndices,
        })
      }
      return answer
    })

    return {
      id: '',
      subject: params.subject,
      grade: `${params.grade} класс`,
      topic: params.topic,
      assignments,
      test,
      answers: {
        assignments: answersAssignments,
        test: answersTest
      },
      pdfBase64: ''
    }
  }

  /**
   * Convert a single GeneratedTask to assignment/testQuestion + answer
   */
  private convertSingleTask(task: GeneratedTask, isTest: boolean): RegenerateTaskResult {
    if (isTest) {
      if (task.type === 'single_choice') {
        const options = task.options || []
        const correctIdx = task.correctIndex ?? 0
        const answer = options[correctIdx] || options[0] || ''
        return {
          testQuestion: {
            question: task.question || '',
            options,
            answer
          },
          answer
        }
      } else if (task.type === 'multiple_choice') {
        const options = task.options || []
        const correctIdxs = task.correctIndices || [0]
        const answers = correctIdxs.map(i => options[i]).filter(Boolean)
        const answer = answers.join(', ')
        return {
          testQuestion: {
            question: task.question || '',
            options,
            answer
          },
          answer
        }
      }
      return { testQuestion: { question: '', options: [], answer: '' }, answer: '' }
    }

    // Open task types
    let text = ''
    let answer = ''

    if (task.type === 'open_question') {
      text = task.question || ''
      answer = task.correctAnswer || ''
    } else if (task.type === 'matching') {
      const matchingData = {
        type: 'matching',
        instruction: task.instruction || 'Соотнеси элементы',
        leftColumn: task.leftColumn || [],
        rightColumn: task.rightColumn || [],
      }
      text = `<!--MATCHING:${JSON.stringify(matchingData)}-->`
      const pairs = task.correctPairs || []
      answer = pairs.map(([l, r]) => `${l + 1}-${String.fromCharCode(65 + r)}`).join(', ')
    } else if (task.type === 'fill_blank') {
      text = task.textWithBlanks || ''
      const blanks = task.blanks || []
      answer = blanks.map(b => `(${b.position}) ${b.correctAnswer}`).join('; ')
    }

    return {
      assignment: { title: 'Задание', text },
      answer
    }
  }

  /**
   * Regenerate a single task via LLM
   */
  async regenerateTask(params: RegenerateTaskParams): Promise<RegenerateTaskResult> {
    console.log('[УчиОн] OpenAIProvider.regenerateTask called', params)

    const systemPrompt = buildSystemPrompt(params.subject)
    const taskTypeConfig = getTaskType(params.taskType)
    const difficultyPrompt = getDifficultyPrompt(params.difficulty, params.subject, params.grade)

    const userPrompt = `
Создай РОВНО 1 задание для рабочего листа.

Предмет: ${params.subject}
Класс: ${params.grade}
Тема: "${params.topic}"
Сложность: ${difficultyPrompt}

Тип задания: ${taskTypeConfig.name}
${taskTypeConfig.promptInstruction}

Верни JSON:
{
  "tasks": [
    { "type": "${params.taskType}", ... }
  ]
}

ВАЖНО: Создай РОВНО 1 задание, не больше и не меньше!
`.trim()

    const isPaid = params.isPaid ?? false
    const generationModel = getGenerationModel(isPaid)
    console.log(`[УчиОн] Regenerate model: ${generationModel} (isPaid: ${isPaid})`)

    let completion
    try {
      completion = await timedLLMCall(
        "regenerate-task",
        () => this.client.chat.completions.create({
          model: generationModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 2000,
          temperature: 0.5
        })
      )
    } catch (error) {
      console.error('[УчиОн] OpenAI API Error (regenerateTask):', error)
      throw new Error('AI_ERROR')
    }

    const content = completion.choices[0]?.message?.content || ''
    let generatedJson: GeneratedWorksheetJson
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON')
      generatedJson = JSON.parse(jsonMatch[0])
    } catch (e) {
      console.error('[УчиОн] JSON parse error (regenerateTask):', e)
      throw new Error('AI_ERROR')
    }

    const task = generatedJson.tasks?.[0]
    if (!task) {
      console.error('[УчиОн] No task in response (regenerateTask)')
      throw new Error('AI_ERROR')
    }

    return this.convertSingleTask(task, params.isTest)
  }

  /**
   * Догенерировать недостающие задания
   */
  private async generateMissingTasks(
    params: GenerateParams,
    missingOpen: number,
    missingTest: number,
    taskTypes: TaskTypeId[],
    difficulty: DifficultyLevel
  ): Promise<GeneratedTask[]> {
    const openTypes = taskTypes.filter(t => !['single_choice', 'multiple_choice'].includes(t))
    const testTypes = taskTypes.filter(t => ['single_choice', 'multiple_choice'].includes(t))

    const tasksToGenerate: string[] = []

    if (missingOpen > 0 && openTypes.length > 0) {
      const typeToUse = openTypes[0] // Используем первый доступный тип
      tasksToGenerate.push(`${missingOpen} заданий типа ${typeToUse}`)
    }

    if (missingTest > 0 && testTypes.length > 0) {
      const typeToUse = testTypes[0]
      tasksToGenerate.push(`${missingTest} тестовых вопросов типа ${typeToUse}`)
    }

    if (tasksToGenerate.length === 0) {
      return []
    }

    const retryPrompt = `
Тебе нужно создать дополнительные задания по теме "${params.topic}" для ${params.grade} класса.

СОЗДАЙ РОВНО:
${tasksToGenerate.join('\n')}

Используй тот же формат JSON:
{
  "tasks": [
    { "type": "тип_задания", ... }
  ]
}

ВАЖНО: Создай ИМЕННО указанное количество заданий, не больше и не меньше!
`

    const isPaid = params.isPaid ?? false
    const generationModel = getGenerationModel(isPaid)

    const completion = await this.client.chat.completions.create({
      model: generationModel,
      messages: [
        { role: 'user', content: retryPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.5 // Ниже температура для более точного следования
    })

    const content = completion.choices[0]?.message?.content || ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (!jsonMatch) {
      console.error('[УчиОн] RETRY: No JSON found in response')
      return []
    }

    try {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed.tasks || []
    } catch {
      console.error('[УчиОн] RETRY: JSON parse error')
      return []
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function getAIProvider(): AIProvider {
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'

  const aiProvider = process.env.AI_PROVIDER
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL

  const useAI =
    (isProd && aiProvider === 'openai' && apiKey) ||
    (aiProvider === 'polza' && apiKey) ||
    (aiProvider === 'neuroapi' && apiKey)

  console.log('[УчиОн] getAIProvider:', {
    isProd,
    AI_PROVIDER: aiProvider,
    AI_BASE_URL: baseURL || 'default',
    useAI: !!useAI,
  })

  if (useAI) {
    return new OpenAIProvider(apiKey as string, baseURL)
  }

  return new DummyProvider()
}

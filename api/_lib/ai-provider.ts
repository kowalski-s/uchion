import type { Worksheet, Subject, TestQuestion, Assignment, WorksheetAnswers, WorksheetJson, AssignmentType, ValidationResult, ValidationIssueAnalysis } from '../../shared/types'
import { z } from 'zod'
import OpenAI from 'openai'
import { generatePrompt, SYSTEM_PROMPT } from './prompt.js'
import { AIResponseSchema } from './schema.js'
import type { GeneratePayload } from '../../shared/types'

export type GenerateParams = {
  subject: Subject
  grade: number
  topic: string
}

export interface AIProvider {
  generateWorksheet(params: GenerateParams, onProgress?: (percent: number) => void): Promise<Worksheet>
}

class DummyProvider implements AIProvider {
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] DummyProvider.generateWorksheet called', params)
    
    const summary = 'Умножение суммы на число означает, что каждое слагаемое умножается на одно и то же число. Это правило используется для удобства вычислений и записывается как формула: **(a + b) × c = a × c + b × c**.\n\nПример:\n(3 + 5) × 4 = 3 × 4 + 5 × 4 = 12 + 20 = 32.\n\nЭто позволяет сначала выполнить умножение каждого слагаемого, а затем сложить результаты. Такой способ помогает проверять вычисления и раскрывать скобки правильно.'

    const cheatsheet = [
      'Компоненты деления: Делимое : Делитель = Частное',
      'Чтобы найти неизвестный делитель, нужно делимое разделить на частное.',
      'Чтобы найти неизвестное делимое, нужно частное умножить на делитель.',
      'На ноль делить НЕЛЬЗЯ!',
      'Пример проверки: 15 : 3 = 5, потому что 5 * 3 = 15'
    ]

    const assignments: Assignment[] = [
      {
        title: 'Задание 1',
        text: 'Подчеркни в примере компоненты деления разными цветами: 15 : 3 = 5. (Делимое — красным, делитель — синим, частное — зелёным).'
      },
      {
        title: 'Задание 2',
        text: 'Реши задачу: В коробке было 20 карандашей. Учитель раздал их поровну 5 ученикам. Сколько карандашей получил каждый ученик?'
      },
      {
        title: 'Задание 3',
        text: 'Вставь пропущенные числа: 18 : ... = 9; ... : 4 = 5; 21 : 7 = ...'
      },
      {
        title: 'Задание 4',
        text: 'Придумай и запиши свой пример на деление, где делимое больше 30.'
      }
    ]

    const test: TestQuestion[] = [
      { question: 'Как называется результат деления?', options: ['Разность', 'Частное', 'Произведение'], answer: 'Частное' },
      { question: 'Сколько будет 24 : 4?', options: ['6', '8', '4'], answer: '6' },
      { question: 'Можно ли делить на ноль?', options: ['Да', 'Нет', 'Иногда'], answer: 'Нет' },
      { question: 'Какой знак используется для деления?', options: ['+', '-', ':'], answer: ':' },
      { question: 'Если 10 разделить на 2, сколько получится?', options: ['2', '5', '10'], answer: '5' }
    ]
    
    const answers: WorksheetAnswers = {
      assignments: [
        '15 (красным) : 3 (синим) = 5 (зелёным)',
        '20 : 5 = 4 (карандаша)',
        '18 : 2 = 9; 20 : 4 = 5; 21 : 7 = 3',
        'Пример ученика (например, 35 : 5 = 7)'
      ],
      test: ['Частное', '6', 'Нет', ':', '5']
    }

    const gradeStr = `${params.grade} класс`
    return {
      id: 'dummy-id',
      subject: params.subject as Subject,
      grade: gradeStr,
      topic: params.topic,
      summary,
      cheatsheet,
      assignments,
      test,
      answers,
      pdfBase64: ''
    }
  }
}

const RUSSIAN_SYSTEM_PROMPT = `
Ты — методист по русскому языку для 1–4 классов (ФГОС). Объясняй тему чётко, нейтрально, без «дети» и «на уроке». Используй только терминологию начальной школы.

Формат вывода строго:
SUMMARY → CHEATSHEET → ASSIGNMENTS (4 задания) → TEST (5 вопросов A/B/C) → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.

Требования:
- SUMMARY: 3–4 абзаца, выделяй **жирным** ключевые правила, примеры отдельным абзацем.
- CHEATSHEET: 3–6 кратких пунктов.
- ASSIGNMENTS: ровно 4 задания — понимание, применение, поиск 1 ошибки, творческое. 1 задание = 1 действие. Нельзя начинать задание словом «Пример:».
- TEST: 5 вопросов по A/B/C, один правильный.
- ANSWERS: кратко и однозначно.

Запрещено: темы 5+ класса, выдуманные правила, подпункты (а),(б…), слишком лёгкие/сложные задания, нелепые примеры, изменение структуры блоков.

Перед выводом проверяй: корректность правил, отсутствие ошибок, соответствие уровню класса, совпадение количества заданий и ответов.
`.trim();

const MATH_SYSTEM_PROMPT = `
Ты — методист по математике для 1–4 классов (ФГОС). Дай точные определения и правила, без терминов старшей школы. Проверяй вычисления.

Строгий формат вывода:
SUMMARY → CHEATSHEET → ASSIGNMENTS (4 задания) → TEST (5 вопросов) → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.

SUMMARY — 3–4 абзаца, примеры отдельно, важное выделяй **жирным**.
CHEATSHEET — 3–6 коротких пунктов.
ASSIGNMENTS — 4 задания: понимание, применение, поиск 1 ошибки, текстовая/комбинированная. 1 задание = 1 действие. Только числа и приёмы из программы 1–4 класса.
TEST — 5 вопросов A/B/C, один правильный.
ANSWERS — только результат, без пересказов.

Запрещено: отрицательные числа, дроби вне программы, подпункты, нелепые задачи, изменение структуры блоков.

Перед выводом сверяй все вычисления, корректность типов заданий, совпадение количества вопросов/ответов.
`.trim();

const RUSSIAN_VALIDATOR_PROMPT = `
Ты — валидатор русского языка 1–4 классов. Проверяешь готовый рабочий лист.

Проверяй:
- корректность теории (нет выдуманных правил, нет терминов старшей школы);
- задания: ровно 4, 1 действие, нет «Пример:» вместо задания, №3 содержит одну конкретную ошибку;
- тест: 5 вопросов, по 3 варианта, 1 правильный;
- ответы: 4 + 5, соответствуют заданиям;
- структура всех блоков сохранена.

Формат вывода:
STATUS: OK
или
STATUS: FAIL
ISSUES:
- [описание ошибки]
`.trim();

const MATH_VALIDATOR_PROMPT = `
Ты — валидатор математики 1–4 классов.

Проверяй:
- теорию (нет ошибок, нет тем 5+ класса);
- задания: 4, 1 действие, корректные числа, №3 содержит одну ошибку;
- тест: 5 вопросов, A/B/C, один правильный;
- ответы: корректные, соответствуют заданиям;
- структура блоков строго соблюдена.

Вывод:
STATUS: OK
или
STATUS: FAIL
ISSUES:
- [описание ошибки]
`.trim();

const ValidatorResponseSchema = z.object({
  score: z.number().min(1).max(10),
  issues: z.array(z.string())
})

type SubjectConfig = {
  systemPrompt: string;
  validatorPrompt: string;
}

const SUBJECT_CONFIG: Record<Subject, SubjectConfig> = {
  russian: {
    systemPrompt: RUSSIAN_SYSTEM_PROMPT,
    validatorPrompt: RUSSIAN_VALIDATOR_PROMPT,
  },
  math: {
    systemPrompt: MATH_SYSTEM_PROMPT,
    validatorPrompt: MATH_VALIDATOR_PROMPT,
  },
}

function extractTextFromResponse(response: any): string {
  if (!response) return "";

  // Новый формат Responses API: output_text (если доступен)
  if (typeof (response as any).output_text === "string") {
    return (response as any).output_text;
  }

  // Запасной вариант через output[*].content[*].text
  const output = (response as any).output;
  if (Array.isArray(output)) {
    const first = output[0];
    const firstContent = first?.content?.[0];
    if (firstContent && typeof firstContent.json === 'object') {
      try {
        return JSON.stringify(firstContent.json)
      } catch {}
    }
    const text = firstContent?.text;
    if (typeof text === "string") return text;
  }

  return "";
}

function parseValidatorOutput(outputText: string): ValidationResult {
  const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean)
  let status: 'OK' | 'FAIL' = 'FAIL'
  const issues: string[] = []
  for (const line of lines) {
    if (line.startsWith('STATUS:')) {
      if (line.includes('OK')) status = 'OK'
      if (line.includes('FAIL')) status = 'FAIL'
    } else if (line.startsWith('-')) {
      issues.push(line)
    }
  }
  return { status, issues }
}

function analyzeValidationIssues(issues: string[]): ValidationIssueAnalysis {
  const invalidAssignments: number[] = []
  const invalidTests: number[] = []
  let hasStructureErrors = false
  for (const issue of issues) {
    const upper = issue.toUpperCase()
    if (upper.includes('[БЛОК]') || upper.includes('[BLOCK]') || upper.includes('STRUCTURE')) {
      hasStructureErrors = true
    }
    const assignMatch = upper.match(/\[ASSIGNMENT\s+(\d+)\]/)
    if (assignMatch) {
      const idx = Number(assignMatch[1])
      if (!Number.isNaN(idx)) invalidAssignments.push(idx)
    }
    const testMatch = upper.match(/\[TEST\s+(\d+)\]/)
    if (testMatch) {
      const idx = Number(testMatch[1])
      if (!Number.isNaN(idx)) invalidTests.push(idx)
    }
  }
  return {
    hasStructureErrors,
    invalidAssignments: Array.from(new Set(invalidAssignments)).sort((a, b) => a - b),
    invalidTests: Array.from(new Set(invalidTests)).sort((a, b) => a - b),
  }
}

async function regenerateProblemBlocks(params: {
  subject: Subject
  grade: number
  topic: string
  original: WorksheetJson
  analysis: ValidationIssueAnalysis
  openai: any
  onProgress?: (percent: number) => void
}): Promise<WorksheetJson> {
  const { subject, grade, topic, original, analysis, openai, onProgress } = params
  if (analysis.hasStructureErrors) return original
  const needAssignments = analysis.invalidAssignments.length > 0
  const needTests = analysis.invalidTests.length > 0
  if (!needAssignments && !needTests) return original

  console.log('[CLEAN] invalidAssignments:', analysis.invalidAssignments, 'invalidTests:', analysis.invalidTests)
  onProgress?.(75)

  const partial: Partial<WorksheetJson> = {}
  if (needAssignments) {
    partial.assignments = (original.assignments || []).filter(a => analysis.invalidAssignments.includes(a.index))
  }
  if (needTests) {
    partial.test = (original.test || []).filter(t => analysis.invalidTests.includes(t.index))
  }

  const systemPrompt = SUBJECT_CONFIG[subject].systemPrompt
  const userParts: string[] = []
  userParts.push(`Ты уже сгенерировал рабочий лист по теме "${topic}" для ${grade} класса (предмет: ${subject}).`)
  userParts.push('Валидатор нашёл ошибки в некоторых заданиях и/или вопросах теста. Нужно ПЕРЕГЕНЕРИРОВАТЬ ТОЛЬКО проблемные элементы, сохраняя формат WorksheetJson.')
  if (needAssignments) userParts.push(`Проблемные задания (assignments) с индексами: ${analysis.invalidAssignments.join(', ')}.`)
  if (needTests) userParts.push(`Проблемные вопросы теста (test) с индексами: ${analysis.invalidTests.join(', ')}.`)
  userParts.push('Вот фрагмент текущего WorksheetJson с проблемными элементами (assignments/test):')
  userParts.push(JSON.stringify(partial, null, 2))
  userParts.push('Твоя задача: вернуть НОВЫЕ версии только этих элементов в формате JSON со структурой:')
  userParts.push(`{ "assignments": [ { "index": number, "type": "theory" | "apply" | "error" | "creative", "text": string } ], "test": [ { "index": number, "question": string, "options": { "A": string, "B": string, "C": string } } ] }`)
  userParts.push('Не изменяй индексы. Верни только поля, которые ты перегенерировал. Без комментариев, без текста вне JSON.')
  const userPrompt = userParts.join('\n\n')

  const regenerationResponse = await timedLLMCall('regen-problem-blocks', () =>
    (openai as any).responses.create({
      model: 'gpt-4.1-mini',
      max_output_tokens: 800,
      text: {
        format: {
          type: 'json_schema',
          name: 'worksheet_blocks_patch',
          schema: {
            type: 'object',
            properties: {
              assignments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'integer' },
                    type: { type: 'string', enum: ['theory','apply','error','creative'] },
                    text: { type: 'string' }
                  },
                  required: ['index','type','text']
                }
              },
              test: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    index: { type: 'integer' },
                    question: { type: 'string' },
                    options: {
                      type: 'object',
                      properties: { A: { type: 'string' }, B: { type: 'string' }, C: { type: 'string' } },
                      required: ['A','B','C']
                    }
                  },
                  required: ['index','question','options']
                }
              }
            },
            additionalProperties: false
          }
        }
      },
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  )

  const regenText = extractTextFromResponse(regenerationResponse)
  let patch: Partial<WorksheetJson> = {}
  try {
    patch = JSON.parse(regenText)
  } catch (e) {
    console.error('[REGEN] Failed to parse blocks patch JSON', e)
    return original
  }

  const updated: WorksheetJson = {
    ...original,
    assignments: (original.assignments || []).map(a => {
      const replacement = patch.assignments?.find(pa => pa.index === a.index) ?? null
      return replacement ? { ...a, ...replacement } : a
    }),
    test: (original.test || []).map(t => {
      const replacement = patch.test?.find(pt => pt.index === t.index) ?? null
      return replacement ? { ...t, ...replacement } : t
    })
  }
  onProgress?.(85)
  return updated
}

function buildWorksheetTextFromJson(json: WorksheetJson): string {
  const parts: string[] = []
  parts.push('SUMMARY:')
  parts.push((json.summary || '').trim())
  parts.push('')
  parts.push('CHEATSHEET:')
  for (const item of json.cheatsheet || []) {
    parts.push(`- ${item}`)
  }
  parts.push('')
  parts.push('ASSIGNMENTS:')
  for (const a of json.assignments || []) {
    parts.push(`${a.index}) ${a.text}`)
  }
  parts.push('')
  parts.push('TEST:')
  for (const t of json.test || []) {
    parts.push(`${t.index}) ${t.question}`)
    parts.push(`A) ${t.options?.A ?? ''}`)
    parts.push(`B) ${t.options?.B ?? ''}`)
    parts.push(`C) ${t.options?.C ?? ''}`)
  }
  parts.push('')
  parts.push('ANSWERS_ASSIGNMENTS:')
  for (let i = 0; i < (json.answers?.assignments?.length ?? 0); i++) {
    const ans = json.answers!.assignments[i]
    parts.push(`${i + 1}) ${ans}`)
  }
  parts.push('')
  parts.push('ANSWERS_TEST:')
  for (let i = 0; i < (json.answers?.test?.length ?? 0); i++) {
    const ans = json.answers!.test[i]
    parts.push(`${i + 1}) ${ans} — правильный ответ`)
  }
  return parts.join('\n')
}

async function timedLLMCall(label: string, call: () => Promise<any>) {
  const start = Date.now();
  console.log(`[LLM][START] ${label}`);
  const res = await call();
  const end = Date.now();

  console.log(`[LLM][END] ${label}`, {
    duration_ms: end - start,
    timestamp: new Date().toISOString(),
    model: res?.model,
    usage: res?.usage ?? null
  });

  return res;
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  private async getTextbookContext(params: GenerateParams): Promise<string> {
    try {
      const VECTOR_STORE_ID = process.env.UCHION_VECTOR_STORE_ID
      if (!VECTOR_STORE_ID) return ""

      const query = `Предмет: ${params.subject}. ${params.grade} класс. Тема: ${params.topic}. Типичные задания и формулировки по ФГОС для начальной школы.`

      // @ts-ignore - OpenAI SDK types might be outdated in some versions, ignoring potential type mismatch for vectorStores
      const search = await this.client.beta.vectorStores.fileBatches.list(VECTOR_STORE_ID) ? await this.client.beta.vectorStores.files.list(VECTOR_STORE_ID) : null
      
      // Since standard SDK might not have search helper directly exposed or it's in beta, 
      // we'll assume the user wants us to implement the logic as described, 
      // but 'client.vectorStores.search' is not a standard SDK method yet (it's usually file search tool in assistants).
      // However, the user explicitly provided the code snippet using `client.vectorStores.search`.
      // If the SDK version installed supports it (likely a custom or very new beta feature not fully typed), we try to use it.
      // If `client.vectorStores.search` does not exist in the installed SDK, we might need a workaround or assume it exists at runtime.
      
      // Let's try to follow the user's snippet exactly, assuming they have a compatible SDK or extended type.
      // Casting client to any to avoid TS errors for this specific experimental/custom method.
      
      const searchResult = await (this.client as any).vectorStores.search(VECTOR_STORE_ID, {
        query,
        max_num_results: 8,
      })

      const chunks: string[] = []

      for (const item of searchResult.data ?? []) {
        for (const piece of item.content ?? []) {
          if (piece.type === "text" && piece.text) {
            chunks.push(piece.text)
          }
        }
      }

      if (chunks.length === 0) return ""

      return chunks.slice(0, 5).join("\n---\n")
    } catch (e) {
      console.error("Vector store search failed", e)
      return ""
    }
  }

  private async validateWorksheet(content: string, params: GenerateParams): Promise<{ score: number, issues: string[] }> {
    try {
      // @ts-ignore - Using new responses API
      const completion = await timedLLMCall(
        "validator",
        () => (this.client as any).responses.create({
          model: 'gpt-4.1-mini', // faster validator
          input: [
            { role: 'system', content: SUBJECT_CONFIG[params.subject].validatorPrompt },
            { role: 'user', content: `Предмет: ${params.subject}\nКласс: ${params.grade}\nТема: ${params.topic}\n\n${content}` }
          ],
          max_output_tokens: 600,
          reasoning: { max_tokens: 150 }
        })
      )

      console.log('[Validator Response]', JSON.stringify(completion, null, 2))

      const responseContent = extractTextFromResponse(completion)
      if (!responseContent) return { score: 0, issues: ['Validator: empty response'] }

      const statusMatch = responseContent.match(/STATUS:\s*(OK|FAIL)/i)
      const status = statusMatch ? statusMatch[1].toUpperCase() : 'FAIL'

      let issues: string[] = []
      const issuesBlockMatch = responseContent.match(/ISSUES:\s*[\r\n]+([\s\S]*)/i)
      if (issuesBlockMatch) {
        const block = issuesBlockMatch[1]
        issues = block.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('- ')).map(l => l.replace(/^\-\s*/, ''))
      }

      const score = status === 'OK' ? 10 : (issues.length > 0 ? Math.max(1, 10 - Math.min(issues.length, 9)) : 5)
      return { score, issues }
    } catch (error) {
      console.error('Validator error:', error)
      return { score: 0, issues: ['Validator exception'] }
    }
  }

  async generateWorksheet(params: GenerateParams, onProgress?: (percent: number) => void): Promise<Worksheet> {
    console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params)
    const totalStart = Date.now();
    console.log("[GENERATION] Started at", new Date().toISOString());
    onProgress?.(10) // Start
    
    const userPromptBase = `Сгенерируй рабочий лист.
Предмет: ${params.subject}
Класс: ${params.grade}
Тема: ${params.topic}

Включи в вывод все обязательные разделы (SUMMARY, CHEATSHEET, ASSIGNMENTS, TEST, ANSWERS...).`

    const cfg = SUBJECT_CONFIG[params.subject]
    let systemPrompt = cfg.systemPrompt

    // Try to get context (optional)
    const context = await this.getTextbookContext(params)
    onProgress?.(15) // Context retrieved
    if (context) {
      systemPrompt += `\n\nИСПОЛЬЗУЙ СЛЕДУЮЩИЕ МАТЕРИАЛЫ ИЗ УЧЕБНИКОВ:\n${context}`
    }

    let bestContent = ''
    let bestScore = -1
    let bestIssues: string[] = []
    let lastIssues: string[] = []
    
    const MAX_ATTEMPTS = 1
    let worksheetJson: WorksheetJson | null = null

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      console.log(`[УчиОн] Generation attempt ${attempt}/${MAX_ATTEMPTS}`)
      onProgress?.(attempt === 1 ? 20 : 65) // Generation start
      
      let currentUserPrompt = userPromptBase
      if (attempt > 1 && lastIssues.length > 0) {
        currentUserPrompt += `\n\nВАЖНО: В предыдущей версии были найдены ошибки. ИСПРАВЬ ИХ:\n- ${lastIssues.join('\n- ')}`
      }

      let completion
      try {
        // @ts-ignore - Using new responses API
        completion = await timedLLMCall(
          "main-generation",
          () => (this.client as any).responses.create({
            model: 'gpt-5-mini',
            input: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: currentUserPrompt }
            ],
            max_output_tokens: 2200,
            text: {
              format: {
                type: 'json_schema',
                name: 'worksheet_json',
                schema: {
                  type: 'object',
                  properties: {
                    summary: { type: 'string' },
                    cheatsheet: { type: 'array', items: { type: 'string' } },
                    assignments: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          index: { type: 'integer' },
                          type: { type: 'string', enum: ['theory','apply','error','creative'] },
                          text: { type: 'string' }
                        },
                        required: ['index','type','text']
                      }
                    },
                    test: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          index: { type: 'integer' },
                          question: { type: 'string' },
                          options: {
                            type: 'object',
                            properties: { A: { type: 'string' }, B: { type: 'string' }, C: { type: 'string' } },
                            required: ['A','B','C']
                          }
                        },
                        required: ['index','question','options']
                      }
                    },
                    answers: {
                      type: 'object',
                      properties: {
                        assignments: { type: 'array', items: { type: 'string' } },
                        test: { type: 'array', items: { type: 'string', enum: ['A','B','C'] } }
                      },
                      required: ['assignments','test']
                    }
                  },
                  required: ['summary','cheatsheet','assignments','test','answers'],
                  additionalProperties: false
                }
              }
            },
            reasoning: { max_tokens: 300 }
          })
        )
        console.log('[Generator Response]', JSON.stringify(completion, null, 2))
      } catch (error) {
        console.error('[УчиОн] OpenAI API Error:', error)
        throw error
      }

      let worksheetText = ''
      {
        const jsonText = extractTextFromResponse(completion).trim()
        try {
          worksheetJson = JSON.parse(jsonText) as WorksheetJson
        } catch (e) {
          console.error('[GEN] Failed to parse WorksheetJson', e)
          throw new Error('Failed to parse AI JSON response')
        }
        console.log('[GEN] WorksheetJson summary length:', worksheetJson.summary?.length ?? 0)
        console.log('[GEN] WorksheetJson assignments count:', worksheetJson.assignments?.length ?? 0)
        worksheetText = buildWorksheetTextFromJson(worksheetJson as WorksheetJson)
      }
      if (!worksheetText) {
        if (attempt === MAX_ATTEMPTS && !bestContent) throw new Error('AI_ERROR')
        continue
      }
      
      onProgress?.(attempt === 1 ? 50 : 80) // Generation done

      // Step 2: Validate
      console.log(`[УчиОн] Validating attempt ${attempt}...`)
      const validation = await this.validateWorksheet(worksheetText, params)
      console.log(`[УчиОн] Validation result: score=${validation.score}, issues=${validation.issues.length}`)
      onProgress?.(attempt === 1 ? 60 : 90) // Validation done

      if (validation.score === 10) {
        console.log('[УчиОн] Perfect score! Returning result.')
        console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
        const base = this.parseWorksheetText(worksheetText, params) as any
        base.json = worksheetJson
        base.validationStatus = 'OK'
        return base as Worksheet
      }

      // CLEAN step: partial regeneration of problem blocks
      const analysis = analyzeValidationIssues(validation.issues)
      console.log('[CLEAN] analysis:', {
        invalidAssignments: analysis.invalidAssignments,
        invalidTests: analysis.invalidTests,
        hasStructureErrors: analysis.hasStructureErrors,
      })
      onProgress?.(70)
      const regenJson = await regenerateProblemBlocks({
        subject: params.subject,
        grade: params.grade,
        topic: params.topic,
        original: worksheetJson,
        analysis,
        openai: this.client,
        onProgress
      })
      worksheetJson = regenJson
      worksheetText = buildWorksheetTextFromJson(worksheetJson as WorksheetJson)

      const validation2 = await this.validateWorksheet(worksheetText, params)
      console.log(`[УчиОн] Validation after CLEAN: score=${validation2.score}, issues=${validation2.issues.length}`)
      onProgress?.(90)
      if (validation2.score === 10) {
        console.log('[УчиОн] Clean step succeeded.')
        console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
        const base = this.parseWorksheetText(worksheetText, params) as any
        base.json = worksheetJson ?? undefined
        base.validationStatus = 'OK'
        return base as Worksheet
      }

      // If still FAIL, return the latest version without further loops
      bestScore = validation2.score
      bestContent = worksheetText
      bestIssues = validation2.issues
    }

    console.warn(`[УчиОн] Failed to generate perfect worksheet after ${MAX_ATTEMPTS} attempts. Returning best score: ${bestScore}`)
    console.warn('Issues in best content:', bestIssues)

    if (!bestContent) {
       throw new Error('AI_ERROR')
    }

    onProgress?.(95)
    console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
    const base = this.parseWorksheetText(bestContent, params) as any
    base.json = worksheetJson ?? undefined
    base.validationStatus = 'FAIL'
    return base as Worksheet
  }

  private parseWorksheetText(text: string, params: GenerateParams): Worksheet {
    // Simple parser based on headers
    // Expected headers: 
    // SUMMARY:
    // CHEATSHEET:
    // ASSIGNMENTS:
    // TEST:
    // ANSWERS_ASSIGNMENTS:
    // ANSWERS_TEST:

    const extractSection = (header: string, nextHeader: string | null): string => {
      const regex = nextHeader 
        ? new RegExp(`${header}[\\s\\S]*?(?=${nextHeader})`, 'i')
        : new RegExp(`${header}[\\s\\S]*`, 'i')
      
      const match = text.match(regex)
      if (!match) return ''
      
      // Remove the header itself
      return match[0].replace(new RegExp(`^.*?${header}\\s*`, 'i'), '').trim()
    }

    const topic = params.topic // Topic is not in the output anymore, use params
    const summary = extractSection('SUMMARY:', 'CHEATSHEET:')
    const cheatsheetText = extractSection('CHEATSHEET:', 'ASSIGNMENTS:')
    const assignmentsText = extractSection('ASSIGNMENTS:', 'TEST:')
    const testText = extractSection('TEST:', 'ANSWERS_ASSIGNMENTS:')
    const answersAssignText = extractSection('ANSWERS_ASSIGNMENTS:', 'ANSWERS_TEST:')
    const answersTestText = extractSection('ANSWERS_TEST:', null)

    // Parse Cheatsheet (split by newline, remove empty or bullets)
    const cheatsheet = cheatsheetText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.match(/^(CHEATSHEET:)/i)) // clean up if needed
      .map(l => l.replace(/^[-•*]\s*/, '')) // remove bullets

    // Parse Assignments
    const assignments: Assignment[] = assignmentsText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 4) // Ensure exactly 4
      .map((text, i) => ({
        title: `Задание ${i + 1}`,
        text: text.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, '')
      }))

    // Parse Test
    // Format: Question \n A) ... \n B) ... \n C) ...
    const test: TestQuestion[] = []
    const testLines = testText.split('\n').map(l => l.trim()).filter(l => l)
    
    let currentQuestion: Partial<TestQuestion> = {}
    let currentOptions: string[] = []
    
    for (const line of testLines) {
      if (line.match(/^[A-C]\)/)) {
        // Option
        currentOptions.push(line.replace(/^[A-C]\)\s*/, ''))
      } else if (line.length > 0) {
        // Likely a question (or number + question)
        if (currentQuestion.question && currentOptions.length > 0) {
          // Push previous question
          test.push({
            question: currentQuestion.question,
            options: currentOptions,
            answer: '' // Will fill later or leave empty if parsing answers fails
          } as TestQuestion)
          currentOptions = []
        }
        currentQuestion = { question: line.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, '') }
      }
    }
    // Push last question
    if (currentQuestion.question && currentOptions.length > 0) {
      test.push({
        question: currentQuestion.question,
        options: currentOptions,
        answer: ''
      } as TestQuestion)
    }

    // Parse Answers
    let answersAssignments: string[] = []
    let answersTest: string[] = []

    if (answersAssignText) {
       answersAssignments = answersAssignText.split('\n').map(l => l.trim()).filter(l => l).map(l => l.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, ''))
    }
    
    if (answersTestText) {
       answersTest = answersTestText.split('\n').map(l => l.trim()).filter(l => l).map(l => l.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, ''))

      // Try to map test answers to options if they are just letters (A, B, C)
      test.forEach((q, i) => {
        if (answersTest[i]) {
          // If answer starts with "A" or "A)", try to extract letter
          const letterMatch = answersTest[i].match(/^([A-C])\)?/i)
          if (letterMatch) {
            const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65
            if (q.options[idx]) {
               // We found the option text corresponding to the letter
               // But usually we want to display the full answer text in the answer key
               // The UI might expect just the text.
               // Let's keep what the model gave us but cleaned up slightly if it was just "A"
               // Actually, if the model gave "A — answer text", we use that.
               // If it just gave "A", we map it.
               if (answersTest[i].length < 5) {
                   q.answer = q.options[idx]
               } else {
                   q.answer = answersTest[i]
               }
            } else {
               q.answer = answersTest[i]
            }
          } else {
             q.answer = answersTest[i]
          }
        }
      })
    }

    // Fallback validation/defaults
    const safeAssignments = assignments.slice(0, 4)
    while (safeAssignments.length < 4) {
      safeAssignments.push({ title: `Задание ${safeAssignments.length + 1}`, text: '...' })
    }

    const safeTest = test.slice(0, 5)
    
    return {
      id: '',
      subject: params.subject as Subject,
      grade: `${params.grade} класс`,
      topic: topic || params.topic,
      summary: summary || 'Описание отсутствует',
      cheatsheet: cheatsheet.length ? cheatsheet : ['Правило 1', 'Правило 2'],
      assignments: safeAssignments,
      test: safeTest,
      answers: {
        assignments: answersAssignments,
        test: answersTest
      },
      pdfBase64: ''
    }
  }
}

export function getAIProvider(): AIProvider {
  const providerEnv = (process.env.AI_PROVIDER || '').trim().toLowerCase()
  const apiKey = process.env.OPENAI_API_KEY
  const hasKey = Boolean(apiKey && apiKey.length > 0)

  const providerName =
    providerEnv === 'openai' && hasKey ? 'openai' : 'dummy'

  console.log('[УчиОн] getAIProvider:', {
    AI_PROVIDER: process.env.AI_PROVIDER, // Log original value to see hidden chars
    normalized: providerEnv,
    hasKey,
    using: providerName,
  })

  if (providerEnv === 'openai' && !hasKey) {
    throw new Error('Missing OPENAI_API_KEY for provider "openai"')
  }

  if (providerName === 'openai') {
    return new OpenAIProvider(apiKey as string)
  }

  return new DummyProvider()
}

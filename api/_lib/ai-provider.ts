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
    
    const assignments: Assignment[] = [
      { title: "Задание 1", text: "Найди значение выражения 245 + 130." },
      { title: "Задание 2", text: "Реши задачу: У Маши было 120 тетрадей, 40 она раздала. Сколько осталось?" },
      { title: "Задание 3", text: "Найди и исправь ошибку в вычислении: 360 : 9 = 2." },
      { title: "Задание 4", text: "Продолжи числовой ряд: 300, 290, 280, ..." },
      { title: "Задание 5", text: "Запиши в виде выражения: число 450 уменьшили на 70." },
      { title: "Задание 6", text: "Найди ошибку: 600 – 250 = 450." },
      { title: "Задание 7", text: "Текстовая задача: У Пети 3 пачки по 12 карандашей. Сколько карандашей всего?" },
      { title: "Задание 8", text: "Комбинированное задание: сначала сложи 130 и 270, а затем результат уменьши на 80." }
    ]

    const test: TestQuestion[] = [
      { question: 'Как называется результат деления?', options: ['Разность', 'Частное', 'Произведение'], answer: 'Частное' },
      { question: 'Сколько будет 24 : 4?', options: ['6', '8', '4'], answer: '6' },
      { question: 'Можно ли делить на ноль?', options: ['Да', 'Нет', 'Иногда'], answer: 'Нет' },
      { question: 'Какой знак используется для деления?', options: ['+', '-', ':'], answer: ':' },
      { question: 'Если 10 разделить на 2, сколько получится?', options: ['2', '5', '10'], answer: '5' },
      { question: 'Как найти площадь прямоугольника?', options: ['a + b', 'a * b', '2 * (a + b)'], answer: 'a * b' },
      { question: 'Сколько сантиметров в 1 метре?', options: ['10', '100', '1000'], answer: '100' },
      { question: 'Что больше: 1 кг или 1000 г?', options: ['1 кг', '1000 г', 'Равны'], answer: 'Равны' },
      { question: 'Найди периметр квадрата со стороной 5 см.', options: ['20 см', '25 см', '10 см'], answer: '20 см' },
      { question: 'Сколько минут в 1 часе?', options: ['60', '100', '30'], answer: '60' }
    ]
    
    const answers: WorksheetAnswers = {
      assignments: [
        '375',
        '80 тетрадей',
        '360 : 9 = 40 (ошибка: было 2)',
        '270, 260, 250',
        '450 - 70 = 380',
        '600 - 250 = 350 (ошибка: было 450)',
        '3 * 12 = 36 карандашей',
        '(130 + 270) - 80 = 320'
      ],
      test: ['Частное', '6', 'Нет', ':', '5', 'a * b', '100', 'Равны', '20 см', '60']
    }

    const gradeStr = `${params.grade} класс`
    return {
      id: 'dummy-id',
      subject: params.subject as Subject,
      grade: gradeStr,
      topic: params.topic,
      assignments,
      test,
      answers,
      pdfBase64: ''
    }
  }
}

const RUSSIAN_SYSTEM_PROMPT = `
Ты — методист по русскому языку для 1–4 классов (ФГОС). Объясняй тему чётко, нейтрально, без "дети" и "на уроке". Используй только терминологию начальной школы.

Формат вывода строго:
ASSIGNMENTS (8 заданий) → TEST (10 вопросов A/B/C) → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.

ASSIGNMENTS — ровно 8 заданий по текущей теме. Требования:
- 1 задание = 1 действие.
- Анализируй формулировку темы и подбирай такие типы заданий, которые лучше всего тренируют именно эту орфограмму/правило/умение.
- Возможные форматы:
  • "вставь пропущенные буквы/знаки";
  • "разбей слова на группы по признаку";
  • "найди и исправь ошибку";
  • "дополни слово/предложение";
  • "составь предложение по схеме или опорным словам";
  • "объясни коротко (1 предложением), почему так пишется слово/знак" — не усложняй.
- Не обязательно использовать все форматы сразу — выбирай несколько, которые лучше подходят под тему и уровень класса.
- Нельзя начинать задание словом "Пример:".
- Формулировки заданий могут быть разными:
  • "Выполни задание:";
  • "Вставь/впиши/дополни...";
  • "Найди и исправь ошибку...";
  • "Выбери правильный вариант...";
  • "Определи, в каком варианте...".

TEST — 10 коротких вопросов по теме, каждый в формате A/B/C:
- 1 вопрос = 1 маленькая проверка правила или умения;
- у каждого вопроса ровно 3 варианта ответов (A, B, C), один правильный;
- без терминологии средней школы.

ANSWERS_ASSIGNMENTS — ответы к 8 заданиям, только по сути, без пересказа условий.
ANSWERS_TEST — 10 букв (A/B/C) или однозначные ответы, строго по порядку вопросов.

Запрещено:
- темы 5+ класса;
- выдуманные правила;
- подпункты (а), (б) и т.п.;
- слишком лёгкие или слишком сложные задания;
- нелепые примеры;
- изменение структуры блоков.

Перед выводом проверяй:
- корректность формулировок и правил;
- соответствие уровню класса;
- совпадение количества заданий и ответов (8 и 10).

Ответь ТОЛЬКО ОДНИМ JSON-объектом без комментариев, пояснений и markdown.
Не используй json, или любой другой markdown.
Не оставляй запятые после последнего элемента массива или объекта.
`.trim();

const MATH_SYSTEM_PROMPT = `
Ты — методист по математике для 1–4 классов (ФГОС). Дай точные определения и правила простым языком. Проверяй вычисления, ошибки недопустимы.

Строгий формат вывода:
ASSIGNMENTS (8 заданий) → TEST (10 вопросов A/B/C) → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.

ASSIGNMENTS — 8 заданий по текущей теме. Требования:
- 1 задание = 1 действие.
- Используй только числа и приёмы из программы 1–4 класса (без отрицательных чисел и дробей, если их нет в теме начальной школы).
- Анализируй формулировку темы и подбирай такие типы заданий, которые лучше всего помогают отработать именно эту тему.
- Задания должны быть разнообразными по формату, но не обязаны включать все виды сразу. Возможные форматы:
  • реши пример / вычисли значение;
  • найди и исправь ошибку;
  • дополни выражение (пропуск числа или знака);
  • составь выражение по краткому условию;
  • простая текстовая мини-задача (1 действие);
  • упорядочи числа / найди большее или меньшее;
  • очень коротко объясни (1 фразой), почему верен ответ/сравнение (не усложняй).
- Формулировки заданий допускают вариативность:
  • "Вычисли:";
  • "Посчитай, сколько будет...";
  • "Определи значение выражения...";
  • "Заполни пропуск...";
  • "Найди и исправь ошибку...";
  • "Составь выражение по условию...";
  • "Выбери правильный вариант...".
- В сумме должно быть ровно 8 заданий.

TEST — 10 вопросов в формате A/B/C по этой же теме:
- 1 вопрос = 1 простая проверка отдельного умения.
- У каждого вопроса 3 варианта ответа: A, B, C. Один правильный.
- Формулировки вопросов можно чередовать:
  • "Вычисли и выбери правильный ответ:";
  • "Какой из вариантов верный?";
  • "Где записано верное равенство/неравенство?";
  • "Чему равно значение выражения...?".

ANSWERS_ASSIGNMENTS — только результаты/краткие ответы к 8 заданиям, без пересказа условий.
ANSWERS_TEST — 10 ответов (обычно буквы A/B/C или числовые значения, если это предусмотрено вопросом), строго по порядку вопросов.

Запрещено:
- отрицательные числа и дроби, если они не входят в программу начальной школы;
- задачи с несколькими действиями в одном задании;
- подпункты;
- нелепые ситуации;
- изменение структуры блоков.

Перед выводом сверяй:
- все вычисления (без ошибок),
- корректность формата заданий,
- что в ASSIGNMENTS ровно 8 заданий,
- что в TEST ровно 10 вопросов и ответы соответствуют.

Ответь ТОЛЬКО ОДНИМ JSON-объектом без комментариев, пояснений и markdown.
Не используй json, или любой другой markdown.
Не оставляй запятые после последнего элемента массива или объекта.
`.trim();

const RUSSIAN_VALIDATOR_PROMPT = `
Ты — валидатор русского языка 1–4 классов. Проверяешь ГОТОВЫЙ рабочий лист.

Формат, который должен быть у ответа генератора:
ASSIGNMENTS (8 заданий) → TEST (10 вопросов A/B/C) → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.

Проверяй:

1) Общая корректность
- Нет тем и терминов 5+ класса.
- Нет выдуманных правил.
- Формулировки заданий и вопросов понятны для младших школьников.

2) Блок ASSIGNMENTS
- Ровно 8 заданий.
- Каждое задание про одно действие (1 задача = 1 цель, без многоходовок и подпунктов).
- Задания соответствуют заявленной теме листа.
- Форматы заданий разнообразны (понимание, применение, ошибки, дополнение, группировка, мини-творческое и т.п.), но без усложнения сверх уровня начальной школы.
- Нет заданий, которые начинаются словом "Пример:".
- Нет откровенно абсурдных или нелепых формулировок.

3) Блок TEST
- Ровно 10 вопросов.
- Каждый вопрос имеет формат A/B/C (3 варианта ответа).
- У каждого вопроса только один правильный вариант.
- Вопросы по той же теме, что и задания, без терминологии средней школы.

4) Блоки ANSWERS
- ANSWERS_ASSIGNMENTS: 8 ответов, каждый однозначно соответствует своему заданию по порядку.
- ANSWERS_TEST: 10 ответов, соответствуют 10 вопросам теста по порядку.
- Всего ответов: 18 (8 + 10).
- В ответах нет противоречий с правилами и условиями заданий.

5) Структура
- Все блоки присутствуют и идут строго в порядке:
  ASSIGNMENTS → TEST → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.
- Нет лишних блоков до, между или после них.

Формат вывода:
STATUS: OK
или
STATUS: FAIL
ISSUES:
- [краткое описание первой найденной проблемы]
- [если есть, вторая проблема]
`.trim();

const MATH_VALIDATOR_PROMPT = `
Ты — валидатор математики 1–4 классов. Проверяешь готовый рабочий лист.

Проверяй:
- нет тем 5+ класса, нет отрицательных чисел и дробей, если их нет в программе начальной школы;
- задания: ровно 8, 1 действие в каждом, корректные числа, задания разнообразны по формату (вычисление, применение, поиск ошибки, дополнение, мини-задачи и т.п.), нет многоходовых задач;
- тест: 10 вопросов, формат A/B/C, у каждого 3 варианта, один правильный;
- ответы: корректные, без вычислительных ошибок, всего 18 (8 + 10), соответствуют заданиям и вопросам по порядку;
- структура блоков строго соблюдена: ASSIGNMENTS → TEST → ANSWERS_ASSIGNMENTS → ANSWERS_TEST.

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

function extractWorksheetJsonFromResponse(response: any): WorksheetJson {
  const output = response.output?.[0];
  const content = output?.content?.[0];

  if (content && 'json' in content && content.json) {
    // API уже вернул структурированный JSON
    return content.json as WorksheetJson;
  }

  if (content && 'text' in content && content.text?.value) {
    let raw = content.text.value.trim();

    // на случай, если модель добавила комментарий — вырезаем только JSON по { ... }
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
    }

    if (!raw) {
      console.error('[GEN] Empty JSON string in response');
      throw new Error('Empty AI JSON response');
    }

    try {
      return JSON.parse(raw) as WorksheetJson;
    } catch (e) {
      console.error('[GEN] Failed to parse WorksheetJson from text', { rawSnippet: raw });
      throw e;
    }
  }

  // Fallback: check output_text
  if ('output_text' in response && typeof response.output_text === 'string' && response.output_text) {
    let raw = response.output_text.trim();
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      raw = raw.slice(firstBrace, lastBrace + 1);
      if (raw) {
        try {
          return JSON.parse(raw) as WorksheetJson;
        } catch (e) {
           console.error('[GEN] Failed to parse WorksheetJson from output_text', { rawSnippet: raw });
           throw e;
        }
      }
    }
  }

  console.error('[GEN] No json/text content in AI response', { response });
  throw new Error('AI response did not contain JSON content');
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
                  required: ['index','type','text'],
                  additionalProperties: false
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
                      required: ['A','B','C'],
                      additionalProperties: false
                    }
                  },
                  required: ['index','question','options'],
                  additionalProperties: false
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
          max_output_tokens: 600
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

Включи в вывод все обязательные разделы (ASSIGNMENTS, TEST, ANSWERS_ASSIGNMENTS, ANSWERS_TEST).`

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
            max_output_tokens: 6000,
            text: {
              format: {
                type: 'json_schema',
                name: 'worksheet_json',
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
                        required: ['index','type','text'],
                        additionalProperties: false
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
                            required: ['A','B','C'],
                            additionalProperties: false
                          }
                        },
                        required: ['index','question','options'],
                        additionalProperties: false
                      }
                    },
                    answers: {
                      type: 'object',
                      properties: {
                        assignments: { type: 'array', items: { type: 'string' } },
                        test: { type: 'array', items: { type: 'string', enum: ['A','B','C'] } }
                      },
                      required: ['assignments','test'],
                      additionalProperties: false
                    }
                  },
                  required: ['assignments','test','answers'],
                  additionalProperties: false
                }
              }
            }
          })
        )
        console.log('[Generator Response]', JSON.stringify(completion, null, 2))
      } catch (error) {
        console.error('[УчиОн] OpenAI API Error:', error)
        throw error
      }

      let worksheetText = ''
      {
        worksheetJson = extractWorksheetJsonFromResponse(completion)
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
    const assignmentsText = extractSection('ASSIGNMENTS:', 'TEST:')
    const testText = extractSection('TEST:', 'ANSWERS_ASSIGNMENTS:')
    const answersAssignText = extractSection('ANSWERS_ASSIGNMENTS:', 'ANSWERS_TEST:')
    const answersTestText = extractSection('ANSWERS_TEST:', null)

    // Parse Assignments
    const assignments: Assignment[] = assignmentsText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 8) // Ensure exactly 8
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
    const safeAssignments = assignments.slice(0, 8)
    while (safeAssignments.length < 8) {
      safeAssignments.push({ title: `Задание ${safeAssignments.length + 1}`, text: '...' })
    }

    const safeTest = test.slice(0, 10)
    
    return {
      id: '',
      subject: params.subject as Subject,
      grade: `${params.grade} класс`,
      topic: topic || params.topic,
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

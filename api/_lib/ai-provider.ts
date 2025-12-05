import type { Worksheet, Subject, Conspect, BloomTask, TestQuestion } from '../../shared/types'
import { z } from 'zod'
import OpenAI from 'openai'
import { generatePrompt, SYSTEM_PROMPT } from './prompt.js'
import { AIResponseSchema } from './schema.js'
import type { GeneratePayload } from '../../shared/types'

export type GenerateParams = {
  subject: string
  grade: number
  topic: string
}

export interface AIProvider {
  generateWorksheet(params: GenerateParams): Promise<Worksheet>
}

class DummyProvider implements AIProvider {
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] DummyProvider.generateWorksheet called', params)
    const conspect: Conspect = {
      lessonTitle: params.topic,
      goal: 'Понять тему и уметь применять правила на практике на уровне начальной школы.',
      introduction: 'Сегодня разберём тему и научимся применять знания шаг за шагом.',
      steps: [
        { title: 'Что это', text: 'Это действие или правило, которое мы изучаем сегодня. Например, сложение помогает узнать общее количество.' },
        { title: 'Почему важно', text: 'Если не знать это правило, можно допустить ошибку в расчётах или письме.' },
        { title: 'Как применять', text: 'Внимательно прочитай задание, вспомни правило и используй его. Например: 2 + 2 = 4.' }
      ],
      miniPractice: 'Реши пример по шагам и проверь себя.',
      analysisExample: 'Найдите ошибку в решении и объясните почему это ошибка.',
      miniConclusion: 'Сделаем вывод и закрепим главное правило.'
    }
    const bloomTasks: BloomTask[] = [
      { level: 1, title: 'Знание', task: 'Ответь одним числом: 7+5=' },
      { level: 2, title: 'Понимание', task: 'Объясни, почему 12−4=8.' },
      { level: 3, title: 'Применение', task: 'Реши: 16+9 и 20−7.' },
      { level: 4, title: 'Анализ', task: 'Найди лишнее и объясни: 10, 12, 13, 14.' },
      { level: 5, title: 'Синтез', task: 'Придумай свой пример на тему и реши его.' }
    ]
    const test: TestQuestion[] = [
      { type: 'single', question: 'Чему равно 9+6?', options: ['12', '14', '15', '16'], answer: 2 },
      { type: 'single', question: 'Выбери правило для сложения двузначных чисел', options: ['Складываем десятки и единицы отдельно', 'Вычитаем десятки', 'Умножаем на 2', 'Делим пополам'], answer: 0 },
      { type: 'multi_or_task', question: 'Выбери верные равенства', options: ['12+8=20', '25−5=21', '30−15=15', '9+4=13'], answers: [0,2,3] },
      { type: 'multi_or_task', question: 'Реши примеры: 18−9, 7+6', options: ['Ответы: 9 и 13'], answers: [0] },
      { type: 'open', question: 'Напиши свой пример на сложение и его решение' }
    ]
    const gradeStr = `${params.grade} класс`
    return {
      id: '',
      subject: params.subject as Subject,
      grade: gradeStr,
      topic: params.topic,
      conspect,
      bloomTasks,
      test,
      pdfBase64: ''
    }
  }
}

 

class OpenAIProvider implements AIProvider {
  private client: OpenAI
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params)
    const prompt = generatePrompt(params as GeneratePayload)
    let completion
    try {
      completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt }
        ]
      })
    } catch (error) {
      console.error('[УчиОн] OpenAI API Error:', error)
      throw error
    }
    const content = completion.choices?.[0]?.message?.content?.trim() ?? ''
    if (!content || !(content.startsWith('{') && content.endsWith('}'))) {
      throw new Error('AI_ERROR')
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('AI_ERROR')
    }
    const result = AIResponseSchema.safeParse(parsed)
    if (!result.success) {
      console.error('Validation error:', result.error)
      throw new Error('AI_ERROR')
    }
    const gradeStr = `${params.grade} класс`
    const ai = result.data
    const bloomTasks: BloomTask[] = ai.bloomTasks.map(t => ({
      level: t.level as 1 | 2 | 3 | 4 | 5,
      title: t.title,
      task: t.task,
    }))
    const test: TestQuestion[] = ai.test.map(q => {
      if (q.type === 'single') {
        return { type: 'single', question: q.question, options: q.options, answer: q.answer }
      } else if (q.type === 'multi_or_task') {
        return { type: 'multi_or_task', question: q.question, options: q.options, answers: q.answers }
      }
      return { type: 'open', question: q.question }
    })
    const conspect: Conspect = {
      lessonTitle: ai.conspect.lessonTitle,
      goal: ai.conspect.goal,
      introduction: ai.conspect.introduction,
      steps: ai.conspect.steps.map(s => ({ title: s.title, text: s.text })),
      miniPractice: ai.conspect.miniPractice,
      analysisExample: ai.conspect.analysisExample,
      miniConclusion: ai.conspect.miniConclusion,
    }
    return {
      id: '',
      subject: params.subject as Subject,
      grade: gradeStr,
      topic: params.topic,
      conspect,
      bloomTasks,
      test,
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

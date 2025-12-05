import type { Worksheet, Subject, TestQuestion } from '../../shared/types'
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
    
    const summary = 'Деление — это одна из основных операций в математике, как сложение, вычитание и умножение. Оно помогает нам разделить что-то на равные части. Представь, что у тебя есть 12 конфет, и ты хочешь поровну разделить их между тремя друзьями. Вот тут-то и приходит на помощь деление! Когда мы делим, мы используем три главных числа: Делимое (число, которое делим), Делитель (число, на которое делим) и Частное (результат). Знак деления выглядит так: : или /. Например, 12 : 3 = 4. Это значит, что каждый друг получит по 4 конфеты.'

    const examples = [
      '10 : 2 = 5 (10 яблок разложили по 2 в каждую тарелку, получилось 5 тарелок)',
      '15 : 3 = 5 (15 рублей раздали трем детям поровну, каждому по 5 рублей)',
      '8 : 4 = 2 (8 кусочков пиццы разделили на 4 человека)'
    ]

    const tasks = [
      'Решите примеры: 12 : 2, 18 : 3, 20 : 4.',
      'Объясните своими словами, что такое "делимое".',
      'В классе 24 ученика. Их нужно разделить на 4 команды. Сколько учеников будет в каждой команде?',
      'Сравните (поставьте знак >,< или =): 10 : 2 ... 15 : 3.'
    ]

    const test: TestQuestion[] = [
      { question: 'Как называется число, которое мы делим?', options: ['Делимое', 'Делитель', 'Частное'], answer: 'Делимое' },
      { question: 'Сколько будет 18 : 2?', options: ['6', '9', '8'], answer: '9' },
      { question: 'Какой знак используется для деления?', options: ['+', '-', ':'], answer: ':' },
      { question: 'Если разделить 20 на 5, что получится?', options: ['4', '5', '10'], answer: '4' },
      { question: 'В каком примере ответ 3?', options: ['10 : 2', '9 : 3', '8 : 4'], answer: '9 : 3' }
    ]

    const gradeStr = `${params.grade} класс`
    return {
      id: 'dummy-id',
      subject: params.subject as Subject,
      grade: gradeStr,
      topic: params.topic,
      goal: 'научится понимать смысл действия деления, называть компоненты деления и выполнять простые вычисления.',
      summary,
      examples,
      tasks,
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
    
    return {
      id: '',
      subject: params.subject as Subject,
      grade: gradeStr,
      topic: params.topic,
      goal: ai.goal,
      summary: ai.summary,
      examples: ai.examples,
      tasks: ai.tasks,
      test: ai.test,
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

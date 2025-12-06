import type { Worksheet, Subject, TestQuestion, Assignment, WorksheetAnswers } from '../../shared/types'
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
    
    const summary = 'Деление — это одна из основных операций в математике, которая помогает нам разделить что-то на равные части. Представь, что у тебя есть 12 конфет, и ты хочешь угостить трех друзей. Чтобы никто не обиделся, нужно раздать конфеты поровну. Вот тут-то и помогает деление!\n\nКогда мы делим, мы используем три главных числа. Первое — Делимое: это самое большое число, которое мы собираемся делить (в нашем случае это 12 конфет). Второе — Делитель: это число, на которое мы делим (3 друга). Третье — Частное: это результат, сколько достанется каждому (по 4 конфеты). Записывается это так: 12 : 3 = 4.\n\nДеление — это действие, обратное умножению. Чтобы проверить, правильно ли ты разделил, можно умножить частное на делитель. Если получится делимое, значит, всё верно! Например, 4 * 3 = 12. Отлично, ошибок нет!'

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
      topic: ai.topic || params.topic,
      summary: ai.summary,
      cheatsheet: ai.cheatsheet,
      assignments: ai.assignments,
      test: ai.test,
      answers: ai.answers,
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

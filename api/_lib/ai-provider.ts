import type { Worksheet } from '../../shared/types'
import { z } from 'zod'
import OpenAI from 'openai'
import { generatePrompt } from './prompt.ts'
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
    const summary = `Тема урока: ${params.topic}. Материал подходит для ${params.grade} класса по предмету ${params.subject}.`
    const tasks = [
      { type: 'вычисления', text: 'Выполните примеры: 12+7, 25-9, 34+12.' },
      { type: 'текстовая задача', text: 'У Маши было 23 яблока, она дала подруге 7. Сколько осталось?' },
      { type: 'логика', text: 'Продолжите последовательность: 2, 4, 6, 8, ...' }
    ]
    const questions = [
      'Что означает тема урока?',
      'Какие шаги нужны для решения задачи?',
      'Какие правила применяются при вычислениях?'
    ]
    return { summary, tasks, questions }
  }
}

const WorksheetSchema = z.object({
  summary: z.string().min(1),
  tasks: z.array(z.object({ type: z.string().min(1), text: z.string().min(1) })).min(3).max(5),
  questions: z.array(z.string().min(1)).min(3).max(5)
})

class OpenAIProvider implements AIProvider {
  private client: OpenAI
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    const prompt = generatePrompt(params as GeneratePayload)
    const completion = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Ты — методист начальной школы. Отвечай строго в формате JSON. Без комментариев, без Markdown.' },
        { role: 'user', content: prompt }
      ]
    })
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
    const result = WorksheetSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error('AI_ERROR')
    }
    return result.data as Worksheet
  }
}

export function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER
  if (provider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (key && key.length > 0) {
      return new OpenAIProvider(key)
    }
  }
  return new DummyProvider()
}

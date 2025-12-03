import type { Worksheet } from '../../shared/types'

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

export function getAIProvider(): AIProvider {
  return new DummyProvider()
}

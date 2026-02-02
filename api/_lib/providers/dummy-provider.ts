import type { Worksheet, Subject, TestQuestion, Assignment, WorksheetAnswers, PresentationStructure } from '../../../shared/types.js'
import { getTaskCounts } from '../generation/prompts.js'
import type { AIProvider, GenerateParams, GeneratePresentationParams, RegenerateTaskParams, RegenerateTaskResult } from '../ai-provider.js'

// =============================================================================
// DummyProvider - for development without API
// =============================================================================

export class DummyProvider implements AIProvider {
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] DummyProvider.generateWorksheet called', params)

    const format = params.format || 'test_and_open'
    const variantIndex = params.variantIndex ?? 0
    const { openTasks, testQuestions } = getTaskCounts(format, variantIndex)

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

  async generatePresentation(params: GeneratePresentationParams, onProgress?: (percent: number) => void): Promise<PresentationStructure> {
    console.log('[УчиОн] DummyProvider.generatePresentation called', params)
    onProgress?.(10)

    const targetSlides = params.slideCount || 18
    const middleSlides: PresentationStructure['slides'] = []
    const slideTypes = ['content', 'twoColumn', 'table', 'example', 'formula', 'diagram', 'chart', 'practice'] as const
    for (let i = 0; i < targetSlides - 2; i++) {
      const slideType = slideTypes[i % slideTypes.length]
      const base = {
        title: `Слайд ${i + 2}: ${slideType} — "${params.topic}"`,
        content: [
          `Пункт 1 по теме "${params.topic}" для ${params.grade} класса`,
          `Пункт 2 с демо-содержимым`,
          `Пункт 3 с дополнительной информацией`,
          `Пункт 4 — расширенный материал`,
        ],
      }
      if (slideType === 'twoColumn') {
        middleSlides.push({ ...base, type: 'twoColumn', leftColumn: ['Левый 1', 'Левый 2', 'Левый 3'], rightColumn: ['Правый 1', 'Правый 2', 'Правый 3'] })
      } else if (slideType === 'table') {
        middleSlides.push({ ...base, type: 'table', tableData: { headers: ['Понятие', 'Определение', 'Пример'], rows: [['Демо A', 'Описание A', 'Пример A'], ['Демо B', 'Описание B', 'Пример B'], ['Демо C', 'Описание C', 'Пример C']] } })
      } else if (slideType === 'chart') {
        middleSlides.push({ ...base, type: 'chart', chartData: { labels: ['Янв', 'Фев', 'Мар', 'Апр'], values: [10, 25, 15, 30] } })
      } else {
        middleSlides.push({ ...base, type: slideType })
      }
    }

    onProgress?.(70)

    const structure: PresentationStructure = {
      title: `${params.topic} — ${params.grade} класс`,
      slides: [
        {
          type: 'title',
          title: `${params.topic}`,
          content: [`${params.grade} класс`, `Предмет: ${params.subject}`],
        },
        ...middleSlides,
        {
          type: 'conclusion',
          title: 'Итоги',
          content: [
            `Мы изучили тему "${params.topic}"`,
            'Закрепили основные понятия',
            'Рассмотрели примеры',
            'Готовы к практическим заданиям',
          ],
        },
      ],
    }

    onProgress?.(90)
    return structure
  }
}

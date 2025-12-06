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

const MAIN_SYSTEM_PROMPT = `Ты — методист начальной школы и автор рабочих листов для учеников 1–4 классов по ФГОС.
Твоя задача — генерировать рабочий лист строго в структуре, соответствующей UI сервиса УчиОн, без отклонений, ошибок, сложных тем или нерелевантной теории.

📌 ОБЩИЕ ПРАВИЛА

— Ты не имеешь права придумывать неверные факты, искажать школьную теорию или использовать материал, не относящийся к указанному классу.
— Все примеры, задания и тесты должны соответствовать ФГОС НОО.
— Язык — простой, детский, доброжелательный.
— Никакой лишней теории, никакой «воды».
— Не использовать определения или правила старших классов.
— Не использовать слишком большие числа для 1–2 классов.
— Строго придерживайся структуры блоков, так как она рендерится в интерфейсе.

📌 СТРУКТУРА РАБОЧЕГО ЛИСТА (ГЕНЕРИРУЕШЬ СТРОГО В ЭТОМ ПОРЯДКЕ)
1. Тема урока

— Тема должна быть записана в Верхнем регистре, без точки.
— Без подзаголовков, только сама тема.

2. Краткий конспект

— 7–10 предложений.
— Привести примеры с объяснениями
— Ясное объяснение темы для ученика.
— Формулировки должны соответствовать школьной программе.
— Никаких ошибок в вычислениях или определениях.

3. Шпаргалка

— 3–6 коротких пунктов.
— Это подсказки-опоры: формулы, алгоритмы, правила, основные понятия.
— Только то, что действительно актуально для указанной темы и класса.

4. Задания

Сгенерируй ровно 4 задания, каждое на отдельной строке.

Типы заданий:

задание на понимание правила или определения,

задание на применение (решение задачи или упражнения),

задание на исправление ошибки / дополнение / вставку пропущенных элементов,

задание творческое или практическое, подходящее уровню ученика.

Требования:
— никаких слишком сложных операций;
— всё строго по теме;
— задания должны быть разнообразными;
— не допускается некорректная формулировка или абсурд.

5. Мини-тест

— Ровно 5 вопросов.
— Каждый вопрос должен иметь варианты A, B, C, записанные строго в формате:

A) вариант
B) вариант
C) вариант

— Варианты должны быть уникальными, не повторяться.
— Ровно один правильный ответ.
— Формулировки должны соответствовать уровню ученика.

6. Оценка урока

Запиши три пункта:
— Все понял
— Было немного сложно
— Нужна помощь

Ничего больше в этот блок не добавляй.

7. Заметки

Просто напиши заголовок «Заметки».
Без текста внутри.

8. Ответы

Генерируй два столбца:

Задания:

…

…

…

…

Мини-тест:

(правильная буква)

(правильная буква)

(правильная буква)

(правильная буква)

(правильная буква)

Строго проверяй, что ответы корректны.

📌 ВНУТРЕННЯЯ ПРОВЕРКА (Chain of Thought — скрытая)

Перед выводом результата обязательно:

проверяешь соответствие темы уровню класса;

проверяешь, что конспект верный и не содержит ошибок;

проверяешь, что шпаргалка корректна;

проверяешь, что задания выполнимы, разнообразны и корректны;

проверяешь, что мини-тест составлен правильно;

проверяешь, что ответы однозначны и точны.

Пользователю выводишь ТОЛЬКО готовый рабочий лист, без рассуждений.`

class OpenAIProvider implements AIProvider {
  private client: OpenAI
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }
  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params)
    
    const userPrompt = `Создай рабочий лист по теме: «${params.topic}». Предмет: ${params.subject}. Класс: ${params.grade}.`
    
    let completion
    try {
      completion = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.4,
        max_tokens: 4000,
        messages: [
          { role: 'system', content: MAIN_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ]
      })
    } catch (error) {
      console.error('[УчиОн] OpenAI API Error:', error)
      throw error
    }

    const content = completion.choices?.[0]?.message?.content?.trim() ?? ''
    if (!content) {
      throw new Error('AI_ERROR')
    }

    return this.parseWorksheetText(content, params)
  }

  private parseWorksheetText(text: string, params: GenerateParams): Worksheet {
    // Simple parser based on headers
    // Expected headers: 
    // 1. Тема урока
    // 2. Краткий конспект
    // 3. Шпаргалка
    // 4. Задания
    // 5. Мини-тест
    // 6. Оценка урока
    // 7. Заметки
    // 8. Ответы

    const extractSection = (header: string, nextHeader: string | null): string => {
      const regex = nextHeader 
        ? new RegExp(`${header}[\\s\\S]*?(?=${nextHeader})`, 'i')
        : new RegExp(`${header}[\\s\\S]*`, 'i')
      
      const match = text.match(regex)
      if (!match) return ''
      
      // Remove the header itself
      return match[0].replace(new RegExp(`^.*?${header}\\s*`, 'i'), '').trim()
    }

    const topic = extractSection('1\\. Тема урока', '2\\. Краткий конспект').replace(/\.$/, '') || params.topic
    const summary = extractSection('2\\. Краткий конспект', '3\\. Шпаргалка')
    const cheatsheetText = extractSection('3\\. Шпаргалка', '4\\. Задания')
    const assignmentsText = extractSection('4\\. Задания', '5\\. Мини-тест')
    const testText = extractSection('5\\. Мини-тест', '6\\. Оценка урока')
    // 6. Оценка урока and 7. Заметки are ignored as they are static in UI or not stored
    const answersText = extractSection('8\\. Ответы', null)

    // Parse Cheatsheet (split by newline, remove empty or bullets)
    const cheatsheet = cheatsheetText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.match(/^(3\.|Шпаргалка)/i)) // clean up if needed
      .map(l => l.replace(/^[-•*]\s*/, '')) // remove bullets

    // Parse Assignments
    const assignments: Assignment[] = assignmentsText.split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
      .slice(0, 4) // Ensure exactly 4
      .map((text, i) => ({
        title: `Задание ${i + 1}`,
        text: text.replace(/^\d+\.\s*/, '')
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
        currentQuestion = { question: line.replace(/^\d+\.\s*/, '') }
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
    // Expected: Задания: ... Мини-тест: ...
    // Simple split by keywords
    let answersAssignments: string[] = []
    let answersTest: string[] = []

    if (answersText) {
      const parts = answersText.split(/Мини-тест:/i)
      const assignPart = parts[0]?.replace(/Задания:/i, '').trim() || ''
      const testPart = parts[1]?.trim() || ''

      answersAssignments = assignPart.split('\n').map(l => l.trim()).filter(l => l).map(l => l.replace(/^\d+\.\s*/, ''))
      answersTest = testPart.split('\n').map(l => l.trim()).filter(l => l)
      
      // Try to map test answers to options if they are just letters (A, B, C)
      // Or leave them as text. The existing interface expects string[] for answers.test
      // But `TestQuestion` has `answer` field which is the full text usually.
      // Let's update `test` array with correct answers if possible.
      test.forEach((q, i) => {
        if (answersTest[i]) {
          // If answer is "A" or "A)", map to option text
          const letterMatch = answersTest[i].match(/^([A-C])\)?/i)
          if (letterMatch) {
            const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65
            if (q.options[idx]) {
              q.answer = q.options[idx] // Set full text answer
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
    // Ensure 5 questions
    
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

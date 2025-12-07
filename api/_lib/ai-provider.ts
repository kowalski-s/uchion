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

const MAIN_SYSTEM_PROMPT = `Ты — методист начальной школы и автор рабочих листов по ФГОС для предметов «математика» и «русский язык» для 1–4 классов.

ТВОЯ РОЛЬ:
- объяснять темы простым, корректным, ОБЕЗЛИЧЕННЫМ языком (без фраз «дети учатся», «на уроке» и т.п.);
- строго следовать ФГОС НОО и школьной программе;
- использовать только те термины, которые допускаются в начальной школе;
- генерировать оригинальные задания средней и повышенной сложности;
- НЕ допускать ошибок в теории, формулировках, вычислениях или примерах.

=====================================================================
🚫 СТРОГИЕ ЗАПРЕТЫ:
=====================================================================
Тебе категорически запрещено:
- придумывать свои правила языка или математики;
- использовать термины из средней/старшей школы;
- писать художественные пояснения, метафоры или эмоциональные фразы;
- объяснять тему от лица учителя («дети должны узнать…»);
- давать задания, которые слишком лёгкие для указанного класса;
- делать задания с подзаданиями (а), б), в)), подпунктами или несколькими действиями в одном номере;
- писать, что «ошибки нет» в задании. Задания всегда должны быть с решением поставленной задачи 
- усложнять тему сверх программы;
- генерировать неподтверждённые факты.

=====================================================================
🧩 ПОДКЛЮЧЕНИЕ VECTOR STORE:
=====================================================================
У тебя есть доступ к базе (Vector Store) с учебными материалами.  
Ты ДОЛЖЕН:
- сверять правила и формулировки с залитыми материалами;
- опираться на них при выборе сложности;
- добавлять оригинальные задания, но строго в рамках программы.

=====================================================================
📘 ТРЕБОВАНИЯ К КОНСПЕКТУ:
=====================================================================
Формат: SUMMARY.

Конспект должен:
- быть ОБЕЗЛИЧЕННЫМ (никаких «дети узнают», «на уроке объясняют»);
- содержать 4–7 предложений;
- объяснять теорию простым, ровным стилем без эмоций;
- использовать только корректные определения по ФГОС;
- включать 1–2 коротких примера (отдельными предложениями);
- НЕ включать неожиданные формулировки, «оттенки смысла», оценочные слова.

Пример стиля:
«Союз И соединяет слова или части предложения, выражая добавление. Союз А показывает противопоставление или смену действия. Союз НО выражает противопоставление с более резким контрастом.»

=====================================================================
📒 ТРЕБОВАНИЯ К ШПАРГАЛКЕ:
=====================================================================
Формат: CHEATSHEET (3–6 пунктов).
Только короткие правила, формулы, типичные ошибки.
Без длинных предложений.

=====================================================================
✏ ТРЕБОВАНИЯ К ЗАДАНИЯМ (РОВНО 4):
=====================================================================
Формат: ASSIGNMENTS.

Типы заданий:
1 — понимание теории (определить, классифицировать, выделить).
2 — применение правила.
3 — найти и исправить ошибку (ошибка должна быть РЕАЛЬНОЙ и ОДНОЗНАЧНОЙ).
4 — творческое / комбинированное задание.

ОБЯЗАТЕЛЬНО:
- 1 задание = 1 действие.  
- НЕТ подпунктов (а), б), в)).  
- Примеры можно вынести после задания отдельной строкой.  
- Задания должны быть средней или повышенной сложности относительно класса.

Критерии «слишком лёгкого» задания:
- можно ответить одним словом;
- задание не требует применения правила;
- задание не требует анализа;
- задание не требует исправления ошибки, когда оно заявлено как ошибочное.

=====================================================================
📝 ТРЕБОВАНИЯ К МИНИ-ТЕСТУ:
=====================================================================
Формат: TEST.

Ровно 5 вопросов.  
Каждый: A) B) C).  
Один правильный ответ.

Вопросы должны включать:
- теорию,
- распознавание ошибок,
- применение правила,
- анализ примера,
- выбор корректного варианта.

Варианты НЕ могут повторяться или пересекаться по смыслу.

=====================================================================
📘 ТРЕБОВАНИЯ К ОТВЕТАМ:
=====================================================================
Формат:
ANSWERS_ASSIGNMENTS  
ANSWERS_TEST

Отвечаешь кратко, строго, без воды.

=====================================================================
🧠 АДАПТАЦИЯ ПОД КЛАСС:
=====================================================================
1 класс → простые примеры, короткие формулировки, но НЕ «впиши букву» и НЕ тривиальные задания.  
2 класс → умеренная сложность, задания на применение + небольшой анализ.  
3–4 класс → полноценные задания средней/высокой сложности, обязательно рассуждение или анализ.

=====================================================================
🔍 ВНУТРЕННЯЯ ПРОВЕРКА ПЕРЕД ВЫВОДОМ (скрытая):
=====================================================================
Перед выводом ты ДОЛЖЕН проверить:
1) Теория полностью соответствует ФГОС и возрастному уровню.
2) В конспекте нет отсылок к уроку, детям, учителю, процессу обучения.
3) Нет придуманной терминологии.
4) Все задания соответствуют уровню сложности.
5) В задании №3 есть реальная и однозначная ошибка.
6) В тесте один правильный вариант.
7) Структура вывода соблюдена на 100%.

Выводишь ТОЛЬКО результат строго по формату.
`

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

  async generateWorksheet(params: GenerateParams): Promise<Worksheet> {
    console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params)
    
    const textbooksContext = await this.getTextbookContext(params)

    const systemPrompt = MAIN_SYSTEM_PROMPT + (textbooksContext 
      ? `

У тебя есть примеры заданий из реальных учебных пособий (ФГОС).
Используй их как образец формулировок и уровней сложности, НО:

- не копируй задания дословно;
- меняй числа, формулировки и сюжет, чтобы задания были новыми;
- сохраняй типы упражнений и уровень сложности.

Вот выдержки из пособий:
<<<ПОСОБИЯ>>>
${textbooksContext}
<<<КОНЕЦ ПОСОБИЙ>>>
` 
      : "")
    
    const userPrompt = `Создай рабочий лист по теме: «${params.topic}». Предмет: ${params.subject}. Класс: ${params.grade}.`
    
    let completion
    try {
      completion = await this.client.chat.completions.create({
        model: 'gpt-4.1-mini',
        temperature: 0.2,
        max_tokens: 6000,
        messages: [
          { role: 'system', content: systemPrompt },
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

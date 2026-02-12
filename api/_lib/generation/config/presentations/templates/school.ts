import { z } from 'zod'
import type { PresentationTemplateConfig, SlideLayoutConfig, TemplateColors } from './types.js'

// =============================================================================
// School Template
// =============================================================================
// Classic school aesthetic: cream/slate/sage backgrounds, gold accents,
// white cards with double-border frames. Universal for all grades.

const schoolColors: TemplateColors = {
  primary: '5C6878',   // navy (decorative)
  secondary: 'F5F0EA', // cream background
  accent: 'C9A96E',    // gold
  text: '2D3436',      // dark text
  lightGray: 'E8E2D9',
  white: 'FFFFFF',
  muted: '6B7B8D',
}

// Extra colors used in the school generator
export const SCHOOL_EXTRA_COLORS = {
  cream: 'F5F0EA',
  slate: '8B9DAE',
  sage: 'B8C4B8',
  gold: 'C9A96E',
  dustyRose: 'C4909A',
  navy: '5C6878',
  khaki: 'D4C5A9',
}

// -----------------------------------------------------------------------------
// Slide Schemas
// -----------------------------------------------------------------------------

const titleSlideSchema = z.object({
  category: z.string().describe('Subject name (e.g. "Математика")'),
  title: z.string().min(3).max(100).describe('Main title'),
  subtitle: z.string().max(150).optional().describe('Short description'),
  footer: z.string().max(80).optional().describe('Grade + year'),
})

const titleSlide: SlideLayoutConfig<z.infer<typeof titleSlideSchema>> = {
  type: 'title',
  name: 'Титульный слайд',
  description: 'Кремовый фон, белая карточка с золотой двойной рамкой, декоративные элементы',
  schema: titleSlideSchema,
  example: {
    category: 'Математика',
    title: 'Дроби и их свойства',
    subtitle: 'Обыкновенные дроби для 5 класса',
    footer: '5 класс - 2024/2025 учебный год',
  },
  aiInstruction: `Создай титульный слайд:
- category: название предмета (например "Математика")
- title: чёткий, информативный заголовок темы (3-100 символов)
- subtitle: краткое пояснение (необязательно)
- footer: класс и учебный год`,
}

const contentsItemSchema = z.object({
  num: z.string().regex(/^\d{2}$/).describe('Section number, e.g. "01"'),
  title: z.string().min(2).max(80),
  description: z.string().max(150).optional(),
})

const contentsSlideSchema = z.object({
  title: z.string(),
  items: z.array(contentsItemSchema).min(2).max(6),
})

const contentsSlide: SlideLayoutConfig<z.infer<typeof contentsSlideSchema>> = {
  type: 'contents',
  name: 'Содержание',
  description: 'Нумерованный список разделов на кремовом фоне',
  schema: contentsSlideSchema,
  example: {
    title: 'План урока',
    items: [
      { num: '01', title: 'Определение дроби', description: 'Что такое числитель и знаменатель' },
      { num: '02', title: 'Виды дробей', description: 'Правильные и неправильные дроби' },
      { num: '03', title: 'Сравнение дробей', description: 'Как определить, какая дробь больше' },
    ],
  },
  aiInstruction: `Создай содержание презентации:
- title: "План урока" или "Содержание"
- items: 3-5 разделов, каждый с:
  - num: двузначный номер ("01", "02"...)
  - title: краткое название раздела
  - description: пояснение (необязательно)`,
}

const cardSchema = z.object({
  title: z.string().min(2).max(50),
  text: z.string().min(5).max(200),
})

const twoColumnSchema = z.object({
  type: z.literal('twoColumn'),
  sectionNum: z.string().regex(/^\d{2}$/).optional(),
  sectionTitle: z.string().min(3).max(100),
  sectionSubtitle: z.string().max(100).optional(),
  contentTitle: z.string().min(3).max(80).optional(),
  contentText: z.string().max(400).optional(),
  cards: z.array(cardSchema).min(1).max(4).optional(),
})

const twoColumnSlide: SlideLayoutConfig<z.infer<typeof twoColumnSchema>> = {
  type: 'twoColumn',
  name: 'Две колонки',
  description: 'Левая панель (серо-голубая) с заголовком, правая с карточками на белом фоне',
  schema: twoColumnSchema,
  example: {
    type: 'twoColumn',
    sectionNum: '01',
    sectionTitle: 'Определение дроби',
    sectionSubtitle: 'Основные понятия',
    contentTitle: 'Что такое дробь?',
    contentText: 'Дробь — это число, которое представляет часть целого. Записывается в виде a/b, где a — числитель, b — знаменатель.',
    cards: [
      { title: 'Числитель', text: 'Показывает, сколько частей взяли' },
      { title: 'Знаменатель', text: 'Показывает, на сколько частей разделили' },
    ],
  },
  aiInstruction: `Создай слайд с двумя колонками:
- type: "twoColumn"
- sectionNum: номер раздела ("01", "02"...)
- sectionTitle: название раздела
- sectionSubtitle: подзаголовок (необязательно)
- contentTitle: заголовок правой колонки
- contentText: основной текст (1-3 предложения)
- cards: 2-3 карточки с определениями`,
}

const legendItemSchema = z.object({
  symbol: z.string().min(1).max(20),
  label: z.string().min(3).max(100),
})

const formulaSchema = z.object({
  type: z.literal('formula'),
  sectionNum: z.string().regex(/^\d{2}$/).optional(),
  title: z.string().min(3).max(100),
  formula: z.string().min(2).max(200).describe('Formula as text'),
  description: z.string().max(300).optional(),
  items: z.array(legendItemSchema).min(2).max(6).optional(),
})

const formulaSlide: SlideLayoutConfig<z.infer<typeof formulaSchema>> = {
  type: 'formula',
  name: 'Формула / Правило',
  description: 'Формула на шалфейном фоне, белая карточка с золотыми акцентами',
  schema: formulaSchema,
  example: {
    type: 'formula',
    sectionNum: '02',
    title: 'Основное свойство дроби',
    formula: 'a/b = (a*n)/(b*n)',
    description: 'Если числитель и знаменатель умножить или разделить на одно и то же число, значение дроби не изменится.',
    items: [
      { symbol: 'a', label: 'числитель' },
      { symbol: 'b', label: 'знаменатель' },
      { symbol: 'n', label: 'множитель (n ≠ 0)' },
    ],
  },
  aiInstruction: `Создай слайд с формулой/правилом:
- type: "formula"
- sectionNum: номер раздела (необязательно)
- title: название правила или формулы
- formula: формула простым текстом (не LaTeX!)
- description: объяснение правила
- items: 2-4 элемента легенды с symbol и label`,
}

const gridCardSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().max(200).optional(),
  value: z.string().min(1).max(30),
  note: z.string().max(80).optional(),
})

const gridSchema = z.object({
  type: z.literal('grid'),
  sectionNum: z.string().regex(/^\d{2}$/).optional(),
  title: z.string().min(3).max(100),
  cards: z.array(gridCardSchema).min(2).max(4),
})

const gridSlide: SlideLayoutConfig<z.infer<typeof gridSchema>> = {
  type: 'grid',
  name: 'Сетка примеров',
  description: '2x2 карточки с примерами на серо-голубом фоне',
  schema: gridSchema,
  example: {
    type: 'grid',
    sectionNum: '03',
    title: 'Примеры дробей',
    cards: [
      { title: 'Половина', description: '1 часть из 2', value: '1/2', note: 'Самая простая' },
      { title: 'Четверть', description: '1 часть из 4', value: '1/4', note: 'Часть часа' },
      { title: 'Треть', description: '1 часть из 3', value: '1/3', note: 'Часть суток' },
      { title: 'Пятая часть', description: '1 часть из 5', value: '1/5', note: 'Двадцать минут' },
    ],
  },
  aiInstruction: `Создай слайд-сетку 2x2 с примерами:
- type: "grid"
- sectionNum: номер раздела (необязательно)
- title: заголовок
- cards: ровно 4 карточки, каждая с:
  - title: название
  - description: условие или пояснение
  - value: ключевое значение (крупно)
  - note: подпись (необязательно)`,
}

const statsSchema = z.object({
  type: z.literal('stats'),
  title: z.string().min(3).max(100),
  subtitle: z.string().max(150).optional(),
  stats: z.array(z.object({
    value: z.string().min(1).max(30),
    label: z.string().min(2).max(100),
  })).min(2).max(4),
  footer: z.string().max(200).optional(),
})

const statsSlide: SlideLayoutConfig<z.infer<typeof statsSchema>> = {
  type: 'stats',
  name: 'Важные факты',
  description: 'Карточки с ключевыми числами/фактами',
  schema: statsSchema,
  example: {
    type: 'stats',
    title: 'Интересные факты',
    subtitle: 'О дробях в жизни',
    stats: [
      { value: '1/2', label: 'самая распространённая дробь' },
      { value: '3500+', label: 'лет истории дробей' },
      { value: '∞', label: 'дробей между 0 и 1' },
    ],
    footer: 'Дроби используются повсюду: в кулинарии, музыке, спорте',
  },
  aiInstruction: `Создай слайд с фактами:
- type: "stats"
- title: заголовок
- subtitle: подзаголовок (необязательно)
- stats: 2-4 факта, каждый с value (число/символ) и label (пояснение)
- footer: общий вывод (необязательно)`,
}

const practiceSchema = z.object({
  type: z.literal('practice'),
  sectionNum: z.string().regex(/^\d{2}$/).optional(),
  title: z.string().min(3).max(100),
  taskTitle: z.string().min(2).max(50).optional(),
  taskText: z.string().min(10).max(500),
  solutionTitle: z.string().max(50).optional(),
  solutionText: z.string().max(500).optional(),
  answer: z.string().min(1).max(50),
  answerNote: z.string().max(100).optional(),
})

const practiceSlide: SlideLayoutConfig<z.infer<typeof practiceSchema>> = {
  type: 'practice',
  name: 'Задание',
  description: 'Задание с решением на шалфейном фоне, розовый акцент',
  schema: practiceSchema,
  example: {
    type: 'practice',
    sectionNum: '04',
    title: 'Решим вместе',
    taskTitle: 'Задача',
    taskText: 'Сократите дробь 12/18.',
    solutionTitle: 'Решение:',
    solutionText: '12/18 = (12÷6)/(18÷6) = 2/3',
    answer: '2/3',
    answerNote: 'НОД(12,18) = 6',
  },
  aiInstruction: `Создай слайд с заданием:
- type: "practice"
- sectionNum: номер раздела (необязательно)
- title: "Решим вместе" или аналогичный заголовок
- taskTitle: "Задача" (необязательно)
- taskText: условие задачи
- solutionTitle: "Решение:" (необязательно)
- solutionText: пошаговое решение
- answer: ответ
- answerNote: пояснение к ответу (необязательно)`,
}

const endSlideSchema = z.object({
  thankYou: z.string(),
  title: z.string(),
  contactInfo: z.string().max(300).optional(),
})

const endSlide: SlideLayoutConfig<z.infer<typeof endSlideSchema>> = {
  type: 'end',
  name: 'Финальный слайд',
  description: 'Финал на кремовом фоне с золотой рамкой',
  schema: endSlideSchema,
  example: {
    thankYou: 'СПАСИБО ЗА ВНИМАНИЕ!',
    title: 'Вопросы?',
    contactInfo: 'Учитель: Иванова М.А.\n5 класс',
  },
  aiInstruction: `Создай финальный слайд:
- thankYou: "СПАСИБО ЗА ВНИМАНИЕ!" или "ПОДВЕДЁМ ИТОГИ!"
- title: "Вопросы?"
- contactInfo: данные учителя через \\n`,
}

// =============================================================================
// Template Export
// =============================================================================

export const schoolTemplate: PresentationTemplateConfig = {
  metadata: {
    id: 'school',
    name: 'Школьный',
    description: 'Классический школьный стиль: тёплые кремовые тона, золотые акценты, уютная атмосфера',
    version: '1.0.0',
    tags: ['school', 'classic', 'universal', 'warm'],
  },

  theme: {
    colors: schoolColors,
    typography: {
      headingFont: 'Georgia',
      bodyFont: 'Arial',
    },
  },

  themeVariants: {
    default: schoolColors,
  },

  slides: [
    titleSlide,
    contentsSlide,
    twoColumnSlide,
    formulaSlide,
    gridSlide,
    statsSlide,
    practiceSlide,
    endSlide,
  ],

  defaultSequence: ['title', 'contents', 'twoColumn', 'formula', 'grid', 'practice', 'end'],

  constraints: {
    minSlides: 5,
    maxSlides: 20,
    requiredSlides: ['title', 'end'],
  },
}

import { z } from 'zod'
import type { PresentationTemplateConfig, SlideLayoutConfig, TemplateColors } from './types.js'

// =============================================================================
// Kids Template
// =============================================================================
// Colorful, playful style for elementary school (grades 1-4).
// Warm cream background, floating decorations, white rounded cards, teal accent.

const kidsColors: TemplateColors = {
  primary: '4ECDC4',   // teal (accent primary)
  secondary: 'FDF6E3', // warm cream background
  accent: '4ECDC4',    // teal
  text: '2D3436',      // dark charcoal
  lightGray: 'F0F0F0',
  white: 'FFFFFF',
  muted: '94A3B8',
}

// Extra colors used in the kids generator
export const KIDS_EXTRA_COLORS = {
  coral: 'FF6B8A',
  purple: 'A78BFA',
  yellow: 'FBBF24',
  teal: '4ECDC4',
  cream: 'FDF6E3',
}

// -----------------------------------------------------------------------------
// Slide Schemas
// -----------------------------------------------------------------------------

const titleSlideSchema = z.object({
  category: z.string().describe('Subject name (e.g. "Математика")'),
  title: z.string().min(3).max(100).describe('Main title, short and fun'),
  subtitle: z.string().max(150).optional().describe('Short fun description'),
  footer: z.string().max(80).optional().describe('Grade + year'),
})

const titleSlide: SlideLayoutConfig<z.infer<typeof titleSlideSchema>> = {
  type: 'title',
  name: 'Титульный слайд',
  description: 'Яркий фон с декоративными элементами, крупный заголовок, весёлый стиль',
  schema: titleSlideSchema,
  example: {
    category: 'Математика',
    title: 'Учимся складывать!',
    subtitle: 'Весёлые задачки для 2 класса',
    footer: '2 класс - 2024/2025 учебный год',
  },
  aiInstruction: `Создай титульный слайд для начальной школы:
- category: название предмета (например "Математика")
- title: весёлый, яркий заголовок темы (3-100 символов, используй восклицательные знаки)
- subtitle: интересное пояснение для детей (необязательно)
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
  description: 'Нумерованный список разделов в ярких карточках',
  schema: contentsSlideSchema,
  example: {
    title: 'Что мы узнаем?',
    items: [
      { num: '01', title: 'Что такое сложение?', description: 'Считаем вместе!' },
      { num: '02', title: 'Примеры', description: 'Решаем задачки' },
      { num: '03', title: 'Игра', description: 'Проверяем знания' },
    ],
  },
  aiInstruction: `Создай содержание презентации для детей:
- title: "Что мы узнаем?" или аналогичный весёлый заголовок
- items: 3-5 разделов, каждый с:
  - num: двузначный номер ("01", "02"...)
  - title: простое название раздела (понятное ребёнку)
  - description: короткое весёлое пояснение`,
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
  description: 'Левая цветная панель с заголовком, правая с карточками',
  schema: twoColumnSchema,
  example: {
    type: 'twoColumn',
    sectionNum: '01',
    sectionTitle: 'Что такое сложение?',
    sectionSubtitle: 'Давайте разберёмся!',
    contentTitle: 'Сложение - это...',
    contentText: 'Когда мы складываем, мы объединяем предметы вместе. Например, 2 яблока + 3 яблока = 5 яблок!',
    cards: [
      { title: 'Плюс (+)', text: 'Знак, который говорит: складывай!' },
      { title: 'Сумма', text: 'Результат сложения' },
    ],
  },
  aiInstruction: `Создай слайд с двумя колонками для детей:
- type: "twoColumn"
- sectionNum: номер раздела ("01", "02"...)
- sectionTitle: простое название раздела
- sectionSubtitle: подзаголовок (необязательно)
- contentTitle: вопрос или заголовок на правой панели
- contentText: простое объяснение (1-3 предложения, понятные ребёнку)
- cards: 2-3 карточки с определениями (простые слова!)`,
}

const legendItemSchema = z.object({
  symbol: z.string().min(1).max(20),
  label: z.string().min(3).max(100),
})

const formulaSchema = z.object({
  type: z.literal('formula'),
  sectionNum: z.string().regex(/^\d{2}$/).optional(),
  title: z.string().min(3).max(100),
  formula: z.string().min(2).max(200).describe('Simple formula as text'),
  description: z.string().max(300).optional(),
  items: z.array(legendItemSchema).min(2).max(6).optional(),
})

const formulaSlide: SlideLayoutConfig<z.infer<typeof formulaSchema>> = {
  type: 'formula',
  name: 'Формула / Правило',
  description: 'Крупная формула или правило в яркой рамке',
  schema: formulaSchema,
  example: {
    type: 'formula',
    sectionNum: '02',
    title: 'Правило сложения',
    formula: '2 + 3 = 5',
    description: 'Мы складываем два числа и получаем сумму!',
    items: [
      { symbol: '2', label: 'первое слагаемое' },
      { symbol: '3', label: 'второе слагаемое' },
      { symbol: '5', label: 'сумма (результат)' },
    ],
  },
  aiInstruction: `Создай слайд с формулой/правилом для детей:
- type: "formula"
- sectionNum: номер раздела (необязательно)
- title: название правила
- formula: формула простым текстом (например "2 + 3 = 5")
- description: весёлое объяснение для ребёнка
- items: 2-4 элемента легенды с symbol и label (простые слова)`,
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
  description: '2x2 сетка ярких карточек с примерами',
  schema: gridSchema,
  example: {
    type: 'grid',
    sectionNum: '03',
    title: 'Решаем примеры!',
    cards: [
      { title: 'Пример 1', description: '3 + 2', value: '5', note: 'Пять!' },
      { title: 'Пример 2', description: '4 + 1', value: '5', note: 'Тоже пять!' },
      { title: 'Пример 3', description: '1 + 6', value: '7', note: 'Семь!' },
      { title: 'Пример 4', description: '5 + 5', value: '10', note: 'Десять!' },
    ],
  },
  aiInstruction: `Создай слайд с сеткой 2x2 примеров для детей:
- type: "grid"
- sectionNum: номер раздела (необязательно)
- title: весёлый заголовок (например "Решаем примеры!")
- cards: ровно 4 карточки, каждая с:
  - title: название примера
  - description: условие задачи (простое!)
  - value: крупный ответ
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
  name: 'Интересные факты',
  description: 'Яркие карточки с числами и фактами',
  schema: statsSchema,
  example: {
    type: 'stats',
    title: 'А вы знали?',
    subtitle: 'Интересные факты о числах',
    stats: [
      { value: '10', label: 'пальцев на руках - идеально для счёта!' },
      { value: '7', label: 'дней в неделе' },
      { value: '12', label: 'месяцев в году' },
    ],
    footer: 'Числа окружают нас повсюду!',
  },
  aiInstruction: `Создай слайд с интересными фактами для детей:
- type: "stats"
- title: "А вы знали?" или аналогичный заголовок
- subtitle: подзаголовок (необязательно)
- stats: 2-4 факта, каждый с value (число) и label (пояснение, понятное ребёнку)
- footer: вывод или интересный факт`,
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
  description: 'Карточка с заданием и ответом в яркой рамке',
  schema: practiceSchema,
  example: {
    type: 'practice',
    sectionNum: '04',
    title: 'Попробуй сам!',
    taskTitle: 'Задачка',
    taskText: 'У Маши было 3 яблока. Папа дал ей ещё 4 яблока. Сколько яблок стало у Маши?',
    solutionTitle: 'Решение:',
    solutionText: '3 + 4 = 7',
    answer: '7 яблок',
    answerNote: 'Молодец!',
  },
  aiInstruction: `Создай слайд с заданием для детей:
- type: "practice"
- sectionNum: номер раздела (необязательно)
- title: "Попробуй сам!" или аналогичный весёлый заголовок
- taskTitle: "Задачка" (необязательно)
- taskText: условие задачи, простое и с примерами из жизни ребёнка
- solutionTitle: "Решение:" (необязательно)
- solutionText: пошаговое решение
- answer: ответ крупным шрифтом
- answerNote: "Молодец!" или похвала (необязательно)`,
}

const endSlideSchema = z.object({
  thankYou: z.string(),
  title: z.string(),
  contactInfo: z.string().max(300).optional(),
})

const endSlide: SlideLayoutConfig<z.infer<typeof endSlideSchema>> = {
  type: 'end',
  name: 'Финальный слайд',
  description: 'Яркий финал с благодарностью',
  schema: endSlideSchema,
  example: {
    thankYou: 'МОЛОДЦЫ!',
    title: 'Вопросы?',
    contactInfo: 'Учитель: Иванова М.А.\n2 класс',
  },
  aiInstruction: `Создай финальный слайд:
- thankYou: "МОЛОДЦЫ!" или "ОТЛИЧНО ПОРАБОТАЛИ!"
- title: "Вопросы?"
- contactInfo: данные учителя через \\n`,
}

// =============================================================================
// Template Export
// =============================================================================

export const kidsTemplate: PresentationTemplateConfig = {
  metadata: {
    id: 'kids',
    name: 'Для детей',
    description: 'Яркий, красочный стиль для начальной школы: тёплые цвета, декоративные элементы, крупный шрифт',
    version: '1.0.0',
    tags: ['kids', 'elementary', 'colorful', 'fun'],
  },

  theme: {
    colors: kidsColors,
    typography: {
      headingFont: 'Arial',
      bodyFont: 'Arial',
    },
  },

  themeVariants: {
    default: kidsColors,
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

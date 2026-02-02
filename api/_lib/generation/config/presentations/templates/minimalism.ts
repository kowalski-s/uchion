import { z } from 'zod'
import type { PresentationTemplateConfig, SlideLayoutConfig, TemplateColors } from './types.js'

// =============================================================================
// Minimalism Template
// =============================================================================
// Warm, dark+beige minimal style for school presentations.
// Renderer: pptxgenjs (see docs/presexample/minimalism.md)

// -----------------------------------------------------------------------------
// Theme Variants
// -----------------------------------------------------------------------------

const warmColors: TemplateColors = {
  primary: '1A1A1A',
  secondary: 'F5F3F0',
  accent: '8B7355',
  text: '2D2D2D',
  lightGray: 'E8E4DF',
  white: 'FFFFFF',
  muted: '6B6B6B',
}

const coolColors: TemplateColors = {
  primary: '1E2761',
  secondary: 'F8FAFC',
  accent: '3B82F6',
  text: '1E293B',
  lightGray: 'E2E8F0',
  white: 'FFFFFF',
  muted: '64748B',
}

const darkColors: TemplateColors = {
  primary: '0F0F0F',
  secondary: '1A1A1A',
  accent: '10B981',
  text: 'F1F1F1',
  lightGray: '2D2D2D',
  white: 'FFFFFF',
  muted: '9CA3AF',
}

// -----------------------------------------------------------------------------
// Slide Schemas (aligned with pptxgenjs renderer data structures)
// -----------------------------------------------------------------------------

// --- Title Slide ---
const titleSlideSchema = z.object({
  category: z.string().describe('Subject name, uppercase (e.g. "МАТЕМАТИКА")'),
  title: z.string().min(3).max(100).describe('Main presentation title'),
  subtitle: z.string().max(150).optional().describe('Short description'),
  footer: z.string().max(80).optional().describe('Grade + year (e.g. "9 класс - 2024/2025 учебный год")'),
})

const titleSlide: SlideLayoutConfig<z.infer<typeof titleSlideSchema>> = {
  type: 'title',
  name: 'Титульный слайд',
  description: 'Темный фон, название предмета, заголовок, подзаголовок, класс/год',
  schema: titleSlideSchema,
  example: {
    category: 'МАТЕМАТИКА',
    title: 'Теория вероятностей',
    subtitle: 'Основы и применение',
    footer: '9 класс - 2024/2025 учебный год',
  },
  aiInstruction: `Создай титульный слайд:
- category: название предмета БОЛЬШИМИ БУКВАМИ с пробелами (например "М А Т Е М А Т И К А")
- title: яркий, короткий заголовок темы (3-100 символов)
- subtitle: пояснение к теме (необязательно)
- footer: класс и учебный год`,
}

// --- Contents Slide ---
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
  description: 'Нумерованный список разделов с описаниями, справа блок с количеством',
  schema: contentsSlideSchema,
  example: {
    title: 'Содержание',
    items: [
      { num: '01', title: 'Введение', description: 'Основные понятия теории вероятностей' },
      { num: '02', title: 'Формулы', description: 'Классическое определение вероятности' },
      { num: '03', title: 'Примеры', description: 'Решение типовых задач' },
      { num: '04', title: 'Практика', description: 'Самостоятельная работа' },
    ],
  },
  aiInstruction: `Создай содержание презентации:
- title: "Содержание"
- items: 3-6 разделов, каждый с:
  - num: двузначный номер ("01", "02"...)
  - title: короткое название раздела
  - description: что будет рассмотрено (необязательно)`,
}

// --- Two Column Slide (Section Intro) ---
const cardSchema = z.object({
  title: z.string().min(2).max(50),
  text: z.string().min(5).max(200),
})

const twoColumnSchema = z.object({
  type: z.literal('twoColumn'),
  sectionNum: z.string().regex(/^\d{2}$/),
  sectionTitle: z.string().min(3).max(100),
  sectionSubtitle: z.string().max(100).optional(),
  contentTitle: z.string().min(3).max(80).optional(),
  contentText: z.string().max(400).optional(),
  cards: z.array(cardSchema).min(1).max(4).optional(),
})

const twoColumnSlide: SlideLayoutConfig<z.infer<typeof twoColumnSchema>> = {
  type: 'twoColumn',
  name: 'Две колонки (ввод в раздел)',
  description: 'Левая темная панель с номером и заголовком раздела, правая светлая с текстом и карточками определений',
  schema: twoColumnSchema,
  example: {
    type: 'twoColumn',
    sectionNum: '01',
    sectionTitle: 'Введение в теорию вероятностей',
    sectionSubtitle: 'Основные понятия и определения',
    contentTitle: 'Что такое вероятность?',
    contentText: 'Вероятность - это численная мера возможности наступления случайного события. Значение вероятности находится в диапазоне от 0 до 1.',
    cards: [
      { title: 'Событие', text: 'Результат опыта или эксперимента' },
      { title: 'Исход', text: 'Элементарный результат опыта' },
      { title: 'Опыт', text: 'Действие с неопределённым результатом' },
    ],
  },
  aiInstruction: `Создай слайд с двумя колонками:
- type: "twoColumn"
- sectionNum: номер раздела ("01", "02"...)
- sectionTitle: название раздела для темной панели слева
- sectionSubtitle: мелкий текст внизу левой панели (необязательно)
- contentTitle: заголовок-вопрос на правой панели
- contentText: объяснительный текст (1-3 предложения)
- cards: 2-4 карточки определений с title и text (с акцентной левой границей)`,
}

// --- Formula Slide ---
const legendItemSchema = z.object({
  symbol: z.string().min(1).max(20),
  label: z.string().min(3).max(100),
})

const formulaSchema = z.object({
  type: z.literal('formula'),
  sectionNum: z.string().regex(/^\d{2}$/).optional(),
  title: z.string().min(3).max(100),
  formula: z.string().min(2).max(200).describe('Formula as plain text, e.g. "P(A) = m / n"'),
  description: z.string().max(300).optional(),
  items: z.array(legendItemSchema).min(2).max(6).optional(),
})

const formulaSlide: SlideLayoutConfig<z.infer<typeof formulaSchema>> = {
  type: 'formula',
  name: 'Формула',
  description: 'Крупная формула на бежевом фоне, описание, легенда переменных внизу на темном фоне',
  schema: formulaSchema,
  example: {
    type: 'formula',
    sectionNum: '02',
    title: 'Формула вероятности',
    formula: 'P(A) = m / n',
    description: 'где m - число благоприятных исходов, n - общее число исходов',
    items: [
      { symbol: 'P(A)', label: 'вероятность события A' },
      { symbol: 'm', label: 'благоприятные исходы' },
      { symbol: 'n', label: 'все возможные исходы' },
    ],
  },
  aiInstruction: `Создай слайд с формулой:
- type: "formula"
- sectionNum: номер раздела (необязательно)
- title: название формулы/закона
- formula: формула как текст (например "P(A) = m / n", "S = a * h / 2")
- description: пояснение к формуле
- items: 2-6 элементов легенды, каждый с symbol и label`,
}

// --- Grid Slide (2x2 Examples) ---
const gridCardSchema = z.object({
  title: z.string().min(2).max(60),
  description: z.string().max(200).optional(),
  value: z.string().min(1).max(30).describe('Large number/result to display'),
  note: z.string().max(80).optional().describe('Small formula reference or note'),
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
  description: '2x2 сетка карточек с примерами: название, описание, крупный результат, формула',
  schema: gridSchema,
  example: {
    type: 'grid',
    sectionNum: '03',
    title: 'Примеры задач',
    cards: [
      { title: 'Монета', description: 'Вероятность выпадения орла', value: '1/2', note: 'P = m/n' },
      { title: 'Кубик', description: 'Вероятность выпадения шестёрки', value: '1/6', note: 'P = m/n' },
      { title: 'Карты', description: 'Вероятность вытянуть туза', value: '1/13', note: 'P = m/n' },
      { title: 'Шары', description: 'Вероятность вытянуть красный', value: '3/10', note: 'P = m/n' },
    ],
  },
  aiInstruction: `Создай слайд с сеткой 2x2 примеров:
- type: "grid"
- sectionNum: номер раздела (необязательно)
- title: общий заголовок (например "Примеры задач")
- cards: ровно 4 карточки, каждая с:
  - title: название примера
  - description: условие задачи
  - value: крупный результат/ответ (например "1/2", "36 см2")
  - note: ссылка на формулу (необязательно)`,
}

// --- Stats Slide ---
const statItemSchema = z.object({
  value: z.string().min(1).max(30),
  label: z.string().min(2).max(100),
})

const statsSchema = z.object({
  type: z.literal('stats'),
  title: z.string().min(3).max(100),
  subtitle: z.string().max(150).optional(),
  stats: z.array(statItemSchema).min(2).max(4),
  footer: z.string().max(200).optional(),
})

const statsSlide: SlideLayoutConfig<z.infer<typeof statsSchema>> = {
  type: 'stats',
  name: 'Статистика',
  description: 'Темный фон, крупные числа/статистика в карточках',
  schema: statsSchema,
  example: {
    type: 'stats',
    title: 'Вероятность в жизни',
    subtitle: 'Интересные факты',
    stats: [
      { value: '50%', label: 'Вероятность выпадения орла' },
      { value: '1/49', label: 'Шанс угадать число в лотерее' },
      { value: '1/400', label: 'Вероятность удара молнии' },
    ],
    footer: 'Теория вероятностей помогает оценивать шансы событий',
  },
  aiInstruction: `Создай слайд со статистикой/фактами:
- type: "stats"
- title: заголовок
- subtitle: подзаголовок (необязательно)
- stats: 2-4 числовых факта, каждый с value (крупное число) и label (пояснение)
- footer: вывод или интересный факт (необязательно)`,
}

// --- Practice Slide ---
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
  name: 'Практическое задание',
  description: 'Слева карточка задачи с решением, справа темная панель с ответом',
  schema: practiceSchema,
  example: {
    type: 'practice',
    sectionNum: '04',
    title: 'Практическое задание',
    taskTitle: 'Задача',
    taskText: 'В коробке 6 красных, 4 синих и 5 зелёных шаров. Найдите вероятность того, что случайно выбранный шар окажется синим.',
    solutionTitle: 'Решение:',
    solutionText: 'n = 6 + 4 + 5 = 15 (всего)\nm = 4 (синих)\nP = 4/15 \u2248 0,27',
    answer: '4/15',
    answerNote: 'или \u2248 0,27',
  },
  aiInstruction: `Создай слайд с практическим заданием:
- type: "practice"
- sectionNum: номер раздела (необязательно)
- title: "Практическое задание" или аналогичный заголовок
- taskTitle: "Задача" (необязательно)
- taskText: условие задачи (10-500 символов)
- solutionTitle: "Решение:" (необязательно)
- solutionText: пошаговое решение с переносами строк через \\n
- answer: ответ крупным шрифтом (например "4/15")
- answerNote: альтернативная запись (например "или ~0,27")`,
}

// --- End Slide ---
const endSlideSchema = z.object({
  thankYou: z.string(),
  title: z.string(),
  contactInfo: z.string().max(300).optional().describe('Teacher name, class, school on separate lines'),
})

const endSlide: SlideLayoutConfig<z.infer<typeof endSlideSchema>> = {
  type: 'end',
  name: 'Финальный слайд',
  description: 'Темный фон, "Спасибо за внимание", "Вопросы?", данные учителя',
  schema: endSlideSchema,
  example: {
    thankYou: 'СПАСИБО ЗА ВНИМАНИЕ',
    title: 'Вопросы?',
    contactInfo: 'Учитель: Иванова М.А.\nКласс: 9Б\nШкола №1234',
  },
  aiInstruction: `Создай финальный слайд:
- thankYou: "СПАСИБО ЗА ВНИМАНИЕ"
- title: "Вопросы?"
- contactInfo: данные учителя через \\n (имя, класс, школа) - заполняется из профиля пользователя`,
}

// =============================================================================
// Template Export
// =============================================================================

export const minimalismTemplate: PresentationTemplateConfig = {
  metadata: {
    id: 'minimalism',
    name: 'Минимализм',
    description: 'Тёплый минималистичный стиль: темные заголовки, бежевый контент, акцентный золотисто-коричневый',
    version: '1.0.0',
    tags: ['minimal', 'warm', 'school', 'professional'],
  },

  theme: {
    colors: warmColors,
    typography: {
      headingFont: 'Georgia',
      bodyFont: 'Arial',
    },
  },

  themeVariants: {
    warm: warmColors,
    cool: coolColors,
    dark: darkColors,
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

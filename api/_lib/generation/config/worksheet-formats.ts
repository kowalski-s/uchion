import { z } from 'zod'

// =============================================================================
// Worksheet Format Types
// =============================================================================

/**
 * Идентификатор формата рабочего листа
 */
export type WorksheetFormatId = 'open_only' | 'test_only' | 'test_and_open'

/**
 * Вариант количества заданий
 */
export interface FormatVariant {
  /** Количество открытых заданий (с развёрнутым ответом) */
  openTasks: number
  /** Количество тестовых вопросов */
  testQuestions: number
  /** Стоимость в генерациях */
  generations: number
  /** Метка для UI (например, "+Профи") */
  label?: string
}

/**
 * Конфигурация формата рабочего листа
 */
export interface WorksheetFormatConfig {
  id: WorksheetFormatId
  name: string
  description: string
  variants: FormatVariant[]
}

// =============================================================================
// Worksheet Formats Configuration
// =============================================================================

export const worksheetFormats: Record<WorksheetFormatId, WorksheetFormatConfig> = {
  open_only: {
    id: 'open_only',
    name: 'Только задания',
    description: 'Задания с развёрнутым ответом',
    variants: [
      { openTasks: 5, testQuestions: 0, generations: 1 },
      { openTasks: 10, testQuestions: 0, generations: 2, label: '+Профи' },
      { openTasks: 15, testQuestions: 0, generations: 3, label: '+Профи' },
    ],
  },
  test_only: {
    id: 'test_only',
    name: 'Только тест',
    description: 'Тестовые вопросы с выбором ответа',
    variants: [
      { openTasks: 0, testQuestions: 10, generations: 1 },
      { openTasks: 0, testQuestions: 15, generations: 2, label: '+Профи' },
      { openTasks: 0, testQuestions: 20, generations: 3, label: '+Профи' },
    ],
  },
  test_and_open: {
    id: 'test_and_open',
    name: 'Тест + задания',
    description: 'Комбинация теста и заданий с развёрнутым ответом',
    variants: [
      { openTasks: 5, testQuestions: 10, generations: 1 },
      { openTasks: 10, testQuestions: 15, generations: 2, label: '+Профи' },
      { openTasks: 15, testQuestions: 20, generations: 3, label: '+Профи' },
    ],
  },
}

// =============================================================================
// Zod Schema
// =============================================================================

export const WorksheetFormatIdSchema = z.enum(['open_only', 'test_only', 'test_and_open'])

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Получить конфигурацию формата по ID
 */
export function getWorksheetFormat(id: WorksheetFormatId): WorksheetFormatConfig {
  const config = worksheetFormats[id]
  if (!config) {
    throw new Error(`Unknown worksheet format: ${id}`)
  }
  return config
}

/**
 * Получить все форматы
 */
export function getAllWorksheetFormats(): WorksheetFormatConfig[] {
  return Object.values(worksheetFormats)
}

/**
 * Получить вариант формата
 */
export function getFormatVariant(
  formatId: WorksheetFormatId,
  variantIndex: number
): FormatVariant | undefined {
  const format = worksheetFormats[formatId]
  return format?.variants[variantIndex]
}

/**
 * Рассчитать стоимость в генерациях
 */
export function calculateGenerationCost(
  formatId: WorksheetFormatId,
  variantIndex: number
): number {
  const variant = getFormatVariant(formatId, variantIndex)
  return variant?.generations ?? 1
}

/**
 * Проверить доступность варианта для пользователя
 */
export function isVariantAvailable(
  generationsCost: number,
  userGenerationsLeft: number
): boolean {
  return userGenerationsLeft >= generationsCost
}

/**
 * Проверить, является ли строка валидным ID формата
 */
export function isValidWorksheetFormat(id: string): id is WorksheetFormatId {
  return id in worksheetFormats
}

/**
 * Получить формат по умолчанию
 */
export function getDefaultFormat(): WorksheetFormatId {
  return 'test_and_open'
}

/**
 * Получить вариант по умолчанию
 */
export function getDefaultVariantIndex(): number {
  return 0
}

export type EducationLevel = 'elementary' | 'middle' | 'high'
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11

export interface GradeConstraints {
  allowed: string[]
  softForbidden: string[]
  limits?: Record<string, number | boolean>
}

export interface GradeConfig {
  grade: Grade
  level: EducationLevel
  topics: string[]
  constraints: GradeConstraints
  promptHint: string
}

export interface SubjectConfig {
  id: string
  name: string
  gradeRange: { from: Grade; to: Grade }
  grades: Record<number, GradeConfig>
  systemPrompt: string
}

export function getEducationLevel(grade: Grade): EducationLevel {
  if (grade <= 4) return 'elementary'
  if (grade <= 9) return 'middle'
  return 'high'
}

// =============================================================================
// Per-subject prompt config interfaces
// =============================================================================

// Re-export DifficultyLevel from difficulty.ts for convenience
// (so per-subject configs can import from types.ts alone)
export type { DifficultyLevel } from './difficulty.js'
import type { DifficultyLevel } from './difficulty.js'

export interface SubjectPromptConfig {
  /** Промпт для system message (предмет-специфичный) */
  systemPrompt: string
  /** Требования к содержанию per grade+level (текстовые фрагменты, числа и т.д.) */
  contentRequirements: (grade: number, level: DifficultyLevel) => string
  /** Подсказки по разнообразию заданий */
  diversityHints: string
}

export interface GradeTierConfig {
  grades: [number, number]
  /** Что ОБЯЗАТЕЛЬНО / что ЗАПРЕЩЕНО — идёт в system prompt */
  cognitiveContract: string
  /** Пример хорошего задания — идёт в system prompt */
  exampleTask: string
  /** ОГЭ/ЕГЭ контекст */
  examContext?: string
}

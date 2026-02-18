import { z } from 'zod'

// Per-subject difficulty prompts (config-driven)
import { getMathDifficultyPrompt } from './subjects/math/difficulty.js'
import { getAlgebraDifficultyPrompt } from './subjects/algebra/difficulty.js'
import { getGeometryDifficultyPrompt } from './subjects/geometry/difficulty.js'
import { getRussianDifficultyPrompt } from './subjects/russian/difficulty.js'

// =============================================================================
// Difficulty Level Types
// =============================================================================

export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export const DifficultySchema = z.enum(['easy', 'medium', 'hard'])

export interface DifficultyConfig {
  id: DifficultyLevel
  name: string
  nameRu: string
}

// =============================================================================
// Difficulty Configurations
// =============================================================================

export const difficultyLevels: Record<DifficultyLevel, DifficultyConfig> = {
  easy: { id: 'easy', name: 'Easy', nameRu: 'Базовый' },
  medium: { id: 'medium', name: 'Medium', nameRu: 'Средний' },
  hard: { id: 'hard', name: 'Hard', nameRu: 'Повышенный' },
}

// =============================================================================
// Generic fallback prompts (for unknown subjects)
// =============================================================================

const GENERIC_PROMPTS: Record<DifficultyLevel, string> = {
  easy: `Уровень: БАЗОВЫЙ
Требования:
- Прямое применение правил и формул без усложнений
- Простые числа и примеры
- Решение в 1-2 шага
- Однозначные формулировки без подвохов
- Задания от простых к чуть более сложным (но всё в рамках базового)`,

  medium: `Уровень: СРЕДНИЙ
Требования:
- Стандартные ситуации из учебника, но НЕ тривиальные
- Решение в 2-3 шага
- Требуется понимание темы и связь с ранее изученным материалом
- Часть заданий должна комбинировать текущую тему с темами, пройденными ранее
- Могут потребоваться промежуточные вычисления и преобразования`,

  hard: `Уровень: ПОВЫШЕННЫЙ
Требования:
- Нестандартные формулировки и контексты
- Решение в 3-5 шагов
- ОБЯЗАТЕЛЬНО комбинирование текущей темы с ранее пройденными темами и навыками
- Задания олимпиадного типа, требующие синтеза нескольких разделов
- Самые сложные задания могут включать элементы тем, идущих после текущей по программе`,
}

// =============================================================================
// Per-subject difficulty prompt registry
// =============================================================================

const SUBJECT_DIFFICULTY_GETTERS: Record<string, (grade: number, level: DifficultyLevel) => string> = {
  math: getMathDifficultyPrompt,
  algebra: getAlgebraDifficultyPrompt,
  geometry: getGeometryDifficultyPrompt,
  russian: getRussianDifficultyPrompt,
}

// =============================================================================
// Main function
// =============================================================================

export function getDifficultyPrompt(
  level: DifficultyLevel,
  subject: string,
  grade: number
): string {
  const getter = SUBJECT_DIFFICULTY_GETTERS[subject]
  if (getter) {
    const result = getter(grade, level)
    if (result) return result
  }

  return GENERIC_PROMPTS[level]
}

// =============================================================================
// Backward-compatible exports
// =============================================================================

export function getDifficulty(id: DifficultyLevel): DifficultyConfig {
  const config = difficultyLevels[id]
  if (!config) {
    throw new Error(`Unknown difficulty level: ${id}`)
  }
  return config
}

export function getAllDifficulties(): DifficultyConfig[] {
  return Object.values(difficultyLevels)
}

export function isValidDifficulty(id: string): id is DifficultyLevel {
  return id in difficultyLevels
}

export function getDefaultDifficulty(): DifficultyLevel {
  return 'medium'
}

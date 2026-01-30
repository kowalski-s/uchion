import type { TaskTypeId } from './task-types.js'

// =============================================================================
// Types
// =============================================================================

/** Распределение заданий по типам */
export interface TaskDistribution {
  type: TaskTypeId
  count: number
}

// =============================================================================
// Open Tasks Distribution (matching, fill_blank, open_question)
// =============================================================================

const OPEN_MATCHING_QUOTA: Record<number, number> = {
  5: 1,
  10: 2,
  15: 3,
}

const OPEN_FILL_BLANK_QUOTA: Record<number, number> = {
  5: 1,
  10: 2,
  15: 3,
}

/**
 * Рассчитать распределение открытых заданий по типам.
 * matching и fill_blank получают фиксированные квоты,
 * open_question — всё оставшееся.
 */
export function distributeOpenTasks(
  total: number,
  selectedTypes: TaskTypeId[]
): TaskDistribution[] {
  const openTypes = selectedTypes.filter((t) =>
    (['open_question', 'matching', 'fill_blank'] as TaskTypeId[]).includes(t)
  )

  if (openTypes.length === 0 || total === 0) return []

  let remaining = total
  const result: TaskDistribution[] = []

  // matching quota
  if (openTypes.includes('matching')) {
    const count = OPEN_MATCHING_QUOTA[total] ?? Math.max(1, Math.floor(total / 5))
    const capped = Math.min(count, remaining)
    result.push({ type: 'matching', count: capped })
    remaining -= capped
  }

  // fill_blank quota
  if (openTypes.includes('fill_blank')) {
    const count = OPEN_FILL_BLANK_QUOTA[total] ?? Math.max(1, Math.floor(total / 5))
    const capped = Math.min(count, remaining)
    result.push({ type: 'fill_blank', count: capped })
    remaining -= capped
  }

  // open_question gets the rest
  if (openTypes.includes('open_question') && remaining > 0) {
    result.push({ type: 'open_question', count: remaining })
  } else if (remaining > 0) {
    // If open_question not selected, distribute remainder equally among selected types
    const existing = result.filter((r) => r.count > 0)
    if (existing.length > 0) {
      const perType = Math.floor(remaining / existing.length)
      let leftover = remaining - perType * existing.length
      for (const entry of existing) {
        entry.count += perType
        if (leftover > 0) {
          entry.count += 1
          leftover--
        }
      }
    }
  }

  return result.filter((r) => r.count > 0)
}

// =============================================================================
// Test Tasks Distribution (single_choice, multiple_choice)
// =============================================================================

const TEST_MULTIPLE_CHOICE_QUOTA: Record<number, number> = {
  10: 3,
  15: 5,
  20: 7,
}

/**
 * Рассчитать распределение тестовых заданий по типам.
 * multiple_choice получает фиксированную квоту,
 * single_choice — всё оставшееся.
 */
export function distributeTestTasks(
  total: number,
  selectedTypes: TaskTypeId[]
): TaskDistribution[] {
  const testTypes = selectedTypes.filter((t) =>
    (['single_choice', 'multiple_choice'] as TaskTypeId[]).includes(t)
  )

  if (testTypes.length === 0 || total === 0) return []

  let remaining = total
  const result: TaskDistribution[] = []

  // multiple_choice quota
  if (testTypes.includes('multiple_choice')) {
    const count = TEST_MULTIPLE_CHOICE_QUOTA[total] ?? Math.max(1, Math.round(total * 0.3))
    const capped = Math.min(count, remaining)
    result.push({ type: 'multiple_choice', count: capped })
    remaining -= capped
  }

  // single_choice gets the rest
  if (testTypes.includes('single_choice') && remaining > 0) {
    result.push({ type: 'single_choice', count: remaining })
  } else if (remaining > 0) {
    // If single_choice not selected, give all to multiple_choice
    const mc = result.find((r) => r.type === 'multiple_choice')
    if (mc) {
      mc.count += remaining
    }
  }

  return result.filter((r) => r.count > 0)
}

// =============================================================================
// Combined Distribution
// =============================================================================

/**
 * Полное распределение заданий для формата листа.
 * Возвращает массив { type, count } для каждого выбранного типа.
 */
export function distributeAllTasks(
  openTotal: number,
  testTotal: number,
  selectedTypes: TaskTypeId[]
): TaskDistribution[] {
  const openDist = distributeOpenTasks(openTotal, selectedTypes)
  const testDist = distributeTestTasks(testTotal, selectedTypes)
  return [...testDist, ...openDist]
}

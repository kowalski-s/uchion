import { describe, it, expect } from 'vitest'
import { validateWorksheet } from '../../api/_lib/generation/validation/deterministic'

// =============================================================================
// Helpers — valid task factories
// =============================================================================

function validSingleChoice(overrides = {}) {
  return {
    type: 'single_choice' as const,
    question: 'Чему равно значение выражения 2 + 3?',
    options: ['3', '4', '5', '6'],
    correctIndex: 2,
    ...overrides,
  }
}

function validMultipleChoice(overrides = {}) {
  return {
    type: 'multiple_choice' as const,
    question: 'Какие из следующих чисел делятся на 3? (Выберите все правильные)',
    options: ['12', '17', '21', '25', '33'],
    correctIndices: [0, 2, 4],
    ...overrides,
  }
}

function validOpenQuestion(overrides = {}) {
  return {
    type: 'open_question' as const,
    question: 'Найдите периметр квадрата со стороной 5 см.',
    correctAnswer: '20',
    ...overrides,
  }
}

function validMatching(overrides = {}) {
  return {
    type: 'matching' as const,
    instruction: 'Соедините арифметическое действие с его результатом',
    leftColumn: ['2 + 3', '10 - 4', '3 × 3'],
    rightColumn: ['9', '5', '6'],
    correctPairs: [[0, 1], [1, 2], [2, 0]] as [number, number][],
    ...overrides,
  }
}

function validFillBlank(overrides = {}) {
  return {
    type: 'fill_blank' as const,
    textWithBlanks: 'Чтобы найти неизвестное слагаемое, надо из ___(1)___ вычесть известное ___(2)___.',
    blanks: [
      { position: 1, correctAnswer: 'суммы' },
      { position: 2, correctAnswer: 'слагаемое' },
    ],
    ...overrides,
  }
}

// =============================================================================
// Valid tasks — should pass
// =============================================================================

describe('validateWorksheet', () => {
  describe('valid tasks', () => {
    it('passes valid single_choice', () => {
      const result = validateWorksheet([validSingleChoice()], 'math', 3)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes valid multiple_choice', () => {
      const result = validateWorksheet([validMultipleChoice()], 'math', 5)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes valid open_question', () => {
      const result = validateWorksheet([validOpenQuestion()], 'math', 4)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes valid matching', () => {
      const result = validateWorksheet([validMatching()], 'math', 3)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes valid fill_blank', () => {
      const result = validateWorksheet([validFillBlank()], 'russian', 5)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes a mix of all valid task types', () => {
      const tasks = [
        validSingleChoice(),
        validMultipleChoice(),
        validOpenQuestion(),
        validMatching(),
        validFillBlank(),
      ]
      const result = validateWorksheet(tasks, 'math', 5)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('passes empty task list', () => {
      const result = validateWorksheet([], 'math', 1)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  // ===========================================================================
  // single_choice
  // ===========================================================================

  describe('single_choice validation', () => {
    it('error: correctIndex out of bounds (too high)', () => {
      const task = validSingleChoice({ correctIndex: 10 })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_INDEX')).toBe(true)
    })

    it('error: correctIndex negative', () => {
      const task = validSingleChoice({ correctIndex: -1 })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID' || e.code === 'INVALID_INDEX')).toBe(true)
    })

    it('error: empty option string', () => {
      const task = validSingleChoice({ options: ['3', '', '5', '6'] })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'EMPTY_FIELD' || e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: duplicate options', () => {
      const task = validSingleChoice({ options: ['5', '5', '3', '6'] })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.errors.some(e => e.code === 'DUPLICATE_OPTIONS')).toBe(true)
    })

    it('error: duplicate options case-insensitive', () => {
      const task = validSingleChoice({ options: ['Да', 'да', 'Нет', 'Может быть'] })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.errors.some(e => e.code === 'DUPLICATE_OPTIONS')).toBe(true)
    })

    it('warning: only 3 options', () => {
      const task = validSingleChoice({ options: ['3', '5', '6'], correctIndex: 1 })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.warnings.some(w => w.code === 'FEW_OPTIONS')).toBe(true)
    })

    it('error: fewer than 3 options (schema)', () => {
      const task = validSingleChoice({ options: ['Да', 'Нет'], correctIndex: 0 })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: question too short', () => {
      const task = validSingleChoice({ question: 'Да?' })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(false)
    })
  })

  // ===========================================================================
  // multiple_choice
  // ===========================================================================

  describe('multiple_choice validation', () => {
    it('error: correctIndices out of bounds', () => {
      const task = validMultipleChoice({ correctIndices: [0, 7] })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_INDEX')).toBe(true)
    })

    it('error: duplicate correctIndices', () => {
      const task = validMultipleChoice({ correctIndices: [0, 0, 2] })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.errors.some(e => e.code === 'DUPLICATE_INDICES')).toBe(true)
    })

    it('error: empty correctIndices (schema)', () => {
      const task = validMultipleChoice({ correctIndices: [] })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: only 1 correct index (schema requires min 2)', () => {
      const task = validMultipleChoice({ correctIndices: [0] })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: not exactly 5 options (schema)', () => {
      const task = validMultipleChoice({ options: ['А', 'Б', 'В', 'Г'], correctIndices: [0, 1] })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: duplicate options', () => {
      const task = validMultipleChoice({ options: ['12', '12', '21', '25', '33'] })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.errors.some(e => e.code === 'DUPLICATE_OPTIONS')).toBe(true)
    })
  })

  // ===========================================================================
  // open_question
  // ===========================================================================

  describe('open_question validation', () => {
    it('error: empty correctAnswer', () => {
      const task = validOpenQuestion({ correctAnswer: '' })
      const result = validateWorksheet([task], 'math', 4)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'EMPTY_FIELD' || e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: whitespace-only correctAnswer', () => {
      const task = validOpenQuestion({ correctAnswer: '   ' })
      const result = validateWorksheet([task], 'math', 4)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'EMPTY_FIELD')).toBe(true)
    })

    it('error: empty question', () => {
      const task = validOpenQuestion({ question: '' })
      const result = validateWorksheet([task], 'math', 4)
      expect(result.valid).toBe(false)
    })

    it('error: question too short', () => {
      const task = validOpenQuestion({ question: 'x = ?' })
      const result = validateWorksheet([task], 'math', 4)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'QUESTION_TOO_SHORT' || e.code === 'SCHEMA_INVALID')).toBe(true)
    })
  })

  // ===========================================================================
  // matching
  // ===========================================================================

  describe('matching validation', () => {
    it('error: column length mismatch', () => {
      const task = validMatching({
        leftColumn: ['A', 'B', 'C'],
        rightColumn: ['X', 'Y'],
        correctPairs: [[0, 0], [1, 1]],
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'COLUMN_LENGTH_MISMATCH')).toBe(true)
    })

    it('error: incomplete pairs', () => {
      const task = validMatching({
        correctPairs: [[0, 1]], // only 1 pair for 3 items
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INCOMPLETE_PAIRS')).toBe(true)
    })

    it('error: pair left index out of bounds', () => {
      const task = validMatching({
        correctPairs: [[0, 1], [1, 2], [5, 0]] as [number, number][],
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_PAIR_INDEX')).toBe(true)
    })

    it('error: pair right index out of bounds', () => {
      const task = validMatching({
        correctPairs: [[0, 1], [1, 9], [2, 0]] as [number, number][],
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'INVALID_PAIR_INDEX')).toBe(true)
    })

    it('error: duplicate left index in pairs', () => {
      const task = validMatching({
        correctPairs: [[0, 0], [0, 1], [2, 2]] as [number, number][],
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.errors.some(e => e.code === 'DUPLICATE_PAIRS')).toBe(true)
    })

    it('error: duplicate right index in pairs', () => {
      const task = validMatching({
        correctPairs: [[0, 0], [1, 0], [2, 2]] as [number, number][],
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.errors.some(e => e.code === 'DUPLICATE_PAIRS')).toBe(true)
    })

    it('error: duplicate items in leftColumn', () => {
      const task = validMatching({
        leftColumn: ['A', 'A', 'C'],
        correctPairs: [[0, 1], [1, 2], [2, 0]] as [number, number][],
      })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.errors.some(e => e.code === 'DUPLICATE_OPTIONS' && e.field === 'leftColumn')).toBe(true)
    })

    it('error: instruction too short (schema)', () => {
      const task = validMatching({ instruction: 'Ок' })
      const result = validateWorksheet([task], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })
  })

  // ===========================================================================
  // fill_blank
  // ===========================================================================

  describe('fill_blank validation', () => {
    it('error: marker count mismatch (more blanks than markers)', () => {
      const task = validFillBlank({
        textWithBlanks: 'Текст с одним пропуском: ___(1)___.',
        blanks: [
          { position: 1, correctAnswer: 'слово' },
          { position: 2, correctAnswer: 'другое' },
        ],
      })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'BLANK_MARKER_MISMATCH')).toBe(true)
    })

    it('error: marker count mismatch (more markers than blanks)', () => {
      const task = validFillBlank({
        textWithBlanks: 'Текст: ___(1)___ и ___(2)___.',
        blanks: [
          { position: 1, correctAnswer: 'слово' },
        ],
      })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'BLANK_MARKER_MISMATCH')).toBe(true)
    })

    it('error: blank position not found in text', () => {
      const task = validFillBlank({
        textWithBlanks: 'Текст с пропуском ___(1)___ и ещё ___(2)___.',
        blanks: [
          { position: 1, correctAnswer: 'слово' },
          { position: 5, correctAnswer: 'другое' }, // marker 5 doesn't exist
        ],
      })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_BLANK')).toBe(true)
    })

    it('error: marker without blank object', () => {
      const task = validFillBlank({
        textWithBlanks: 'Текст: ___(1)___ и ___(2)___.',
        blanks: [
          { position: 1, correctAnswer: 'слово' },
          // missing position 2
        ],
      })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'MISSING_BLANK' || e.code === 'BLANK_MARKER_MISMATCH')).toBe(true)
    })

    it('error: empty correctAnswer in blank', () => {
      const task = validFillBlank({
        textWithBlanks: 'Текст: ___(1)___.',
        blanks: [
          { position: 1, correctAnswer: '' },
        ],
      })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'EMPTY_FIELD' || e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: no markers in text at all', () => {
      const task = validFillBlank({
        textWithBlanks: 'Текст вообще без пропусков, просто предложение.',
        blanks: [
          { position: 1, correctAnswer: 'слово' },
        ],
      })
      const result = validateWorksheet([task], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'BLANK_MARKER_MISMATCH' || e.code === 'MISSING_BLANK')).toBe(true)
    })
  })

  // ===========================================================================
  // Cross-task checks
  // ===========================================================================

  describe('cross-task checks', () => {
    it('error: duplicate questions across tasks', () => {
      const q = 'Чему равно значение выражения 2 + 3?'
      const tasks = [
        validSingleChoice({ question: q }),
        validSingleChoice({ question: q }),
      ]
      const result = validateWorksheet(tasks, 'math', 3)
      expect(result.errors.some(e => e.code === 'DUPLICATE_QUESTIONS')).toBe(true)
      // Only second task gets the duplicate error
      const dupes = result.errors.filter(e => e.code === 'DUPLICATE_QUESTIONS')
      expect(dupes[0].taskIndex).toBe(1)
    })

    it('duplicate check is case-insensitive', () => {
      const tasks = [
        validOpenQuestion({ question: 'Найдите площадь квадрата.' }),
        validOpenQuestion({ question: 'найдите площадь квадрата.' }),
      ]
      const result = validateWorksheet(tasks, 'math', 4)
      expect(result.errors.some(e => e.code === 'DUPLICATE_QUESTIONS')).toBe(true)
    })

    it('no duplicate error for different questions', () => {
      const tasks = [
        validSingleChoice({ question: 'Чему равно 2 + 3?' }),
        validSingleChoice({ question: 'Чему равно 5 + 7?' }),
      ]
      const result = validateWorksheet(tasks, 'math', 3)
      expect(result.errors.filter(e => e.code === 'DUPLICATE_QUESTIONS')).toHaveLength(0)
    })

    it('error: question shorter than 10 chars', () => {
      const task = validSingleChoice({ question: 'Да или?' })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.errors.some(e => e.code === 'QUESTION_TOO_SHORT' || e.code === 'SCHEMA_INVALID')).toBe(true)
    })
  })

  // ===========================================================================
  // Math number range checks
  // ===========================================================================

  describe('math number range checks', () => {
    it('warning: number exceeds maxNumber for grade 1 (max 20)', () => {
      const task = validSingleChoice({
        question: 'Чему равно значение выражения 25 + 30?',
        options: ['45', '55', '65', '75'],
        correctIndex: 1,
      })
      const result = validateWorksheet([task], 'math', 1)
      expect(result.warnings.some(w => w.code === 'POSSIBLE_NUMBER_OVERFLOW')).toBe(true)
    })

    it('no warning: numbers within range for grade 1', () => {
      const task = validSingleChoice({
        question: 'Чему равно значение выражения 5 + 3?',
        options: ['6', '7', '8', '9'],
        correctIndex: 2,
      })
      const result = validateWorksheet([task], 'math', 1)
      expect(result.warnings.filter(w => w.code === 'POSSIBLE_NUMBER_OVERFLOW')).toHaveLength(0)
    })

    it('no warning: non-math subject ignores number limits', () => {
      const task = validSingleChoice({
        question: 'В каком году произошло событие 1000?',
        options: ['1000', '2000', '3000', '4000'],
        correctIndex: 0,
      })
      const result = validateWorksheet([task], 'russian', 1)
      expect(result.warnings.filter(w => w.code === 'POSSIBLE_NUMBER_OVERFLOW')).toHaveLength(0)
    })

    it('warning: number in options exceeds limit', () => {
      const task = validSingleChoice({
        question: 'Какой правильный ответ у задачи?',
        options: ['10', '15', '100', '5'],
        correctIndex: 0,
      })
      const result = validateWorksheet([task], 'math', 1)
      expect(result.warnings.some(w => w.code === 'POSSIBLE_NUMBER_OVERFLOW')).toBe(true)
    })

    it('warning: number in open_question answer exceeds limit', () => {
      const task = validOpenQuestion({
        question: 'Найдите результат вычисления выражения.',
        correctAnswer: '150',
      })
      const result = validateWorksheet([task], 'math', 1)
      expect(result.warnings.some(w => w.code === 'POSSIBLE_NUMBER_OVERFLOW')).toBe(true)
    })
  })

  // ===========================================================================
  // Schema validation via Zod
  // ===========================================================================

  describe('schema validation (Zod)', () => {
    it('error: missing required fields in single_choice', () => {
      const task = { type: 'single_choice' as const }
      const result = validateWorksheet([task as any], 'math', 3)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: missing required fields in matching', () => {
      const task = { type: 'matching' as const, instruction: 'Соотнеси элементы' }
      const result = validateWorksheet([task as any], 'math', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })

    it('error: missing blanks in fill_blank', () => {
      const task = { type: 'fill_blank' as const, textWithBlanks: 'Текст с пропуском ___(1)___.' }
      const result = validateWorksheet([task as any], 'russian', 5)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.code === 'SCHEMA_INVALID')).toBe(true)
    })
  })

  // ===========================================================================
  // Result structure
  // ===========================================================================

  describe('result structure', () => {
    it('returns valid=true, empty errors and warnings for valid input', () => {
      const result = validateWorksheet([validSingleChoice()], 'math', 3)
      expect(result).toHaveProperty('valid', true)
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('error objects have required fields', () => {
      const task = validSingleChoice({ correctIndex: 99 })
      const result = validateWorksheet([task], 'math', 3)
      const err = result.errors.find(e => e.code === 'INVALID_INDEX')
      expect(err).toBeDefined()
      expect(err).toHaveProperty('taskIndex', 0)
      expect(err).toHaveProperty('field')
      expect(err).toHaveProperty('message')
      expect(err).toHaveProperty('code')
    })

    it('warning objects have required fields', () => {
      const task = validSingleChoice({ options: ['3', '5', '6'], correctIndex: 1 })
      const result = validateWorksheet([task], 'math', 3)
      const warn = result.warnings.find(w => w.code === 'FEW_OPTIONS')
      expect(warn).toBeDefined()
      expect(warn).toHaveProperty('taskIndex', 0)
      expect(warn).toHaveProperty('field')
      expect(warn).toHaveProperty('message')
      expect(warn).toHaveProperty('code')
    })

    it('valid=false when any error exists', () => {
      const task = validSingleChoice({ correctIndex: 99 })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('valid=true even with warnings', () => {
      const task = validSingleChoice({ options: ['3', '5', '6'], correctIndex: 1 })
      const result = validateWorksheet([task], 'math', 3)
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })
})

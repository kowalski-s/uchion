export * from './types.js'
export * from './subjects/index.js'
export * from './task-types.js'
export * from './difficulty.js'
export * from './worksheet-formats.js'
export * from './task-distribution.js'
export { validateWorksheet, type ValidationResult, type ValidationError, type ValidationWarning } from '../validation/index.js'

import { mathConfig } from './subjects/math.js'
import { algebraConfig } from './subjects/algebra.js'
import { geometryConfig } from './subjects/geometry.js'
import { russianConfig } from './subjects/russian.js'
import type { SubjectConfig, Grade } from './types.js'

export const subjects: Record<string, SubjectConfig> = {
  math: mathConfig,
  algebra: algebraConfig,
  geometry: geometryConfig,
  russian: russianConfig,
}

export function getSubjectConfig(subjectId: string): SubjectConfig | undefined {
  return subjects[subjectId]
}

export function getGradeConfig(subjectId: string, grade: Grade) {
  const subject = subjects[subjectId]
  if (!subject) return undefined
  return subject.grades[grade]
}

export function isGradeSupported(subjectId: string, grade: Grade): boolean {
  const subject = subjects[subjectId]
  if (!subject) return false
  return grade >= subject.gradeRange.from && grade <= subject.gradeRange.to
}

export function getAvailableSubjects(): SubjectConfig[] {
  return Object.values(subjects)
}

export function getSubjectsForGrade(grade: Grade): SubjectConfig[] {
  return Object.values(subjects).filter(
    (subject) => grade >= subject.gradeRange.from && grade <= subject.gradeRange.to
  )
}

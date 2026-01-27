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

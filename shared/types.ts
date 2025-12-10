export type Subject = 'math' | 'russian'

export type AssignmentType = 'theory' | 'apply' | 'error' | 'creative'

export interface WorksheetJson {
  assignments: {
    index: number
    type: AssignmentType
    text: string
  }[]
  test: {
    index: number
    question: string
    options: {
      A: string
      B: string
      C: string
    }
  }[]
  answers: {
    assignments: string[]
    test: ('A' | 'B' | 'C')[]
  }
}

export type GeneratePayload = {
  subject: Subject
  grade: number
  topic: string
}

export type Assignment = {
  title: string
  text: string
}

export type TestQuestion = {
  question: string
  options: string[]
  answer: string
}

export type WorksheetAnswers = {
  assignments: string[]
  test: string[]
}

export interface Worksheet {
  id: string
  subject: Subject
  grade: string
  topic: string
  assignments: Assignment[]
  test: TestQuestion[]
  answers: WorksheetAnswers
  pdfBase64: string
}

export interface WorksheetWithJson extends Worksheet {
  json?: WorksheetJson
  validationStatus?: 'OK' | 'FAIL'
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AI_ERROR'
  | 'PDF_ERROR'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'

export type GenerateResponseOk = {
  status: 'ok'
  data: { worksheet: Worksheet }
}

export type GenerateResponseError = {
  status: 'error'
  message: string
  code: ApiErrorCode
}

export type GenerateResponse = GenerateResponseOk | GenerateResponseError

export interface ValidationResult {
  status: 'OK' | 'FAIL'
  issues: string[]
}

export interface ValidationIssueAnalysis {
  hasStructureErrors: boolean
  invalidAssignments: number[]
  invalidTests: number[]
}

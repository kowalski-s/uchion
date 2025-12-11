export * from './worksheet'
import type { Worksheet, WorksheetJson, Subject } from './worksheet'

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

export type PublicWorksheet = {
  id: string
  subject: Subject
  grade: string
  topic: string
  assignments: {
    text: string
  }[]
  test: {
    question: string
    options: string[]
  }[]
  answersAssignments: string[]
  answersTest: string[]
}

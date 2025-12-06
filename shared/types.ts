export type Subject = 'математика' | 'русский'

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
  summary: string
  cheatsheet: string[]
  assignments: Assignment[]
  test: TestQuestion[]
  answers: WorksheetAnswers
  pdfBase64: string
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

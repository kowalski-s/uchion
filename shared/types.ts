export type Subject = 'математика' | 'русский'

export type GeneratePayload = {
  subject: Subject
  grade: number
  topic: string
}

export type TestQuestion = {
  question: string
  options: string[]
  answer: string // Теперь это строка, а не индекс
}

export interface Worksheet {
  id: string
  subject: Subject
  grade: string
  topic: string
  goal: string
  summary: string
  examples: string[]
  tasks: string[]
  test: TestQuestion[]
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

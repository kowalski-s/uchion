export type Subject = 'математика' | 'русский'

export type GeneratePayload = {
  subject: Subject
  grade: number
  topic: string
}

export type Task = {
  type: string
  text: string
}

export type Worksheet = {
  summary: string
  tasks: Task[]
  questions: string[]
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AI_ERROR'
  | 'PDF_ERROR'
  | 'RATE_LIMIT'
  | 'SERVER_ERROR'

export type GenerateResponseOk = {
  status: 'ok'
  data: Worksheet & { pdfBase64: string | null }
}

export type GenerateResponseError = {
  status: 'error'
  message: string
  code: ApiErrorCode
}

export type GenerateResponse = GenerateResponseOk | GenerateResponseError

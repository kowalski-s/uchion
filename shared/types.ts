export type Subject = 'математика' | 'русский'

export type GeneratePayload = {
  subject: Subject
  grade: number
  topic: string
}

export interface ConspectStep {
  title: string
  text: string
}

export interface Conspect {
  lessonTitle: string
  goal: string
  introduction: string
  steps: ConspectStep[]
  miniPractice: string
  analysisExample: string
  miniConclusion: string
}

export type BloomLevel = 1 | 2 | 3 | 4 | 5

export interface BloomTask {
  level: BloomLevel
  title: string
  task: string
}

export type TestQuestionType = 'single' | 'multi_or_task' | 'open'

export interface SingleChoiceQuestion {
  type: 'single'
  question: string
  options: string[]
  answer: number
}

export interface MultiOrTaskQuestion {
  type: 'multi_or_task'
  question: string
  options: string[]
  answers: number[]
}

export interface OpenQuestion {
  type: 'open'
  question: string
}

export type TestQuestion =
  | SingleChoiceQuestion
  | MultiOrTaskQuestion
  | OpenQuestion

export interface Worksheet {
  id: string
  subject: Subject
  grade: string
  topic: string
  conspect: Conspect
  bloomTasks: BloomTask[]
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

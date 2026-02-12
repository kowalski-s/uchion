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
  | 'RATE_LIMIT_EXCEEDED'
  | 'LIMIT_EXCEEDED'
  | 'DAILY_LIMIT_EXCEEDED'
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

// Dashboard types
export interface WorksheetListItem {
  id: string
  folderId?: string | null
  title?: string | null
  subject: 'math' | 'algebra' | 'geometry' | 'russian'
  grade: number
  topic: string
  difficulty?: 'easy' | 'medium' | 'hard'
  createdAt: string
  updatedAt?: string
}

export interface UserSubscription {
  plan: 'free' | 'basic' | 'premium'
  status: 'active' | 'canceled' | 'expired' | 'trial'
  expiresAt: string | null
}

// Folder types
export interface Folder {
  id: string
  name: string
  color: string
  parentId?: string | null
  sortOrder: number
  createdAt: string
}

export interface FolderWithCount extends Folder {
  worksheetCount: number
}

// ==================== PRESENTATIONS ====================

export type PresentationThemePreset = 'professional' | 'educational' | 'minimal' | 'scientific' | 'kids'

export interface PresentationListItem {
  id: string
  title: string
  subject: 'math' | 'algebra' | 'geometry' | 'russian'
  grade: number
  topic: string
  themeType: 'preset' | 'custom'
  themePreset?: PresentationThemePreset | null
  slideCount: number
  createdAt: string
}

export type ContentElementType = 'heading' | 'definition' | 'text' | 'bullet' | 'highlight' | 'task' | 'formula'

export interface ContentElement {
  el: ContentElementType
  text: string
  number?: number  // for task: task number
}

export interface PresentationSlide {
  type: 'title' | 'content' | 'twoColumn' | 'table' | 'example' | 'formula' | 'diagram' | 'chart' | 'practice' | 'conclusion'
  title: string
  content: (string | ContentElement)[]
  tableData?: { headers: string[]; rows: string[][] }
  leftColumn?: string[]
  rightColumn?: string[]
  chartData?: { labels: string[]; values: number[] }
}

export interface PresentationStructure {
  title: string
  slides: PresentationSlide[]
}

export type GeneratePresentationPayload = {
  subject: Subject
  grade: number
  topic: string
  themeType: 'preset' | 'custom'
  themePreset?: PresentationThemePreset
  themeCustom?: string
  slideCount?: 12 | 18 | 24
}

export type GeneratePresentationResponseOk = {
  status: 'ok'
  data: {
    id: string
    title: string
    pptxBase64: string
    pdfBase64: string
    slideCount: number
    structure: PresentationStructure
  }
}

export type GeneratePresentationResponse = GeneratePresentationResponseOk | GenerateResponseError

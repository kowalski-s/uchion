import { z } from 'zod'

// --- Enums ---
export const SubjectSchema = z.enum(['math', 'russian'])
export type Subject = z.infer<typeof SubjectSchema>

export const AssignmentTypeSchema = z.enum(['theory', 'apply', 'error', 'creative'])
export type AssignmentType = z.infer<typeof AssignmentTypeSchema>

// --- Sub-components for Final Worksheet ---
export const AssignmentSchema = z.object({
  title: z.string(),
  text: z.string(),
})
export type Assignment = z.infer<typeof AssignmentSchema>

export const TestQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
})
export type TestQuestion = z.infer<typeof TestQuestionSchema>

export const WorksheetAnswersSchema = z.object({
  assignments: z.array(z.string()),
  test: z.array(z.string()),
})
export type WorksheetAnswers = z.infer<typeof WorksheetAnswersSchema>

// --- Main Worksheet Model ---
export const WorksheetSchema = z.object({
  id: z.string(),
  subject: SubjectSchema,
  grade: z.string(),
  topic: z.string(),
  assignments: z.array(AssignmentSchema),
  test: z.array(TestQuestionSchema),
  answers: WorksheetAnswersSchema,
  pdfBase64: z.string(),
})
export type Worksheet = z.infer<typeof WorksheetSchema>

// --- Generation Form Schema ---
export const GenerateSchema = z.object({
  subject: SubjectSchema,
  grade: z.number().int().min(1).max(4),
  topic: z.string().min(3).max(200),
})
export type GenerateFormValues = z.infer<typeof GenerateSchema>
export type GeneratePayload = {
  subject: Subject
  grade: number
  topic: string
}

// --- Internal/AI Types ---
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

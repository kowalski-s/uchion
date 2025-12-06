import { z } from 'zod'

export const GenerateSchema = z.object({
  subject: z.enum(['математика', 'русский']),
  grade: z.number().int().min(1).max(4),
  topic: z.string().min(3).max(200),
})

export const AssignmentSchema = z.object({
  title: z.string(),
  text: z.string(),
})

export const TestQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
})

export const AnswersSchema = z.object({
  assignments: z.array(z.string()),
  test: z.array(z.string()),
})

// Полный Worksheet
export const WorksheetSchema = z.object({
  id: z.string(),
  subject: z.enum(['математика', 'русский']),
  grade: z.string(),
  topic: z.string(),
  summary: z.string(),
  cheatsheet: z.array(z.string()),
  assignments: z.array(AssignmentSchema),
  test: z.array(TestQuestionSchema),
  answers: AnswersSchema,
  pdfBase64: z.string(),
})

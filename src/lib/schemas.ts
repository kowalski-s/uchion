import { z } from 'zod'

export const GenerateSchema = z.object({
  subject: z.enum(['математика', 'русский']),
  grade: z.number().int().min(1).max(4),
  topic: z.string().min(3).max(200),
})

export const TestQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
})

// Полный Worksheet
export const WorksheetSchema = z.object({
  id: z.string(),
  subject: z.enum(['математика', 'русский']),
  grade: z.string(),
  topic: z.string(),
  goal: z.string(),
  summary: z.string(),
  examples: z.array(z.string()),
  tasks: z.array(z.string()),
  test: z.array(TestQuestionSchema),
  pdfBase64: z.string(),
})

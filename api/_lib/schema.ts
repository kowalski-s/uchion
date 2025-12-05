import { z } from 'zod'

export const TestQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  answer: z.string(),
})

// JSON от модели (без id/subject/grade/topic/pdfBase64)
export const AIResponseSchema = z.object({
  goal: z.string(),
  summary: z.string(),
  examples: z.array(z.string()),
  tasks: z.array(z.string()),
  test: z.array(TestQuestionSchema),
})

// Полный Worksheet (используется в серверном ответе)
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

export type WorksheetFromSchema = z.infer<typeof WorksheetSchema>

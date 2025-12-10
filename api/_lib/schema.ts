import { z } from 'zod'

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

// JSON от модели (без id/subject/grade/topic/pdfBase64)
export const AIResponseSchema = z.object({
  topic: z.string().optional(), // Model might refine topic
  assignments: z.array(AssignmentSchema).length(8),
  test: z.array(TestQuestionSchema).length(10),
  answers: AnswersSchema,
})

// Полный Worksheet (используется в серверном ответе)
export const WorksheetSchema = z.object({
  id: z.string(),
  subject: z.enum(['math', 'russian']),
  grade: z.string(),
  topic: z.string(),
  assignments: z.array(AssignmentSchema).length(8),
  test: z.array(TestQuestionSchema).length(10),
  answers: AnswersSchema,
  pdfBase64: z.string(),
})

export type WorksheetFromSchema = z.infer<typeof WorksheetSchema>

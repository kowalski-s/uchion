import { z } from 'zod'

export const ConspectStepSchema = z.object({
  title: z.string(),
  text: z.string(),
})

export const ConspectSchema = z.object({
  lessonTitle: z.string(),
  goal: z.string(),
  introduction: z.string(),
  steps: z.array(ConspectStepSchema).min(3),
  miniPractice: z.string(),
  analysisExample: z.string(),
  miniConclusion: z.string(),
})

export const BloomTaskSchema = z.object({
  level: z.number().int().min(1).max(5),
  title: z.string(),
  task: z.string(),
})

export const SingleChoiceSchema = z.object({
  type: z.literal('single'),
  question: z.string(),
  options: z.array(z.string()).min(3).max(6),
  answer: z.number().int().min(0),
})

export const MultiOrTaskSchema = z.object({
  type: z.literal('multi_or_task'),
  question: z.string(),
  options: z.array(z.string()),
  answers: z.array(z.number().int().min(0)),
})

export const OpenQuestionSchema = z.object({
  type: z.literal('open'),
  question: z.string(),
})

export const TestQuestionSchema = z.union([
  SingleChoiceSchema,
  MultiOrTaskSchema,
  OpenQuestionSchema,
])

// JSON от модели (без id/subject/grade/topic/pdfBase64)
export const AIResponseSchema = z.object({
  conspect: ConspectSchema,
  bloomTasks: z.array(BloomTaskSchema).length(5),
  test: z.array(TestQuestionSchema).length(5),
})

// Полный Worksheet (используется в серверном ответе)
export const WorksheetSchema = z.object({
  id: z.string(),
  subject: z.enum(['математика', 'русский']),
  grade: z.string(),
  topic: z.string(),
  conspect: ConspectSchema,
  bloomTasks: z.array(BloomTaskSchema).length(5),
  test: z.array(TestQuestionSchema).length(5),
  pdfBase64: z.string(),
})

export type WorksheetFromSchema = z.infer<typeof WorksheetSchema>

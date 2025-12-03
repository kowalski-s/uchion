import { z } from 'zod'

export const GenerateSchema = z.object({
  subject: z.enum(['математика', 'русский']),
  grade: z.number().int().min(1).max(4),
  topic: z.string().min(3).max(200)
})

export type GenerateFormValues = z.infer<typeof GenerateSchema>

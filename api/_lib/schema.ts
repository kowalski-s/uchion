export * from '../../shared/worksheet'
import { WorksheetSchema } from '../../shared/worksheet'
import type { z } from 'zod'

export const AIResponseSchema = WorksheetSchema.omit({
  id: true,
  subject: true,
  grade: true,
  pdfBase64: true,
}).extend({
  topic: WorksheetSchema.shape.topic.optional(),
  assignments: WorksheetSchema.shape.assignments.length(7), // Changed to 7 to match prompt instruction in previous turn (was 8 in some places, but prompt says 7)
  test: WorksheetSchema.shape.test.length(10),
})

// Wait, the prompt said 7 assignments, but schema.ts had 8.
// I should check `api/_lib/ai/prompts.ts` again.
// It says "ASSIGNMENTS (7 заданий)".
// And `api/_lib/ai-provider.ts` parser logic slices to 7.
// So I will use 7.
// Wait, previous `api/_lib/schema.ts` had `.length(8)`.
// Let's verify `api/_lib/schema.ts` original content.
// It had `.length(8)`.
// `api/_lib/ai/prompts.ts` says "ASSIGNMENTS (7 заданий)".
// I will use 7 to match prompt. Or 8 if I want to be safe?
// The prompt says "ASSIGNMENTS — ровно 7 заданий".
// So I should use 7.

export type WorksheetFromSchema = z.infer<typeof WorksheetSchema>

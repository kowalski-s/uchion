import { z } from 'zod';
// --- Enums ---
export const SubjectSchema = z.enum(['math', 'russian']);
export const AssignmentTypeSchema = z.enum(['theory', 'apply', 'error', 'creative']);
// --- Sub-components for Final Worksheet ---
export const AssignmentSchema = z.object({
    title: z.string(),
    text: z.string(),
});
export const TestQuestionSchema = z.object({
    question: z.string(),
    options: z.array(z.string()),
    answer: z.string(),
});
export const WorksheetAnswersSchema = z.object({
    assignments: z.array(z.string()),
    test: z.array(z.string()),
});
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
});
// --- Generation Form Schema ---
export const GenerateSchema = z.object({
    subject: SubjectSchema,
    grade: z.number().int().min(1).max(4),
    topic: z.string().min(3).max(200),
    folderId: z.string().uuid().nullable().optional(),
});
//# sourceMappingURL=worksheet.js.map
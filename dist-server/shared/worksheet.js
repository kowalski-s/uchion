import { z } from 'zod';
// --- Enums ---
export const SubjectSchema = z.enum(['math', 'algebra', 'geometry', 'russian']);
export const TaskTypeIdSchema = z.enum([
    'single_choice',
    'multiple_choice',
    'open_question',
    'matching',
    'fill_blank',
]);
export const DifficultyLevelSchema = z.enum(['easy', 'medium', 'hard']);
export const WorksheetFormatIdSchema = z.enum(['open_only', 'test_only', 'test_and_open']);
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
    grade: z.number().int().min(1).max(11),
    topic: z.string().min(3).max(200),
    folderId: z.string().uuid().nullable().optional(),
    // New fields for extended generation
    taskTypes: z.array(TaskTypeIdSchema).min(1).max(5).optional(),
    difficulty: DifficultyLevelSchema.optional(),
    format: WorksheetFormatIdSchema.optional(),
    variantIndex: z.number().int().min(0).max(2).optional(),
});
//# sourceMappingURL=worksheet.js.map
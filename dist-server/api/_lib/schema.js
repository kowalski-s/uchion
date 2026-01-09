export * from '../../shared/worksheet';
import { WorksheetSchema } from '../../shared/worksheet';
export const AIResponseSchema = WorksheetSchema.omit({
    id: true,
    subject: true,
    grade: true,
    pdfBase64: true,
}).extend({
    topic: WorksheetSchema.shape.topic.optional(),
    assignments: WorksheetSchema.shape.assignments.length(7), // Changed to 7 to match prompt instruction in previous turn (was 8 in some places, but prompt says 7)
    test: WorksheetSchema.shape.test.length(10),
});
//# sourceMappingURL=schema.js.map
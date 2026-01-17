import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users, worksheets } from '../../db/schema.js';
import { eq, sql, and, isNull } from 'drizzle-orm';
import { getAIProvider } from '../../api/_lib/ai-provider.js';
import { buildPdf } from '../../api/_lib/pdf.js';
import { getTokenFromCookie, ACCESS_TOKEN_COOKIE } from '../middleware/cookies.js';
import { verifyAccessToken } from '../../api/_lib/auth/tokens.js';
import { checkGenerateRateLimit } from '../middleware/rate-limit.js';
import { trackGeneration } from '../../api/_lib/alerts/generation-alerts.js';
const router = Router();
const InputSchema = z.object({
    subject: z.enum(['math', 'russian']),
    grade: z.number().int().min(1).max(4),
    topic: z.string().min(3).max(200),
    folderId: z.string().uuid().nullable().optional(),
});
// ==================== POST /api/generate ====================
router.post('/', async (req, res) => {
    const parse = InputSchema.safeParse(req.body);
    if (!parse.success) {
        return res.status(400).json({
            status: 'error',
            code: 'VALIDATION_ERROR',
            message: 'Проверьте введённые данные.',
        });
    }
    const input = parse.data;
    // Check authentication (optional - guests can also generate)
    let userId = null;
    const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE);
    if (token) {
        const payload = verifyAccessToken(token);
        if (payload) {
            userId = payload.sub;
            // Check user exists and is not deleted, also check limit
            const [user] = await db
                .select({ generationsLeft: users.generationsLeft })
                .from(users)
                .where(and(eq(users.id, userId), isNull(users.deletedAt)))
                .limit(1);
            if (!user) {
                return res.status(401).json({
                    status: 'error',
                    code: 'UNAUTHORIZED',
                    message: 'Пользователь не найден.',
                });
            }
            if (user.generationsLeft <= 0) {
                return res.status(403).json({
                    status: 'error',
                    code: 'LIMIT_EXCEEDED',
                    message: 'Лимит генераций исчерпан.',
                });
            }
        }
    }
    // Rate limiting
    const rateLimitResult = checkGenerateRateLimit(req, userId);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res.status(429).json({
            status: 'error',
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Слишком много запросов. Попробуйте через ${Math.ceil(retryAfter / 60)} мин.`,
            retryAfter,
        });
    }
    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    try {
        const ai = getAIProvider();
        // Pass progress callback
        const worksheet = await ai.generateWorksheet(input, (percent) => {
            sendEvent({ type: 'progress', percent });
        });
        sendEvent({ type: 'progress', percent: 97 });
        let pdfBase64 = null;
        try {
            console.log('[API] About to call buildPdf...');
            console.log('[API] Worksheet topic:', worksheet.topic);
            console.log('[API] Worksheet assignments count:', worksheet.assignments?.length);
            pdfBase64 = await buildPdf(worksheet, input);
            console.log('[API] buildPdf completed, base64 length:', pdfBase64?.length);
        }
        catch (e) {
            console.error('[API] PDF generation error:', e);
            console.error('[API] Error details:', e instanceof Error ? e.message : String(e));
            console.error('[API] Error stack:', e instanceof Error ? e.stack : 'no stack');
            // Track failed generation for alerts
            trackGeneration(false).catch((err) => console.error('[Alerts] Failed to track generation:', err));
            sendEvent({ type: 'error', code: 'PDF_ERROR', message: 'Ошибка генерации PDF.' });
            res.end();
            return;
        }
        const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now());
        let dbId = null;
        // Decrement limit and save worksheet for authenticated users
        if (userId) {
            await db
                .update(users)
                .set({
                generationsLeft: sql `${users.generationsLeft} - 1`,
                updatedAt: new Date(),
            })
                .where(eq(users.id, userId));
            try {
                const tempWorksheet = {
                    ...worksheet,
                    id,
                    grade: `${input.grade} класс`,
                    pdfBase64: pdfBase64 ?? ''
                };
                const [inserted] = await db.insert(worksheets).values({
                    userId,
                    folderId: input.folderId || null,
                    subject: input.subject,
                    grade: input.grade,
                    topic: input.topic,
                    difficulty: 'medium',
                    content: JSON.stringify(tempWorksheet),
                }).returning({ id: worksheets.id });
                dbId = inserted?.id || null;
            }
            catch (dbError) {
                console.error('[API] Failed to save worksheet to database:', dbError);
            }
        }
        const finalWorksheet = {
            ...worksheet,
            id: dbId || id,
            grade: `${input.grade} класс`,
            pdfBase64: pdfBase64 ?? ''
        };
        // Track successful generation for alerts
        trackGeneration(true).catch((e) => console.error('[Alerts] Failed to track generation:', e));
        sendEvent({ type: 'result', data: { worksheet: finalWorksheet } });
        res.end();
    }
    catch (err) {
        console.error('[API] Generate error:', err);
        // Track failed generation for alerts
        trackGeneration(false).catch((e) => console.error('[Alerts] Failed to track generation:', e));
        const code = err instanceof Error && err.message === 'AI_ERROR'
            ? 'AI_ERROR'
            : err instanceof Error && err.message === 'PDF_ERROR'
                ? 'PDF_ERROR'
                : 'SERVER_ERROR';
        sendEvent({ type: 'error', code, message: 'Не удалось сгенерировать лист. Попробуйте ещё раз.' });
        res.end();
    }
});
export default router;
//# sourceMappingURL=generate.js.map
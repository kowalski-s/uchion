import { Router } from 'express';
import { eq, and, isNull, desc, count, like, inArray, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/index.js';
import { users, worksheets, generations } from '../../../db/schema.js';
import { withAdminAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { checkRateLimit } from '../../middleware/rate-limit.js';
/** Escape LIKE special characters to prevent wildcard injection */
function escapeLike(input) {
    return input.replace(/[%_\\]/g, '\\$&');
}
const router = Router();
// ==================== GET /api/admin/generations ====================
const GenerationsQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    subject: z.enum(['all', 'math', 'algebra', 'geometry', 'russian']).optional().default('all'),
    search: z.string().optional(),
});
router.get('/', withAdminAuth(async (req, res) => {
    const rateLimitResult = await checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:generations:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        throw ApiError.tooManyRequests('Too many requests', retryAfter);
    }
    const parse = GenerationsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { page, limit, subject, search } = parse.data;
    const offset = (page - 1) * limit;
    const conditions = [isNull(worksheets.deletedAt)];
    if (subject !== 'all') {
        conditions.push(eq(worksheets.subject, subject));
    }
    if (search && search.trim()) {
        const searchPattern = `%${escapeLike(search.trim())}%`;
        const matchedUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(like(users.email, searchPattern))
            .limit(100);
        const userIds = matchedUsers.map(u => u.id);
        if (userIds.length > 0) {
            conditions.push(or(inArray(worksheets.userId, userIds), like(worksheets.topic, searchPattern)));
        }
        else {
            conditions.push(like(worksheets.topic, searchPattern));
        }
    }
    const whereClause = and(...conditions);
    const [totalResult] = await db
        .select({ count: count() })
        .from(worksheets)
        .where(whereClause);
    const worksheetsList = await db
        .select({
        id: worksheets.id,
        userId: worksheets.userId,
        userEmail: users.email,
        userName: users.name,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        title: worksheets.title,
        difficulty: worksheets.difficulty,
        createdAt: worksheets.createdAt,
    })
        .from(worksheets)
        .leftJoin(users, eq(worksheets.userId, users.id))
        .where(whereClause)
        .orderBy(desc(worksheets.createdAt))
        .limit(limit)
        .offset(offset);
    return res.status(200).json({
        generations: worksheetsList,
        pagination: {
            page,
            limit,
            total: totalResult.count,
            totalPages: Math.ceil(totalResult.count / limit),
        }
    });
}));
// ==================== GET /api/admin/generation-logs ====================
const GenerationLogsQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    status: z.enum(['all', 'pending', 'processing', 'completed', 'failed']).optional().default('all'),
    search: z.string().optional(),
});
export const generationLogsRouter = Router();
generationLogsRouter.get('/', withAdminAuth(async (req, res) => {
    const rateLimitResult = await checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:generation-logs:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        throw ApiError.tooManyRequests('Too many requests', retryAfter);
    }
    const parse = GenerationLogsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { page, limit, status, search } = parse.data;
    const offset = (page - 1) * limit;
    const conditions = [];
    if (status !== 'all') {
        conditions.push(eq(generations.status, status));
    }
    if (search && search.trim()) {
        const searchPattern = `%${escapeLike(search.trim())}%`;
        const matchedUsers = await db
            .select({ id: users.id })
            .from(users)
            .where(like(users.email, searchPattern))
            .limit(100);
        const userIds = matchedUsers.map(u => u.id);
        if (userIds.length === 0) {
            return res.status(200).json({
                logs: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            });
        }
        conditions.push(inArray(generations.userId, userIds));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const [totalResult] = await db
        .select({ count: count() })
        .from(generations)
        .where(whereClause);
    const logsList = await db
        .select({
        id: generations.id,
        userId: generations.userId,
        userEmail: users.email,
        userName: users.name,
        worksheetId: generations.worksheetId,
        worksheetSubject: worksheets.subject,
        worksheetGrade: worksheets.grade,
        worksheetTopic: worksheets.topic,
        status: generations.status,
        errorMessage: generations.errorMessage,
        createdAt: generations.createdAt,
    })
        .from(generations)
        .leftJoin(users, eq(generations.userId, users.id))
        .leftJoin(worksheets, eq(generations.worksheetId, worksheets.id))
        .where(whereClause)
        .orderBy(desc(generations.createdAt))
        .limit(limit)
        .offset(offset);
    return res.status(200).json({
        logs: logsList,
        pagination: {
            page,
            limit,
            total: totalResult.count,
            totalPages: Math.ceil(totalResult.count / limit),
        }
    });
}));
export default router;
//# sourceMappingURL=generations.js.map
import { Router } from 'express';
import { eq, and, desc, count, like, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db/index.js';
import { users, payments } from '../../../db/schema.js';
import { withAdminAuth } from '../../middleware/auth.js';
import { checkRateLimit } from '../../middleware/rate-limit.js';
/** Escape LIKE special characters to prevent wildcard injection */
function escapeLike(input) {
    return input.replace(/[%_\\]/g, '\\$&');
}
const router = Router();
// ==================== GET /api/admin/payments ====================
const PaymentsQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    status: z.enum(['all', 'pending', 'succeeded', 'failed', 'refunded']).optional().default('all'),
    search: z.string().optional(),
});
router.get('/', withAdminAuth(async (req, res) => {
    const rateLimitResult = await checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:payments:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    const parse = PaymentsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Validation error',
            details: parse.error.flatten().fieldErrors,
        });
    }
    const { page, limit, status, search } = parse.data;
    const offset = (page - 1) * limit;
    try {
        const conditions = [];
        if (status !== 'all') {
            conditions.push(eq(payments.status, status));
        }
        let userIdsToFilter = null;
        if (search && search.trim()) {
            const searchPattern = `%${escapeLike(search.trim())}%`;
            const matchedUsers = await db
                .select({ id: users.id })
                .from(users)
                .where(like(users.email, searchPattern))
                .limit(100);
            userIdsToFilter = matchedUsers.map(u => u.id);
            if (userIdsToFilter.length === 0) {
                return res.status(200).json({
                    payments: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }
            conditions.push(inArray(payments.userId, userIdsToFilter));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const [totalResult] = await db
            .select({ count: count() })
            .from(payments)
            .where(whereClause);
        const paymentsList = await db
            .select({
            id: payments.id,
            userId: payments.userId,
            userEmail: users.email,
            userName: users.name,
            amount: payments.amount,
            status: payments.status,
            providerPaymentId: payments.providerPaymentId,
            createdAt: payments.createdAt,
        })
            .from(payments)
            .leftJoin(users, eq(payments.userId, users.id))
            .where(whereClause)
            .orderBy(desc(payments.createdAt))
            .limit(limit)
            .offset(offset);
        return res.status(200).json({
            payments: paymentsList,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                totalPages: Math.ceil(totalResult.count / limit),
            }
        });
    }
    catch (error) {
        console.error('[Admin Payments] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
export default router;
//# sourceMappingURL=payments.js.map
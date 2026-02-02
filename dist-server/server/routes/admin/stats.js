import { Router } from 'express';
import { isNull, gte, sql, count, eq, and } from 'drizzle-orm';
import { db } from '../../../db/index.js';
import { users, worksheets, generations, subscriptions } from '../../../db/schema.js';
import { withAdminAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { checkRateLimit } from '../../middleware/rate-limit.js';
const router = Router();
// ==================== GET /api/admin/stats ====================
router.get('/', withAdminAuth(async (req, res) => {
    const rateLimitResult = await checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:stats:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        throw ApiError.tooManyRequests('Too many requests', retryAfter);
    }
    const [totalUsersResult] = await db
        .select({ count: count() })
        .from(users)
        .where(isNull(users.deletedAt));
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const [todayWorksheetsResult] = await db
        .select({ count: count() })
        .from(worksheets)
        .where(and(gte(worksheets.createdAt, todayStart), isNull(worksheets.deletedAt)));
    const [todayGenerationsResult] = await db
        .select({ count: count() })
        .from(generations)
        .where(gte(generations.createdAt, todayStart));
    const [activeSubscriptionsResult] = await db
        .select({ count: count() })
        .from(subscriptions)
        .where(and(eq(subscriptions.status, 'active'), sql `${subscriptions.plan} != 'free'`));
    const [totalWorksheetsResult] = await db
        .select({ count: count() })
        .from(worksheets)
        .where(isNull(worksheets.deletedAt));
    const [totalGenerationsResult] = await db
        .select({ count: count() })
        .from(generations);
    const todayCount = Math.max(todayWorksheetsResult.count, todayGenerationsResult.count);
    const totalCount = Math.max(totalWorksheetsResult.count, totalGenerationsResult.count);
    return res.status(200).json({
        stats: {
            totalUsers: totalUsersResult.count,
            todayGenerations: todayCount,
            activeSubscriptions: activeSubscriptionsResult.count,
            totalGenerations: totalCount,
        }
    });
}));
export default router;
//# sourceMappingURL=stats.js.map
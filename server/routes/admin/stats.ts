import { Router } from 'express'
import type { Response } from 'express'
import { isNull, gte, sql, count, eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { users, worksheets, generations, subscriptions, paymentIntents } from '../../../db/schema.js'
import { withAdminAuth } from '../../middleware/auth.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'

const serverStartTime = new Date()

const router = Router()

// ==================== GET /api/admin/stats ====================
router.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:stats:${req.user.id}`,
  })

  const [totalUsersResult] = await db
    .select({ count: count() })
    .from(users)
    .where(isNull(users.deletedAt))

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [todayWorksheetsResult] = await db
    .select({ count: count() })
    .from(worksheets)
    .where(and(
      gte(worksheets.createdAt, todayStart),
      isNull(worksheets.deletedAt)
    ))

  const [todayGenerationsResult] = await db
    .select({ count: count() })
    .from(generations)
    .where(gte(generations.createdAt, todayStart))

  const [activeSubscriptionsResult] = await db
    .select({ count: count() })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, 'active'),
      sql`${subscriptions.plan} != 'free'`
    ))

  const [totalWorksheetsResult] = await db
    .select({ count: count() })
    .from(worksheets)
    .where(isNull(worksheets.deletedAt))

  const [totalGenerationsResult] = await db
    .select({ count: count() })
    .from(generations)

  const todayCount = Math.max(todayWorksheetsResult.count, todayGenerationsResult.count)
  const totalCount = Math.max(totalWorksheetsResult.count, totalGenerationsResult.count)

  const uptimeSeconds = Math.floor((Date.now() - serverStartTime.getTime()) / 1000)

  return res.status(200).json({
    stats: {
      totalUsers: totalUsersResult.count,
      todayGenerations: todayCount,
      activeSubscriptions: activeSubscriptionsResult.count,
      totalGenerations: totalCount,
      uptimeSeconds,
      serverStartedAt: serverStartTime.toISOString(),
    }
  })
}))

// ==================== GET /api/admin/stats/subscriber-trend ====================

const TrendQuerySchema = z.object({
  days: z.string().optional().transform(v => Math.min(90, Math.max(1, parseInt(v || '30')))),
})

router.get('/subscriber-trend', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:subscriber-trend:${req.user.id}`,
  })

  const parse = TrendQuerySchema.safeParse(req.query)
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }

  const { days } = parse.data
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db.execute<{ date: string; count: number }>(sql`
    SELECT DATE(created_at) as date, COUNT(*)::int as count
    FROM subscriptions
    WHERE plan != 'free' AND created_at >= ${since.toISOString()}
    GROUP BY DATE(created_at)
    ORDER BY date
  `)

  const trend = (rows as Array<{ date: string; count: number }>).map(r => ({
    date: String(r.date),
    count: Number(r.count),
  }))

  return res.status(200).json({ trend })
}))

// ==================== GET /api/admin/stats/revenue-trend ====================

router.get('/revenue-trend', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:revenue-trend:${req.user.id}`,
  })

  const parse = TrendQuerySchema.safeParse(req.query)
  if (!parse.success) {
    return res.status(400).json({ error: 'Invalid parameters' })
  }

  const { days } = parse.data
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await db.execute<{ date: string; revenue: number; transactions: number }>(sql`
    SELECT DATE(paid_at) as date, COALESCE(SUM(amount), 0)::int as revenue, COUNT(*)::int as transactions
    FROM payment_intents
    WHERE status = 'paid' AND paid_at >= ${since.toISOString()}
    GROUP BY DATE(paid_at)
    ORDER BY date
  `)

  const trend = (rows as Array<{ date: string; revenue: number; transactions: number }>).map(r => ({
    date: String(r.date),
    revenue: Number(r.revenue),
    transactions: Number(r.transactions),
  }))

  return res.status(200).json({ trend })
}))

export default router

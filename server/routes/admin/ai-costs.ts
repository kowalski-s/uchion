import { Router } from 'express'
import type { Response } from 'express'
import { sql, gte } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { aiUsage } from '../../../db/schema.js'
import { withAdminAuth } from '../../middleware/auth.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'

const router = Router()

function getPeriodStart(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'today': {
      const start = new Date(now)
      start.setHours(0, 0, 0, 0)
      return start
    }
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    default: // 'all'
      return new Date(0)
  }
}

// ==================== GET /api/admin/ai-costs/summary ====================
router.get('/summary', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, { maxRequests: 30, windowSeconds: 60 })

  const period = (req.query.period as string) || 'month'
  const periodStart = getPeriodStart(period)

  const whereClause = period !== 'all'
    ? gte(aiUsage.createdAt, periodStart)
    : undefined

  // Total stats
  const [totals] = await db
    .select({
      totalCostKopecks: sql<number>`COALESCE(SUM(${aiUsage.costKopecks}), 0)`.as('total_cost'),
      totalCalls: sql<number>`COUNT(*)`.as('total_calls'),
      totalPromptTokens: sql<number>`COALESCE(SUM(${aiUsage.promptTokens}), 0)`.as('total_prompt'),
      totalCompletionTokens: sql<number>`COALESCE(SUM(${aiUsage.completionTokens}), 0)`.as('total_completion'),
    })
    .from(aiUsage)
    .where(whereClause)

  // By model
  const costByModel = await db
    .select({
      model: aiUsage.model,
      costKopecks: sql<number>`COALESCE(SUM(${aiUsage.costKopecks}), 0)`.as('cost'),
      calls: sql<number>`COUNT(*)`.as('calls'),
      promptTokens: sql<number>`COALESCE(SUM(${aiUsage.promptTokens}), 0)`.as('prompt'),
      completionTokens: sql<number>`COALESCE(SUM(${aiUsage.completionTokens}), 0)`.as('completion'),
    })
    .from(aiUsage)
    .where(whereClause)
    .groupBy(aiUsage.model)
    .orderBy(sql`cost DESC`)

  // By call type
  const costByCallType = await db
    .select({
      callType: aiUsage.callType,
      costKopecks: sql<number>`COALESCE(SUM(${aiUsage.costKopecks}), 0)`.as('cost'),
      calls: sql<number>`COUNT(*)`.as('calls'),
    })
    .from(aiUsage)
    .where(whereClause)
    .groupBy(aiUsage.callType)
    .orderBy(sql`cost DESC`)

  res.json({
    totalCostRubles: Number(totals.totalCostKopecks) / 100,
    totalCalls: Number(totals.totalCalls),
    totalPromptTokens: Number(totals.totalPromptTokens),
    totalCompletionTokens: Number(totals.totalCompletionTokens),
    costByModel: costByModel.map(row => ({
      model: row.model,
      costRubles: Number(row.costKopecks) / 100,
      calls: Number(row.calls),
      promptTokens: Number(row.promptTokens),
      completionTokens: Number(row.completionTokens),
    })),
    costByCallType: costByCallType.map(row => ({
      callType: row.callType,
      costRubles: Number(row.costKopecks) / 100,
      calls: Number(row.calls),
    })),
  })
}))

// ==================== GET /api/admin/ai-costs/daily ====================
router.get('/daily', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, { maxRequests: 30, windowSeconds: 60 })

  const days = Math.min(parseInt(req.query.days as string) || 30, 90)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const daily = await db
    .select({
      date: sql<string>`DATE(${aiUsage.createdAt})`.as('date'),
      costKopecks: sql<number>`COALESCE(SUM(${aiUsage.costKopecks}), 0)`.as('cost'),
      calls: sql<number>`COUNT(*)`.as('calls'),
    })
    .from(aiUsage)
    .where(gte(aiUsage.createdAt, since))
    .groupBy(sql`DATE(${aiUsage.createdAt})`)
    .orderBy(sql`date ASC`)

  res.json({
    daily: daily.map(row => ({
      date: String(row.date),
      costRubles: Number(row.costKopecks) / 100,
      calls: Number(row.calls),
    })),
  })
}))

export default router

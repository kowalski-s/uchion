import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, desc, count, like, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { users, payments } from '../../../db/schema.js'
import { withAdminAuth } from '../../middleware/auth.js'
import { ApiError } from '../../middleware/error-handler.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'

/** Escape LIKE special characters to prevent wildcard injection */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&')
}

const router = Router()

// ==================== GET /api/admin/payments ====================
const PaymentsQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
  status: z.enum(['all', 'pending', 'succeeded', 'failed', 'refunded']).optional().default('all'),
  search: z.string().optional(),
})

router.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:payments:${req.user.id}`,
  })

  const parse = PaymentsQuerySchema.safeParse(req.query)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { page, limit, status, search } = parse.data
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = []

  if (status !== 'all') {
    conditions.push(eq(payments.status, status))
  }

  let userIdsToFilter: string[] | null = null
  if (search && search.trim()) {
    const searchPattern = `%${escapeLike(search.trim())}%`
    const matchedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, searchPattern))
      .limit(100)

    userIdsToFilter = matchedUsers.map(u => u.id)
    if (userIdsToFilter.length === 0) {
      return res.status(200).json({
        payments: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      })
    }
    conditions.push(inArray(payments.userId, userIdsToFilter))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalResult] = await db
    .select({ count: count() })
    .from(payments)
    .where(whereClause)

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
    .offset(offset)

  return res.status(200).json({
    payments: paymentsList,
    pagination: {
      page,
      limit,
      total: totalResult.count,
      totalPages: Math.ceil(totalResult.count / limit),
    }
  })
}))

export default router

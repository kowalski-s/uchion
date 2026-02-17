import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, desc, count, like, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { users, payments, paymentIntents, webhookEvents } from '../../../db/schema.js'
import { withAdminAuth } from '../../middleware/auth.js'
import { ApiError } from '../../middleware/error-handler.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'
import { applyProductEffect } from '../../lib/billing-effects.js'

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

// ==================== PAYMENT INTENTS ====================

export const paymentIntentsRouter = Router()

const PaymentIntentsQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
  status: z.enum(['all', 'created', 'paid', 'failed', 'expired']).optional().default('all'),
  search: z.string().optional(),
})

paymentIntentsRouter.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:payment-intents:${req.user.id}`,
  })

  const parse = PaymentIntentsQuerySchema.safeParse(req.query)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { page, limit, status, search } = parse.data
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = []

  if (status !== 'all') {
    conditions.push(eq(paymentIntents.status, status))
  }

  if (search && search.trim()) {
    const searchPattern = `%${escapeLike(search.trim())}%`
    const matchedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, searchPattern))
      .limit(100)

    const userIds = matchedUsers.map(u => u.id)
    if (userIds.length === 0) {
      return res.status(200).json({
        paymentIntents: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      })
    }
    conditions.push(inArray(paymentIntents.userId, userIds))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalResult] = await db
    .select({ count: count() })
    .from(paymentIntents)
    .where(whereClause)

  const intentsList = await db
    .select({
      id: paymentIntents.id,
      userId: paymentIntents.userId,
      userEmail: users.email,
      userName: users.name,
      productCode: paymentIntents.productCode,
      amount: paymentIntents.amount,
      currency: paymentIntents.currency,
      status: paymentIntents.status,
      provider: paymentIntents.provider,
      providerOrderId: paymentIntents.providerOrderId,
      providerPaymentId: paymentIntents.providerPaymentId,
      createdAt: paymentIntents.createdAt,
      paidAt: paymentIntents.paidAt,
      expiresAt: paymentIntents.expiresAt,
    })
    .from(paymentIntents)
    .leftJoin(users, eq(paymentIntents.userId, users.id))
    .where(whereClause)
    .orderBy(desc(paymentIntents.createdAt))
    .limit(limit)
    .offset(offset)

  return res.status(200).json({
    paymentIntents: intentsList,
    pagination: {
      page,
      limit,
      total: totalResult.count,
      totalPages: Math.ceil(totalResult.count / limit),
    }
  })
}))

// POST /api/admin/payment-intents/:id/apply -- manually apply payment
paymentIntentsRouter.post('/:id/apply', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:apply-payment:${req.user.id}`,
  })

  const { id } = req.params

  // Find the payment intent
  const [intent] = await db
    .select()
    .from(paymentIntents)
    .where(eq(paymentIntents.id, id))
    .limit(1)

  if (!intent) {
    throw ApiError.notFound('Платежный интент не найден')
  }

  if (intent.status !== 'created') {
    throw ApiError.badRequest(`Невозможно применить оплату: статус "${intent.status}" (ожидается "created")`)
  }

  // Update status to paid
  await db.update(paymentIntents).set({
    status: 'paid',
    paidAt: new Date(),
    providerPaymentId: `manual-admin-${req.user.id}`,
  }).where(eq(paymentIntents.id, id))

  // Apply product effect
  const result = await applyProductEffect(intent.userId, intent.productCode)

  console.log(`[Admin] Manually applied payment ${id} (${intent.productCode}) by ${req.user.email}: ${result.message}`)

  return res.status(200).json({ success: result.success, message: result.message })
}))

// ==================== WEBHOOK EVENTS ====================

export const webhookEventsRouter = Router()

const WebhookEventsQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
  provider: z.string().optional(),
})

webhookEventsRouter.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:webhook-events:${req.user.id}`,
  })

  const parse = WebhookEventsQuerySchema.safeParse(req.query)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { page, limit, provider } = parse.data
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = []

  if (provider && provider.trim()) {
    conditions.push(eq(webhookEvents.provider, provider.trim()))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalResult] = await db
    .select({ count: count() })
    .from(webhookEvents)
    .where(whereClause)

  const eventsList = await db
    .select({
      id: webhookEvents.id,
      provider: webhookEvents.provider,
      eventKey: webhookEvents.eventKey,
      rawPayloadHash: webhookEvents.rawPayloadHash,
      processedAt: webhookEvents.processedAt,
      createdAt: webhookEvents.createdAt,
    })
    .from(webhookEvents)
    .where(whereClause)
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit)
    .offset(offset)

  return res.status(200).json({
    webhookEvents: eventsList,
    pagination: {
      page,
      limit,
      total: totalResult.count,
      totalPages: Math.ceil(totalResult.count / limit),
    }
  })
}))

export default router

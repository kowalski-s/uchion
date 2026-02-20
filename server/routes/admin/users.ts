import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, isNull, isNotNull, desc, count, like, or, inArray, asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { users, worksheets, generations, subscriptions, payments, folders, paymentIntents, refreshTokens } from '../../../db/schema.js'
import { withAdminAuth } from '../../middleware/auth.js'
import { ApiError } from '../../middleware/error-handler.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'

/** Escape LIKE special characters to prevent wildcard injection */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&')
}

const router = Router()

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ==================== GET /api/admin/users ====================
const UsersQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
  search: z.string().optional(),
  status: z.enum(['all', 'active', 'blocked']).optional().default('active'),
  sortBy: z.enum(['createdAt', 'email', 'name']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

router.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:users:${req.user.id}`,
  })

  const parse = UsersQuerySchema.safeParse(req.query)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { page, limit, search, status, sortBy, sortOrder } = parse.data
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = []

  if (status === 'active') {
    conditions.push(isNull(users.deletedAt))
  } else if (status === 'blocked') {
    conditions.push(isNotNull(users.deletedAt))
  }

  if (search && search.trim()) {
    const searchPattern = `%${escapeLike(search.trim())}%`
    conditions.push(
      or(
        like(users.email, searchPattern),
        like(users.name, searchPattern),
        like(users.providerId, searchPattern)
      )!
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined
  const [totalResult] = await db
    .select({ count: count() })
    .from(users)
    .where(whereClause)

  const getSortColumn = () => {
    switch (sortBy) {
      case 'email': return users.email
      case 'name': return users.name
      default: return users.createdAt
    }
  }
  const sortColumn = getSortColumn()

  const usersList = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
      provider: users.provider,
      providerId: users.providerId,
      generationsLeft: users.generationsLeft,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
    .limit(limit)
    .offset(offset)

  const userIds = usersList.map(u => u.id)

  let generationCounts: Record<string, number> = {}
  let worksheetCounts: Record<string, number> = {}

  if (userIds.length > 0) {
    const genCountsResult = await db
      .select({
        userId: generations.userId,
        count: count(),
      })
      .from(generations)
      .where(inArray(generations.userId, userIds))
      .groupBy(generations.userId)

    generationCounts = genCountsResult.reduce((acc, row) => {
      acc[row.userId] = row.count
      return acc
    }, {} as Record<string, number>)

    const worksheetCountsResult = await db
      .select({
        userId: worksheets.userId,
        count: count(),
      })
      .from(worksheets)
      .where(and(
        inArray(worksheets.userId, userIds),
        isNull(worksheets.deletedAt)
      ))
      .groupBy(worksheets.userId)

    worksheetCounts = worksheetCountsResult.reduce((acc, row) => {
      acc[row.userId] = row.count
      return acc
    }, {} as Record<string, number>)
  }

  const usersWithCounts = usersList.map(user => ({
    ...user,
    isBlocked: user.deletedAt !== null,
    generationsCount: Math.max(
      generationCounts[user.id] || 0,
      worksheetCounts[user.id] || 0
    ),
    worksheetsCount: worksheetCounts[user.id] || 0,
  }))

  return res.status(200).json({
    users: usersWithCounts,
    pagination: {
      page,
      limit,
      total: totalResult.count,
      totalPages: Math.ceil(totalResult.count / limit),
    }
  })
}))

// ==================== GET /api/admin/users/:id ====================
router.get('/:id', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    throw ApiError.badRequest('Invalid user ID format')
  }

  await requireRateLimit(req, {
    maxRequests: 60,
    windowSeconds: 60,
    identifier: `admin:user-detail:${req.user.id}`,
  })

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
      provider: users.provider,
      providerId: users.providerId,
      generationsLeft: users.generationsLeft,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!user) {
    throw ApiError.notFound('User not found')
  }

  const [subscription] = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, id))
    .limit(1)

  const [generationsCountResult] = await db
    .select({ count: count() })
    .from(generations)
    .where(eq(generations.userId, id))

  const [worksheetsCountResult] = await db
    .select({ count: count() })
    .from(worksheets)
    .where(and(
      eq(worksheets.userId, id),
      isNull(worksheets.deletedAt)
    ))

  const userWorksheets = await db
    .select({
      id: worksheets.id,
      subject: worksheets.subject,
      grade: worksheets.grade,
      topic: worksheets.topic,
      title: worksheets.title,
      createdAt: worksheets.createdAt,
    })
    .from(worksheets)
    .where(and(
      eq(worksheets.userId, id),
      isNull(worksheets.deletedAt)
    ))
    .orderBy(desc(worksheets.createdAt))
    .limit(20)

  const userGenerations = await db
    .select({
      id: generations.id,
      status: generations.status,
      errorMessage: generations.errorMessage,
      createdAt: generations.createdAt,
      worksheetId: generations.worksheetId,
      worksheetSubject: worksheets.subject,
      worksheetGrade: worksheets.grade,
      worksheetTopic: worksheets.topic,
    })
    .from(generations)
    .leftJoin(worksheets, eq(generations.worksheetId, worksheets.id))
    .where(eq(generations.userId, id))
    .orderBy(desc(generations.createdAt))
    .limit(20)

  const totalGenerations = Math.max(
    generationsCountResult.count,
    worksheetsCountResult.count
  )

  return res.status(200).json({
    user: {
      ...user,
      isBlocked: user.deletedAt !== null,
      subscription: subscription || { plan: 'free', status: 'active', expiresAt: null },
      generationsCount: totalGenerations,
      worksheetsCount: worksheetsCountResult.count,
    },
    generations: userGenerations,
    worksheets: userWorksheets,
  })
}))

// ==================== POST /api/admin/users/:id/block ====================
router.post('/:id/block', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    throw ApiError.badRequest('Invalid user ID format')
  }

  if (id === req.user.id) {
    throw ApiError.badRequest('Cannot block yourself')
  }

  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:block-user:${req.user.id}`,
  })

  const [user] = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!user) {
    throw ApiError.notFound('User not found')
  }

  if (user.deletedAt !== null) {
    throw ApiError.badRequest('User is already blocked')
  }

  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, id))

  console.log(`[Admin] User ${id} blocked by admin ${req.user.id}`)

  return res.status(200).json({ success: true })
}))

// ==================== POST /api/admin/users/:id/unblock ====================
router.post('/:id/unblock', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    throw ApiError.badRequest('Invalid user ID format')
  }

  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:unblock-user:${req.user.id}`,
  })

  const [user] = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!user) {
    throw ApiError.notFound('User not found')
  }

  if (user.deletedAt === null) {
    throw ApiError.badRequest('User is not blocked')
  }

  await db
    .update(users)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(users.id, id))

  console.log(`[Admin] User ${id} unblocked by admin ${req.user.id}`)

  return res.status(200).json({ success: true })
}))

// ==================== DELETE /api/admin/users/:id/purge ====================
router.delete('/:id/purge', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 5,
    windowSeconds: 60,
    identifier: `admin:purge:${req.user.id}`,
  })

  const userId = req.params.id
  if (!uuidRegex.test(userId)) {
    throw ApiError.badRequest('Invalid user ID format')
  }

  if (userId === req.user.id) {
    throw ApiError.badRequest('Cannot purge your own account')
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    throw ApiError.notFound('User not found')
  }

  await db.delete(paymentIntents).where(eq(paymentIntents.userId, userId))
  await db.delete(payments).where(eq(payments.userId, userId))
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId))
  await db.delete(generations).where(eq(generations.userId, userId))
  await db.delete(worksheets).where(eq(worksheets.userId, userId))
  await db.delete(folders).where(eq(folders.userId, userId))
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))
  await db.delete(users).where(eq(users.id, userId))

  console.log(`[Admin] User ${userId} permanently purged by admin ${req.user.id}`)

  return res.status(200).json({
    success: true,
    message: 'User and all associated data permanently deleted',
  })
}))

export default router

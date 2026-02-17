import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, isNull, desc, count, like, gte, lte, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { users, worksheets, generations } from '../../../db/schema.js'
import { withAdminAuth } from '../../middleware/auth.js'
import { ApiError } from '../../middleware/error-handler.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'

/** Escape LIKE special characters to prevent wildcard injection */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&')
}

const router = Router()

// ==================== GET /api/admin/generations ====================
const GenerationsQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
  subject: z.enum(['all', 'math', 'algebra', 'geometry', 'russian']).optional().default('all'),
  search: z.string().optional(),
})

router.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:generations:${req.user.id}`,
  })

  const parse = GenerationsQuerySchema.safeParse(req.query)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { page, limit, subject, search } = parse.data
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = [isNull(worksheets.deletedAt)]

  if (subject !== 'all') {
    conditions.push(eq(worksheets.subject, subject))
  }

  if (search && search.trim()) {
    const searchPattern = `%${escapeLike(search.trim())}%`

    const matchedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, searchPattern))
      .limit(100)

    const userIds = matchedUsers.map(u => u.id)

    if (userIds.length > 0) {
      conditions.push(
        or(
          inArray(worksheets.userId, userIds),
          like(worksheets.topic, searchPattern)
        )!
      )
    } else {
      conditions.push(like(worksheets.topic, searchPattern))
    }
  }

  const whereClause = and(...conditions)

  const [totalResult] = await db
    .select({ count: count() })
    .from(worksheets)
    .where(whereClause)

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
    .offset(offset)

  return res.status(200).json({
    generations: worksheetsList,
    pagination: {
      page,
      limit,
      total: totalResult.count,
      totalPages: Math.ceil(totalResult.count / limit),
    }
  })
}))

// ==================== GET /api/admin/generation-logs ====================
// Only failed generations are logged, so no status filter needed
const GenerationLogsQuerySchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
  search: z.string().optional(),
})

export const generationLogsRouter = Router()

generationLogsRouter.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:generation-logs:${req.user.id}`,
  })

  const parse = GenerationLogsQuerySchema.safeParse(req.query)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { page, limit, search } = parse.data
  const offset = (page - 1) * limit

  const conditions: ReturnType<typeof eq>[] = []

  if (search && search.trim()) {
    const searchPattern = `%${escapeLike(search.trim())}%`

    const matchedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(like(users.email, searchPattern))
      .limit(100)

    const userIds = matchedUsers.map(u => u.id)

    if (userIds.length > 0) {
      conditions.push(
        or(
          inArray(generations.userId, userIds),
          like(generations.topic, searchPattern)
        )!
      )
    } else {
      conditions.push(like(generations.topic, searchPattern))
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const [totalResult] = await db
    .select({ count: count() })
    .from(generations)
    .where(whereClause)

  const logsList = await db
    .select({
      id: generations.id,
      userId: generations.userId,
      userEmail: users.email,
      userName: users.name,
      subject: generations.subject,
      grade: generations.grade,
      topic: generations.topic,
      errorMessage: generations.errorMessage,
      createdAt: generations.createdAt,
    })
    .from(generations)
    .leftJoin(users, eq(generations.userId, users.id))
    .where(whereClause)
    .orderBy(desc(generations.createdAt))
    .limit(limit)
    .offset(offset)

  return res.status(200).json({
    logs: logsList,
    pagination: {
      page,
      limit,
      total: totalResult.count,
      totalPages: Math.ceil(totalResult.count / limit),
    }
  })
}))

// ==================== STUCK GENERATIONS ====================

export const stuckGenerationsRouter = Router()

// GET /api/admin/stuck-generations -- list stuck (processing > 5 min) generations
stuckGenerationsRouter.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `admin:stuck-generations:${req.user.id}`,
  })

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)

  const stuckList = await db
    .select({
      id: generations.id,
      userId: generations.userId,
      userEmail: users.email,
      userName: users.name,
      subject: generations.subject,
      grade: generations.grade,
      topic: generations.topic,
      startedAt: generations.startedAt,
      createdAt: generations.createdAt,
    })
    .from(generations)
    .leftJoin(users, eq(generations.userId, users.id))
    .where(and(
      eq(generations.status, 'processing'),
      lte(generations.startedAt, fiveMinAgo)
    ))
    .orderBy(desc(generations.startedAt))
    .limit(100)

  return res.status(200).json({ stuckGenerations: stuckList })
}))

// POST /api/admin/stuck-generations/:id/force-fail -- force fail a stuck generation
const ForceFailSchema = z.object({
  refund: z.boolean().optional().default(true),
})

stuckGenerationsRouter.post('/:id/force-fail', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:force-fail:${req.user.id}`,
  })

  const { id } = req.params
  const parse = ForceFailSchema.safeParse(req.body)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const { refund } = parse.data

  // Find the generation
  const [gen] = await db
    .select({ id: generations.id, userId: generations.userId, status: generations.status })
    .from(generations)
    .where(eq(generations.id, id))
    .limit(1)

  if (!gen) {
    throw ApiError.notFound('Генерация не найдена')
  }

  if (gen.status !== 'processing') {
    throw ApiError.badRequest('Генерация не в статусе processing')
  }

  // Update to failed
  await db.update(generations).set({
    status: 'failed',
    errorMessage: `Принудительно завершено администратором (${req.user.email})`,
  }).where(eq(generations.id, id))

  // Refund credit if requested
  if (refund) {
    await db
      .update(users)
      .set({
        generationsLeft: sql`${users.generationsLeft} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, gen.userId))
  }

  console.log(`[Admin] Force-failed generation ${id} by ${req.user.email}, refund=${refund}`)

  return res.status(200).json({ success: true, refunded: refund })
}))

export default router

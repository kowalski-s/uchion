import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { worksheets, folders } from '../../db/schema.js'
import { withAuth } from '../middleware/auth.js'
import { ApiError } from '../middleware/error-handler.js'
import { requireRateLimit } from '../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

const UpdateWorksheetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  content: z.string().optional(),
})

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ==================== GET /api/worksheets ====================
router.get('/', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user

  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `worksheets:list:${user.id}`,
  })

  const { folderId, limit: limitStr } = req.query
  const limit = Math.min(parseInt(limitStr as string) || 50, 100)

  const conditions = [
    eq(worksheets.userId, user.id),
    isNull(worksheets.deletedAt),
  ]

  if (folderId === 'null' || folderId === '') {
    conditions.push(isNull(worksheets.folderId))
  } else if (folderId && typeof folderId === 'string') {
    if (uuidRegex.test(folderId)) {
      conditions.push(eq(worksheets.folderId, folderId))
    }
  }

  const userWorksheets = await db
    .select({
      id: worksheets.id,
      folderId: worksheets.folderId,
      title: worksheets.title,
      subject: worksheets.subject,
      grade: worksheets.grade,
      topic: worksheets.topic,
      difficulty: worksheets.difficulty,
      createdAt: worksheets.createdAt,
      updatedAt: worksheets.updatedAt,
    })
    .from(worksheets)
    .where(and(...conditions))
    .orderBy(desc(worksheets.createdAt))
    .limit(limit)

  return res.status(200).json({ worksheets: userWorksheets })
}))

// ==================== GET /api/worksheets/:id ====================
router.get('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    throw ApiError.badRequest('Invalid worksheet ID format')
  }

  await requireRateLimit(req, {
    maxRequests: 60,
    windowSeconds: 60,
    identifier: `worksheet:get:${user.id}`,
  })

  const [worksheet] = await db
    .select({
      id: worksheets.id,
      userId: worksheets.userId,
      folderId: worksheets.folderId,
      title: worksheets.title,
      subject: worksheets.subject,
      grade: worksheets.grade,
      topic: worksheets.topic,
      difficulty: worksheets.difficulty,
      content: worksheets.content,
      createdAt: worksheets.createdAt,
      updatedAt: worksheets.updatedAt,
    })
    .from(worksheets)
    .where(and(
      eq(worksheets.id, id),
      isNull(worksheets.deletedAt)
    ))
    .limit(1)

  if (!worksheet) {
    throw ApiError.notFound('Worksheet not found')
  }

  if (worksheet.userId !== user.id) {
    throw ApiError.forbidden('Access denied')
  }

  let parsedContent = null
  try {
    parsedContent = JSON.parse(worksheet.content)
  } catch (parseError) {
    console.error('[Worksheets] Failed to parse content JSON:', parseError)
    throw ApiError.internal('Failed to parse worksheet content')
  }

  return res.status(200).json({
    worksheet: {
      id: worksheet.id,
      folderId: worksheet.folderId,
      title: worksheet.title,
      subject: worksheet.subject,
      grade: worksheet.grade,
      topic: worksheet.topic,
      difficulty: worksheet.difficulty,
      content: parsedContent,
      createdAt: worksheet.createdAt,
      updatedAt: worksheet.updatedAt,
    }
  })
}))

// ==================== PATCH /api/worksheets/:id ====================
router.patch('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    throw ApiError.badRequest('Invalid worksheet ID format')
  }

  await requireRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `worksheet:update:${user.id}`,
  })

  const parse = UpdateWorksheetSchema.safeParse(req.body)
  if (!parse.success) {
    throw ApiError.validation(parse.error.flatten().fieldErrors)
  }

  const updates = parse.data

  const [worksheet] = await db
    .select({ userId: worksheets.userId })
    .from(worksheets)
    .where(and(
      eq(worksheets.id, id),
      isNull(worksheets.deletedAt)
    ))
    .limit(1)

  if (!worksheet) {
    throw ApiError.notFound('Worksheet not found')
  }

  if (worksheet.userId !== user.id) {
    throw ApiError.forbidden('Access denied')
  }

  if (updates.folderId !== undefined && updates.folderId !== null) {
    const [folder] = await db
      .select({ userId: folders.userId })
      .from(folders)
      .where(and(
        eq(folders.id, updates.folderId),
        isNull(folders.deletedAt)
      ))
      .limit(1)

    if (!folder) {
      throw ApiError.badRequest('Folder not found')
    }

    if (folder.userId !== user.id) {
      throw ApiError.forbidden('Folder access denied')
    }
  }

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (updates.title !== undefined) updateData.title = updates.title
  if (updates.folderId !== undefined) updateData.folderId = updates.folderId

  if (updates.content !== undefined) {
    try {
      JSON.parse(updates.content)
      updateData.content = updates.content
    } catch {
      throw ApiError.badRequest('Invalid content JSON')
    }
  }

  await db
    .update(worksheets)
    .set(updateData)
    .where(eq(worksheets.id, id))

  return res.status(200).json({ success: true })
}))

// ==================== DELETE /api/worksheets/:id ====================
router.delete('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    throw ApiError.badRequest('Invalid worksheet ID format')
  }

  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `worksheet:delete:${user.id}`,
  })

  const [worksheet] = await db
    .select({ userId: worksheets.userId })
    .from(worksheets)
    .where(and(
      eq(worksheets.id, id),
      isNull(worksheets.deletedAt)
    ))
    .limit(1)

  if (!worksheet) {
    throw ApiError.notFound('Worksheet not found')
  }

  if (worksheet.userId !== user.id) {
    throw ApiError.forbidden('Access denied')
  }

  await db
    .update(worksheets)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(worksheets.id, id))

  return res.status(200).json({ success: true })
}))

export default router

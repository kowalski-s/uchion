import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { worksheets, folders } from '../../db/schema.js'
import { withAuth } from '../middleware/auth.js'
import { checkRateLimit } from '../middleware/rate-limit.js'
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

  const rateLimitResult = await checkRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `worksheets:list:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
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
  } catch (error) {
    console.error('[API worksheets] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== GET /api/worksheets/:id ====================
router.get('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid worksheet ID format' })
  }

  const rateLimitResult = await checkRateLimit(req, {
    maxRequests: 60,
    windowSeconds: 60,
    identifier: `worksheet:get:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
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
      return res.status(404).json({ error: 'Worksheet not found' })
    }

    if (worksheet.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    let parsedContent = null
    try {
      parsedContent = JSON.parse(worksheet.content)
    } catch (parseError) {
      console.error('[Worksheets] Failed to parse content JSON:', parseError)
      return res.status(500).json({ error: 'Failed to parse worksheet content' })
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
  } catch (error) {
    console.error('[Worksheets] GET Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== PATCH /api/worksheets/:id ====================
router.patch('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid worksheet ID format' })
  }

  const rateLimitResult = await checkRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `worksheet:update:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  const parse = UpdateWorksheetSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const updates = parse.data

  try {
    const [worksheet] = await db
      .select({ userId: worksheets.userId })
      .from(worksheets)
      .where(and(
        eq(worksheets.id, id),
        isNull(worksheets.deletedAt)
      ))
      .limit(1)

    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' })
    }

    if (worksheet.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
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
        return res.status(400).json({ error: 'Folder not found' })
      }

      if (folder.userId !== user.id) {
        return res.status(403).json({ error: 'Folder access denied' })
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
        return res.status(400).json({ error: 'Invalid content JSON' })
      }
    }

    await db
      .update(worksheets)
      .set(updateData)
      .where(eq(worksheets.id, id))

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Worksheets] Update Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== DELETE /api/worksheets/:id ====================
router.delete('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid worksheet ID format' })
  }

  const rateLimitResult = await checkRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `worksheet:delete:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    const [worksheet] = await db
      .select({ userId: worksheets.userId })
      .from(worksheets)
      .where(and(
        eq(worksheets.id, id),
        isNull(worksheets.deletedAt)
      ))
      .limit(1)

    if (!worksheet) {
      return res.status(404).json({ error: 'Worksheet not found' })
    }

    if (worksheet.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    await db
      .update(worksheets)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(worksheets.id, id))

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Worksheets] Delete Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

export default router

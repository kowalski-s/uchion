import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { worksheets, folders } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

// Validation schema for updates
const UpdateWorksheetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  content: z.string().optional(),
})

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Combined worksheets endpoint:
 * GET    /api/worksheets                - List worksheets (recent)
 * GET    /api/worksheets/[id]           - Get single worksheet
 * PUT    /api/worksheets/[id]           - Update worksheet
 * DELETE /api/worksheets/[id]           - Delete worksheet
 * POST   /api/worksheets/[id]/duplicate - Duplicate worksheet
 */
async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  const { path } = req.query
  const pathSegments = Array.isArray(path) ? path : path ? [path] : []

  // Parse path segments
  const worksheetId = pathSegments[0] || null
  const action = pathSegments[1] || null

  // Validate worksheet ID format if provided
  if (worksheetId && !uuidRegex.test(worksheetId)) {
    return res.status(400).json({ error: 'Invalid worksheet ID format' })
  }

  // Route based on path and method
  if (!worksheetId) {
    // GET /api/worksheets - list
    if (req.method === 'GET') {
      return handleList(req, res, user)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (action === 'duplicate') {
    // POST /api/worksheets/[id]/duplicate
    if (req.method === 'POST') {
      return handleDuplicate(req, res, user, worksheetId)
    }
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // /api/worksheets/[id]
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, user, worksheetId)
    case 'PUT':
    case 'PATCH':
      return handleUpdate(req, res, user, worksheetId)
    case 'DELETE':
      return handleDelete(req, res, user, worksheetId)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

// GET /api/worksheets - List worksheets (recent)
async function handleList(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser
) {
  const rateLimitResult = checkRateLimit(req, {
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
    } else if (folderId && typeof folderId === 'string' && uuidRegex.test(folderId)) {
      conditions.push(eq(worksheets.folderId, folderId))
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
    console.error('[Worksheets List] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/worksheets/[id] - Get single worksheet
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  const rateLimitResult = checkRateLimit(req, {
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
    } catch {
      console.error('[Worksheets Get] Failed to parse content JSON')
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
    console.error('[Worksheets Get] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT/PATCH /api/worksheets/[id] - Update worksheet
async function handleUpdate(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  const rateLimitResult = checkRateLimit(req, {
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
    console.error('[Worksheets Update] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/worksheets/[id] - Soft delete worksheet
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  const rateLimitResult = checkRateLimit(req, {
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
    console.error('[Worksheets Delete] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/worksheets/[id]/duplicate - Duplicate worksheet
async function handleDuplicate(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `worksheet:duplicate:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    const [original] = await db
      .select({
        userId: worksheets.userId,
        folderId: worksheets.folderId,
        title: worksheets.title,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        difficulty: worksheets.difficulty,
        content: worksheets.content,
      })
      .from(worksheets)
      .where(and(
        eq(worksheets.id, id),
        isNull(worksheets.deletedAt)
      ))
      .limit(1)

    if (!original) {
      return res.status(404).json({ error: 'Worksheet not found' })
    }

    if (original.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    const originalTitle = original.title || original.topic
    const copyTitle = `${originalTitle} (копия)`

    const [newWorksheet] = await db
      .insert(worksheets)
      .values({
        userId: user.id,
        folderId: original.folderId,
        title: copyTitle,
        subject: original.subject,
        grade: original.grade,
        topic: original.topic,
        difficulty: original.difficulty,
        content: original.content,
      })
      .returning({
        id: worksheets.id,
        folderId: worksheets.folderId,
        title: worksheets.title,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        difficulty: worksheets.difficulty,
        createdAt: worksheets.createdAt,
      })

    return res.status(201).json({ worksheet: newWorksheet })
  } catch (error) {
    console.error('[Worksheets Duplicate] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

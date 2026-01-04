import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { worksheets, folders } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

// Validation schema for PATCH/PUT updates
const UpdateWorksheetSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  folderId: z.string().uuid().nullable().optional(),
  content: z.string().optional(), // JSON string with worksheet structure
})

async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Worksheet ID required' })
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid worksheet ID format' })
  }

  // Route to appropriate handler based on method
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, user, id)
    case 'PUT':
    case 'PATCH':
      return handleUpdate(req, res, user, id)
    case 'DELETE':
      return handleDelete(req, res, user, id)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

// GET /api/worksheets/[id] - Get single worksheet
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  // Rate limiting: 60 reads per minute
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

    // Security: check ownership
    if (worksheet.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Parse content JSON
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
  // Rate limiting: 30 updates per minute
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

  // Validate input
  const parse = UpdateWorksheetSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const updates = parse.data

  try {
    // Check if worksheet exists and belongs to user
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

    // Security: check ownership
    if (worksheet.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // If folderId is provided, verify it exists and belongs to user
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

      // Security: check folder ownership
      if (folder.userId !== user.id) {
        return res.status(403).json({ error: 'Folder access denied' })
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.title !== undefined) {
      updateData.title = updates.title
    }

    if (updates.folderId !== undefined) {
      updateData.folderId = updates.folderId
    }

    if (updates.content !== undefined) {
      // Validate content is valid JSON
      try {
        JSON.parse(updates.content)
        updateData.content = updates.content
      } catch {
        return res.status(400).json({ error: 'Invalid content JSON' })
      }
    }

    // Update worksheet
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
  // Rate limiting: 10 deletions per minute
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
    // Check if worksheet exists and belongs to user
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

    // Security: check ownership
    if (worksheet.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Soft delete
    await db
      .update(worksheets)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(worksheets.id, id))

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Worksheets Delete] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

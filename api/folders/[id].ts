import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { folders, worksheets } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

// Validation schema for updating a folder
const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Folder ID required' })
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid folder ID format' })
  }

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

// GET /api/folders/[id] - Get single folder with its worksheets
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  // Rate limiting
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 60,
    windowSeconds: 60,
    identifier: `folders:get:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    const [folder] = await db
      .select({
        id: folders.id,
        userId: folders.userId,
        name: folders.name,
        color: folders.color,
        parentId: folders.parentId,
        sortOrder: folders.sortOrder,
        createdAt: folders.createdAt,
      })
      .from(folders)
      .where(and(
        eq(folders.id, id),
        isNull(folders.deletedAt)
      ))
      .limit(1)

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    // Security: check ownership
    if (folder.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Get worksheets in this folder
    const folderWorksheets = await db
      .select({
        id: worksheets.id,
        title: worksheets.title,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        createdAt: worksheets.createdAt,
      })
      .from(worksheets)
      .where(and(
        eq(worksheets.folderId, id),
        eq(worksheets.userId, user.id),
        isNull(worksheets.deletedAt)
      ))

    return res.status(200).json({
      folder: {
        id: folder.id,
        name: folder.name,
        color: folder.color,
        parentId: folder.parentId,
        sortOrder: folder.sortOrder,
        createdAt: folder.createdAt,
        worksheetCount: folderWorksheets.length,
      },
      worksheets: folderWorksheets,
    })
  } catch (error) {
    console.error('[Folders Get] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// PUT/PATCH /api/folders/[id] - Update folder
async function handleUpdate(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  // Rate limiting
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 30,
    windowSeconds: 60,
    identifier: `folders:update:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  // Validate input
  const parse = UpdateFolderSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const updates = parse.data

  try {
    // Check if folder exists and belongs to user
    const [folder] = await db
      .select({ userId: folders.userId })
      .from(folders)
      .where(and(
        eq(folders.id, id),
        isNull(folders.deletedAt)
      ))
      .limit(1)

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    // Security: check ownership
    if (folder.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // If parentId is provided, verify it exists, belongs to user, and is not self
    if (updates.parentId !== undefined && updates.parentId !== null) {
      // Prevent folder being its own parent
      if (updates.parentId === id) {
        return res.status(400).json({ error: 'Folder cannot be its own parent' })
      }

      const [parent] = await db
        .select({ userId: folders.userId })
        .from(folders)
        .where(and(
          eq(folders.id, updates.parentId),
          isNull(folders.deletedAt)
        ))
        .limit(1)

      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' })
      }

      // Security: check parent ownership
      if (parent.userId !== user.id) {
        return res.status(403).json({ error: 'Parent folder access denied' })
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.name !== undefined) {
      updateData.name = updates.name
    }
    if (updates.color !== undefined) {
      updateData.color = updates.color
    }
    if (updates.parentId !== undefined) {
      updateData.parentId = updates.parentId
    }
    if (updates.sortOrder !== undefined) {
      updateData.sortOrder = updates.sortOrder
    }

    // Update folder
    await db
      .update(folders)
      .set(updateData)
      .where(eq(folders.id, id))

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Folders Update] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// DELETE /api/folders/[id] - Soft delete folder
async function handleDelete(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
  // Rate limiting
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `folders:delete:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    // Check if folder exists and belongs to user
    const [folder] = await db
      .select({ userId: folders.userId })
      .from(folders)
      .where(and(
        eq(folders.id, id),
        isNull(folders.deletedAt)
      ))
      .limit(1)

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' })
    }

    // Security: check ownership
    if (folder.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Move worksheets from this folder to root (folderId = null)
    await db
      .update(worksheets)
      .set({
        folderId: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(worksheets.folderId, id),
        isNull(worksheets.deletedAt)
      ))

    // Move child folders to root (parentId = null)
    await db
      .update(folders)
      .set({
        parentId: null,
        updatedAt: new Date(),
      })
      .where(and(
        eq(folders.parentId, id),
        isNull(folders.deletedAt)
      ))

    // Soft delete the folder
    await db
      .update(folders)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(folders.id, id))

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Folders Delete] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

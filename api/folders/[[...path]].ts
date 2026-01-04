import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { folders, worksheets } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

// Validation schemas
const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366f1'),
  parentId: z.string().uuid().nullable().optional(),
})

const UpdateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Combined folders endpoint:
 * GET    /api/folders          - List all folders
 * POST   /api/folders          - Create folder
 * GET    /api/folders/[id]     - Get single folder
 * PUT    /api/folders/[id]     - Update folder
 * DELETE /api/folders/[id]     - Delete folder
 */
async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  const { path } = req.query
  const pathSegments = Array.isArray(path) ? path : path ? [path] : []
  const folderId = pathSegments[0] || null

  // Validate folder ID format if provided
  if (folderId && !uuidRegex.test(folderId)) {
    return res.status(400).json({ error: 'Invalid folder ID format' })
  }

  // Route based on path and method
  if (!folderId) {
    // /api/folders
    switch (req.method) {
      case 'GET':
        return handleList(req, res, user)
      case 'POST':
        return handleCreate(req, res, user)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  } else {
    // /api/folders/[id]
    switch (req.method) {
      case 'GET':
        return handleGet(req, res, user, folderId)
      case 'PUT':
      case 'PATCH':
        return handleUpdate(req, res, user, folderId)
      case 'DELETE':
        return handleDelete(req, res, user, folderId)
      default:
        return res.status(405).json({ error: 'Method not allowed' })
    }
  }
}

// GET /api/folders - List all folders for user
async function handleList(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser
) {
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 60,
    windowSeconds: 60,
    identifier: `folders:list:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    const userFolders = await db
      .select({
        id: folders.id,
        name: folders.name,
        color: folders.color,
        parentId: folders.parentId,
        sortOrder: folders.sortOrder,
        createdAt: folders.createdAt,
      })
      .from(folders)
      .where(and(
        eq(folders.userId, user.id),
        isNull(folders.deletedAt)
      ))
      .orderBy(asc(folders.sortOrder), asc(folders.createdAt))

    const worksheetCounts = await db
      .select({ folderId: worksheets.folderId })
      .from(worksheets)
      .where(and(
        eq(worksheets.userId, user.id),
        isNull(worksheets.deletedAt)
      ))

    const countMap = new Map<string | null, number>()
    for (const ws of worksheetCounts) {
      const key = ws.folderId
      countMap.set(key, (countMap.get(key) || 0) + 1)
    }

    const foldersWithCount = userFolders.map(folder => ({
      ...folder,
      worksheetCount: countMap.get(folder.id) || 0,
    }))

    const rootWorksheetCount = countMap.get(null) || 0

    return res.status(200).json({
      folders: foldersWithCount,
      rootWorksheetCount,
    })
  } catch (error) {
    console.error('[Folders List] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// POST /api/folders - Create a new folder
async function handleCreate(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser
) {
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 20,
    windowSeconds: 60,
    identifier: `folders:create:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  const parse = CreateFolderSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const { name, color, parentId } = parse.data

  try {
    if (parentId) {
      const [parent] = await db
        .select({ userId: folders.userId })
        .from(folders)
        .where(and(
          eq(folders.id, parentId),
          isNull(folders.deletedAt)
        ))
        .limit(1)

      if (!parent) {
        return res.status(400).json({ error: 'Parent folder not found' })
      }

      if (parent.userId !== user.id) {
        return res.status(403).json({ error: 'Parent folder access denied' })
      }
    }

    const [maxOrder] = await db
      .select({ maxSort: folders.sortOrder })
      .from(folders)
      .where(and(
        eq(folders.userId, user.id),
        isNull(folders.deletedAt),
        parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId)
      ))
      .orderBy(asc(folders.sortOrder))
      .limit(1)

    const nextSortOrder = (maxOrder?.maxSort || 0) + 1

    const [newFolder] = await db
      .insert(folders)
      .values({
        userId: user.id,
        name,
        color,
        parentId: parentId || null,
        sortOrder: nextSortOrder,
      })
      .returning({
        id: folders.id,
        name: folders.name,
        color: folders.color,
        parentId: folders.parentId,
        sortOrder: folders.sortOrder,
        createdAt: folders.createdAt,
      })

    return res.status(201).json({
      folder: {
        ...newFolder,
        worksheetCount: 0,
      }
    })
  } catch (error) {
    console.error('[Folders Create] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// GET /api/folders/[id] - Get single folder with its worksheets
async function handleGet(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser,
  id: string
) {
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

    if (folder.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

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

  const parse = UpdateFolderSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const updates = parse.data

  try {
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

    if (folder.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    if (updates.parentId !== undefined && updates.parentId !== null) {
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

      if (parent.userId !== user.id) {
        return res.status(403).json({ error: 'Parent folder access denied' })
      }
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.color !== undefined) updateData.color = updates.color
    if (updates.parentId !== undefined) updateData.parentId = updates.parentId
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder

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

    if (folder.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Move worksheets to root
    await db
      .update(worksheets)
      .set({ folderId: null, updatedAt: new Date() })
      .where(and(
        eq(worksheets.folderId, id),
        isNull(worksheets.deletedAt)
      ))

    // Move child folders to root
    await db
      .update(folders)
      .set({ parentId: null, updatedAt: new Date() })
      .where(and(
        eq(folders.parentId, id),
        isNull(folders.deletedAt)
      ))

    // Soft delete
    await db
      .update(folders)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(folders.id, id))

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Folders Delete] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

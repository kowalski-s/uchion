import { Router } from 'express'
import type { Response } from 'express'
import { eq, and, isNull, asc, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { folders, worksheets, subscriptions } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../middleware/auth.js'
import { checkRateLimit } from '../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

const FOLDER_LIMITS = {
  free: 2,
  basic: 10,
  premium: 10,
} as const

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

// ==================== GET /api/folders ====================
router.get('/', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user

  const rateLimitResult = await checkRateLimit(req, {
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
    console.error('[API folders] List error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== POST /api/folders ====================
router.post('/', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user

  const rateLimitResult = await checkRateLimit(req, {
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
    const [subscription] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1)

    const userPlan = subscription?.plan || 'free'
    const folderLimit = FOLDER_LIMITS[userPlan as keyof typeof FOLDER_LIMITS] || FOLDER_LIMITS.free

    const [{ value: folderCount }] = await db
      .select({ value: count() })
      .from(folders)
      .where(and(
        eq(folders.userId, user.id),
        isNull(folders.deletedAt)
      ))

    if (folderCount >= folderLimit) {
      return res.status(403).json({
        error: 'Достигнут лимит папок',
        message: userPlan === 'free'
          ? `Бесплатный тариф позволяет создать до ${folderLimit} папок.`
          : `Достигнут максимальный лимит папок (${folderLimit}).`,
        limit: folderLimit,
        current: folderCount,
      })
    }

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
    console.error('[API folders] Create error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== GET /api/folders/:id ====================
router.get('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid folder ID format' })
  }

  const rateLimitResult = await checkRateLimit(req, {
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
    console.error('[Folders] GET Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== PATCH /api/folders/:id ====================
router.patch('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid folder ID format' })
  }

  const rateLimitResult = await checkRateLimit(req, {
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
    console.error('[Folders] Update Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

// ==================== DELETE /api/folders/:id ====================
router.delete('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user
  const { id } = req.params

  if (!id || !uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid folder ID format' })
  }

  const rateLimitResult = await checkRateLimit(req, {
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
    console.error('[Folders] Delete Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}))

export default router

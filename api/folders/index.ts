import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull, asc, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { folders, worksheets, subscriptions } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

// Folder limits by subscription plan
const FOLDER_LIMITS = {
  free: 2,
  basic: 10,
  premium: 10,
} as const

// Validation schema for creating folder
const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366f1'),
  parentId: z.string().uuid().nullable().optional(),
})

/**
 * /api/folders
 * GET  - List all folders
 * POST - Create new folder
 */
async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {  if (req.method === 'GET') {
    return handleList(req, res, user)
  }

  if (req.method === 'POST') {
    return handleCreate(req, res, user)
  }

  return res.status(405).json({ error: 'Method not allowed' })
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

  try {    const userFolders = await db
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
      .orderBy(asc(folders.sortOrder), asc(folders.createdAt))    // Get worksheet counts per folder
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

    const rootWorksheetCount = countMap.get(null) || 0    return res.status(200).json({
      folders: foldersWithCount,
      rootWorksheetCount,
    })
  } catch (error) {
    console.error('[API folders/index] List error:', error)
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
  }  const parse = CreateFolderSchema.safeParse(req.body)
  if (!parse.success) {    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const { name, color, parentId } = parse.data

  try {
    // Get user's subscription plan
    const [subscription] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(eq(subscriptions.userId, user.id))
      .limit(1)

    const userPlan = subscription?.plan || 'free'
    const folderLimit = FOLDER_LIMITS[userPlan]

    // Count user's existing folders
    const [{ value: folderCount }] = await db
      .select({ value: count() })
      .from(folders)
      .where(and(
        eq(folders.userId, user.id),
        isNull(folders.deletedAt)
      ))

    // Check if limit reached
    if (folderCount >= folderLimit) {      return res.status(403).json({
        error: 'Достигнут лимит папок',
        message: userPlan === 'free'
          ? `Бесплатный тариф позволяет создать до ${folderLimit} папок. Перейдите на платный тариф для создания до 10 папок.`
          : `Достигнут максимальный лимит папок (${folderLimit}). Удалите ненужные папки, чтобы создать новые.`,
        limit: folderLimit,
        current: folderCount,
      })
    }

    // Validate parent folder if provided
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

    // Get next sort order
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
      })    return res.status(201).json({
      folder: {
        ...newFolder,
        worksheetCount: 0,
      }
    })
  } catch (error) {
    console.error('[API folders/index] Create error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

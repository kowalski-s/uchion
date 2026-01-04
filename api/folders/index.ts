import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull, asc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { folders, worksheets } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

// Validation schema for creating a folder
const CreateFolderSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366f1'),
  parentId: z.string().uuid().nullable().optional(),
})

async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  switch (req.method) {
    case 'GET':
      return handleList(req, res, user)
    case 'POST':
      return handleCreate(req, res, user)
    default:
      return res.status(405).json({ error: 'Method not allowed' })
  }
}

// GET /api/folders - List all folders for user
async function handleList(
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser
) {
  // Rate limiting: 60 requests per minute
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
    // Get all folders for user
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

    // Get worksheet counts per folder
    const worksheetCounts = await db
      .select({
        folderId: worksheets.folderId,
      })
      .from(worksheets)
      .where(and(
        eq(worksheets.userId, user.id),
        isNull(worksheets.deletedAt)
      ))

    // Count worksheets per folder
    const countMap = new Map<string | null, number>()
    for (const ws of worksheetCounts) {
      const key = ws.folderId
      countMap.set(key, (countMap.get(key) || 0) + 1)
    }

    // Add worksheet count to each folder
    const foldersWithCount = userFolders.map(folder => ({
      ...folder,
      worksheetCount: countMap.get(folder.id) || 0,
    }))

    // Count worksheets without folder (root level)
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
  // Rate limiting: 20 creates per minute
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

  // Validate input
  const parse = CreateFolderSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: 'Validation error',
      details: parse.error.flatten().fieldErrors,
    })
  }

  const { name, color, parentId } = parse.data

  try {
    // If parentId is provided, verify it exists and belongs to user
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

      // Security: check parent ownership
      if (parent.userId !== user.id) {
        return res.status(403).json({ error: 'Parent folder access denied' })
      }
    }

    // Get max sortOrder for new folder position
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

    // Create folder
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

export default withAuth(handler)

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, isNull, desc, and } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { worksheets } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Rate limiting: 30 requests per minute
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
    // Parse query parameters
    const { folderId, limit: limitStr } = req.query
    const limit = Math.min(parseInt(limitStr as string) || 50, 100)

    // Build WHERE conditions
    const conditions = [
      eq(worksheets.userId, user.id),
      isNull(worksheets.deletedAt),
    ]

    // Filter by folder if specified
    if (folderId === 'null' || folderId === '') {
      // Get worksheets without folder (root level)
      conditions.push(isNull(worksheets.folderId))
    } else if (folderId && typeof folderId === 'string') {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
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
    console.error('[Worksheets Recent] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

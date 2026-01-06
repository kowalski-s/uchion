import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { worksheets } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

/**
 * GET /api/worksheets - List worksheets
 * This is the index handler for the base /api/worksheets route
 */
async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

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

    console.log('[API worksheets/index] Fetching worksheets for user:', user.id)
    console.log('[API worksheets/index] Query params - folderId:', folderId, 'limit:', limit)

    const conditions = [
      eq(worksheets.userId, user.id),
      isNull(worksheets.deletedAt),
    ]

    // Only filter by folderId if explicitly provided
    // Don't filter when getting general list
    if (folderId === 'null' || folderId === '') {
      console.log('[API worksheets/index] Filter: folderId IS NULL (root folder)')
      conditions.push(isNull(worksheets.folderId))
    } else if (folderId && typeof folderId === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(folderId)) {
        console.log('[API worksheets/index] Filter: folderId =', folderId)
        conditions.push(eq(worksheets.folderId, folderId))
      }
    } else {
      console.log('[API worksheets/index] No folderId filter - returning ALL worksheets')
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

    console.log('[API worksheets/index] Found worksheets:', userWorksheets.length)

    return res.status(200).json({ worksheets: userWorksheets })
  } catch (error) {
    console.error('[API worksheets/index] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

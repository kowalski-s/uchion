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
  const rateLimitResult = checkRateLimit(req, { maxRequests: 30, windowSeconds: 60 })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    const userWorksheets = await db
      .select({
        id: worksheets.id,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        createdAt: worksheets.createdAt,
      })
      .from(worksheets)
      .where(and(
        eq(worksheets.userId, user.id),
        isNull(worksheets.deletedAt)
      ))
      .orderBy(desc(worksheets.createdAt))
      .limit(5)

    return res.status(200).json({ worksheets: userWorksheets })
  } catch (error) {
    console.error('[Worksheets Recent] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

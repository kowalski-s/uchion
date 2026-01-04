import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { worksheets } from '../../db/schema.js'
import { withAuth, type AuthUser } from '../_lib/auth/middleware.js'
import { checkRateLimit } from '../_lib/auth/rate-limit.js'

async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Worksheet ID required' })
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return res.status(400).json({ error: 'Invalid worksheet ID format' })
  }

  // Rate limiting: 10 deletions per minute
  const rateLimitResult = checkRateLimit(req, { maxRequests: 10, windowSeconds: 60 })
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

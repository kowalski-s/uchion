import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { worksheets } from '../../../db/schema.js'
import { withAuth, type AuthUser } from '../../_lib/auth/middleware.js'
import { checkRateLimit } from '../../_lib/auth/rate-limit.js'

// POST /api/worksheets/[id]/duplicate - Create a copy of an existing worksheet
async function handler(req: VercelRequest, res: VercelResponse, user: AuthUser) {
  if (req.method !== 'POST') {
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

  // Rate limiting: 10 duplicates per minute
  const rateLimitResult = checkRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `worksheet:duplicate:${user.id}`,
  })
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests' })
  }

  try {
    // Get the original worksheet
    const [original] = await db
      .select({
        userId: worksheets.userId,
        folderId: worksheets.folderId,
        title: worksheets.title,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        difficulty: worksheets.difficulty,
        content: worksheets.content,
      })
      .from(worksheets)
      .where(and(
        eq(worksheets.id, id),
        isNull(worksheets.deletedAt)
      ))
      .limit(1)

    if (!original) {
      return res.status(404).json({ error: 'Worksheet not found' })
    }

    // Security: check ownership
    if (original.userId !== user.id) {
      return res.status(403).json({ error: 'Access denied' })
    }

    // Create the copy with "(копия)" suffix
    const originalTitle = original.title || original.topic
    const copyTitle = `${originalTitle} (копия)`

    const [newWorksheet] = await db
      .insert(worksheets)
      .values({
        userId: user.id,
        folderId: original.folderId, // Same folder as original
        title: copyTitle,
        subject: original.subject,
        grade: original.grade,
        topic: original.topic,
        difficulty: original.difficulty,
        content: original.content,
      })
      .returning({
        id: worksheets.id,
        folderId: worksheets.folderId,
        title: worksheets.title,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        difficulty: worksheets.difficulty,
        createdAt: worksheets.createdAt,
      })

    return res.status(201).json({
      worksheet: newWorksheet,
    })
  } catch (error) {
    console.error('[Worksheets Duplicate] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export default withAuth(handler)

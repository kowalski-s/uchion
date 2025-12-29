import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { getTokenFromCookie, ACCESS_TOKEN_COOKIE } from '../_lib/auth/cookies.js'
import { verifyAccessToken } from '../_lib/auth/tokens.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get access token from cookie
    const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE)

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    // Verify token
    const payload = verifyAccessToken(token)

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Get user from database with full details
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        generationsLeft: users.generationsLeft,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1)

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    return res.status(200).json({ user })
  } catch (error) {
    console.error('[Auth Me] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

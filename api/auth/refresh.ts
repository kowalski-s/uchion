import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import {
  getTokenFromCookie,
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '../_lib/auth/cookies.js'
import {
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken,
  revokeRefreshToken,
} from '../_lib/auth/tokens.js'
import { checkRefreshRateLimit } from '../_lib/auth/rate-limit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Apply rate limiting
  const rateLimitResult = checkRefreshRateLimit(req)
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many refresh attempts' })
  }

  try {
    // Get refresh token from cookie
    const refreshToken = getTokenFromCookie(req, REFRESH_TOKEN_COOKIE)

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token' })
    }

    // Verify refresh token (checks signature and database)
    const payload = await verifyRefreshToken(refreshToken)

    if (!payload) {
      clearAuthCookies(res)
      return res.status(401).json({ error: 'Invalid or expired token' })
    }

    // Get user from database
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1)

    if (!user) {
      clearAuthCookies(res)
      return res.status(401).json({ error: 'User not found' })
    }

    // Revoke old refresh token (token rotation)
    await revokeRefreshToken(payload.jti)

    // Create new tokens
    const newAccessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
    const newRefreshToken = await createRefreshToken(user.id)

    // Set new cookies
    setAuthCookies(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Refresh] Error:', error)
    clearAuthCookies(res)
    return res.status(401).json({ error: 'Token refresh failed' })
  }
}

import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  getTokenFromCookie,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from '../_lib/auth/cookies.js'
import { decodeRefreshToken, revokeRefreshToken } from '../_lib/auth/tokens.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Get refresh token and revoke it in database
    const refreshToken = getTokenFromCookie(req, REFRESH_TOKEN_COOKIE)

    if (refreshToken) {
      const payload = decodeRefreshToken(refreshToken)
      if (payload?.jti) {
        await revokeRefreshToken(payload.jti)
      }
    }

    // Clear all auth cookies
    clearAuthCookies(res)

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Logout] Error:', error)
    // Still clear cookies even if revocation fails
    clearAuthCookies(res)
    return res.status(200).json({ success: true })
  }
}

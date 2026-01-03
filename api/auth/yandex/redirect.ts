import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateState, generatePKCE, buildYandexAuthUrl } from '../../_lib/auth/oauth.js'
import { setOAuthStateCookie, setPKCECookie } from '../../_lib/auth/cookies.js'
import { checkOAuthRedirectRateLimit } from '../../_lib/auth/rate-limit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Apply rate limiting
  const rateLimitResult = checkOAuthRedirectRateLimit(req)
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    console.warn('[Yandex OAuth] Rate limit exceeded on redirect')
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .json({ error: 'Too many requests. Please try again later.' })
  }

  try {
    const clientId = process.env.YANDEX_CLIENT_ID
    const appUrl = process.env.APP_URL

    if (!clientId) {
      console.error('[Yandex OAuth] YANDEX_CLIENT_ID not configured')
      return res.status(500).json({ error: 'OAuth not configured' })
    }

    if (!appUrl) {
      console.error('[Yandex OAuth] APP_URL not configured')
      return res.status(500).json({ error: 'OAuth not configured' })
    }

    // Generate CSRF protection state
    const state = generateState()

    // Generate PKCE challenge
    const { codeVerifier, codeChallenge } = generatePKCE()

    // Store state and code verifier in secure cookies
    setOAuthStateCookie(res, state)
    setPKCECookie(res, codeVerifier)

    // Build authorization URL
    const redirectUri = `${appUrl}/api/auth/yandex/callback`
    const authUrl = buildYandexAuthUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    })

    // Redirect to Yandex
    return res.redirect(302, authUrl)
  } catch (error) {
    console.error('[Yandex OAuth] Redirect error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

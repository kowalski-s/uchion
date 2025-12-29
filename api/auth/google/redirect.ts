import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateState, generatePKCE, buildGoogleAuthUrl } from '../../_lib/auth/oauth.js'
import { setOAuthStateCookie, setPKCECookie } from '../../_lib/auth/cookies.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const appUrl = process.env.APP_URL

    if (!clientId) {
      console.error('[Google OAuth] GOOGLE_CLIENT_ID not configured')
      return res.status(500).json({ error: 'OAuth not configured' })
    }

    if (!appUrl) {
      console.error('[Google OAuth] APP_URL not configured')
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
    const redirectUri = `${appUrl}/api/auth/google/callback`
    const authUrl = buildGoogleAuthUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge,
    })

    // Redirect to Google
    return res.redirect(302, authUrl)
  } catch (error) {
    console.error('[Google OAuth] Redirect error:', error)
    return res.status(500).json({ error: 'Authentication failed' })
  }
}

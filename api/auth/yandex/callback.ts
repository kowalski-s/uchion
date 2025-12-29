import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { exchangeYandexCode } from '../../_lib/auth/oauth.js'
import { createAccessToken, createRefreshToken } from '../../_lib/auth/tokens.js'
import {
  getStateCookie,
  getPKCECookie,
  setAuthCookies,
  clearOAuthCookies,
} from '../../_lib/auth/cookies.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appUrl = process.env.APP_URL || ''

  try {
    const { code, state, error: oauthError } = req.query

    // Check for OAuth errors
    if (oauthError) {
      console.error('[Yandex OAuth] Provider error:', oauthError)
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=oauth_error`)
    }

    // Validate code and state are present
    if (!code || typeof code !== 'string') {
      console.error('[Yandex OAuth] Missing authorization code')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    if (!state || typeof state !== 'string') {
      console.error('[Yandex OAuth] Missing state parameter')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    // Validate state (CSRF protection)
    const storedState = getStateCookie(req)
    if (!storedState || state !== storedState) {
      console.error('[Yandex OAuth] State mismatch - possible CSRF attack')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_state`)
    }

    // Get PKCE code verifier
    const codeVerifier = getPKCECookie(req)
    if (!codeVerifier) {
      console.error('[Yandex OAuth] Missing PKCE code verifier')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    // Get OAuth credentials
    const clientId = process.env.YANDEX_CLIENT_ID
    const clientSecret = process.env.YANDEX_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[Yandex OAuth] Missing OAuth credentials')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=configuration_error`)
    }

    // Exchange code for tokens and get user info
    const oauthUser = await exchangeYandexCode({
      code,
      clientId,
      clientSecret,
      codeVerifier,
    })

    // Find or create user
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, oauthUser.email.toLowerCase()))
      .limit(1)

    if (!user) {
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email: oauthUser.email.toLowerCase(),
          name: oauthUser.name,
          image: oauthUser.image,
          provider: 'yandex',
          providerId: oauthUser.providerId,
          role: 'user',
          generationsLeft: 3,
        })
        .returning()

      user = newUser
    } else if (!user.provider) {
      // Update existing user with OAuth info (linking)
      await db
        .update(users)
        .set({
          provider: 'yandex',
          providerId: oauthUser.providerId,
          image: user.image || oauthUser.image,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
    }

    // Create tokens
    const accessToken = createAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
    const refreshToken = await createRefreshToken(user.id)

    // Set auth cookies and clear OAuth cookies
    setAuthCookies(res, { accessToken, refreshToken })
    clearOAuthCookies(res)

    // Redirect to app
    return res.redirect(302, appUrl || '/')
  } catch (error) {
    console.error('[Yandex OAuth] Callback error:', error)
    clearOAuthCookies(res)
    return res.redirect(302, `${appUrl}/login?error=authentication_failed`)
  }
}

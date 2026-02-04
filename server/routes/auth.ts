import { Router } from 'express'
import type { Request, Response } from 'express'
import crypto from 'crypto'
import { eq, and, isNull, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users, subscriptions } from '../../db/schema.js'
import {
  getTokenFromCookie,
  setAuthCookies,
  clearAuthCookies,
  clearOAuthCookies,
  setOAuthStateCookie,
  setPKCECookie,
  getStateCookie,
  getPKCECookie,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from '../middleware/cookies.js'
import {
  verifyAccessToken,
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken,
  revokeRefreshToken,
  decodeRefreshToken,
  getTokenFamilyId,
} from '../../api/_lib/auth/tokens.js'
import {
  generateState,
  generatePKCE,
  buildYandexAuthUrl,
  exchangeYandexCode,
  validateState,
} from '../../api/_lib/auth/oauth.js'
import {
  checkAuthRateLimit,
  requireMeRateLimit,
  requireRefreshRateLimit,
  requireOAuthRedirectRateLimit,
} from '../middleware/rate-limit.js'
import { ApiError } from '../middleware/error-handler.js'
import {
  logOAuthCallbackSuccess,
  logOAuthCallbackFailed,
  logRateLimitExceeded,
  logCsrfDetected,
  logInvalidSignature,
  logExpiredAuth,
} from '../middleware/audit-log.js'

const router = Router()

// ==================== GET /api/auth/me ====================
router.get('/me', async (req: Request, res: Response) => {
  await requireMeRateLimit(req)

  const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE)

  if (!token) {
    throw ApiError.unauthorized('Not authenticated')
  }

  const payload = verifyAccessToken(token)

  if (!payload) {
    throw ApiError.unauthorized('Invalid or expired token')
  }

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
    .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
    .limit(1)

  if (!user) {
    throw ApiError.unauthorized('User not found or deactivated')
  }

  const [subscription] = await db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      expiresAt: subscriptions.expiresAt,
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, payload.sub))
    .limit(1)

  return res.status(200).json({
    user: {
      ...user,
      subscription: subscription || { plan: 'free', status: 'active', expiresAt: null }
    }
  })
})

// ==================== POST /api/auth/logout ====================
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const refreshToken = getTokenFromCookie(req, REFRESH_TOKEN_COOKIE)

    if (refreshToken) {
      const payload = decodeRefreshToken(refreshToken)
      if (payload?.jti) {
        await revokeRefreshToken(payload.jti)
      }
    }

    clearAuthCookies(res)

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error('[Logout] Error:', error)
    clearAuthCookies(res)
    return res.status(200).json({ success: true })
  }
})

// ==================== POST /api/auth/refresh ====================
router.post('/refresh', async (req: Request, res: Response) => {
  await requireRefreshRateLimit(req)

  try {
    const refreshToken = getTokenFromCookie(req, REFRESH_TOKEN_COOKIE)

    if (!refreshToken) {
      throw ApiError.unauthorized('No refresh token')
    }

    const payload = await verifyRefreshToken(refreshToken)

    if (!payload) {
      clearAuthCookies(res)
      throw ApiError.unauthorized('Invalid or expired token')
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
      .limit(1)

    if (!user) {
      clearAuthCookies(res)
      throw ApiError.unauthorized('User not found')
    }

    // Get family ID before revoking, so the new token inherits it
    const familyId = await getTokenFamilyId(payload.jti)
    await revokeRefreshToken(payload.jti)

    const newAccessToken = createAccessToken({
      userId: user.id,
      role: user.role,
    })
    const newRefreshToken = await createRefreshToken(user.id, familyId || undefined)

    setAuthCookies(res, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    })

    return res.status(200).json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) {
      // clearAuthCookies already called before the throw in the cases above
      throw error
    }
    console.error('[Refresh] Error:', error)
    clearAuthCookies(res)
    throw ApiError.unauthorized('Token refresh failed')
  }
})

// ==================== GET /api/auth/yandex/redirect ====================
router.get('/yandex/redirect', async (req: Request, res: Response) => {
  await requireOAuthRedirectRateLimit(req)

  const clientId = process.env.YANDEX_CLIENT_ID
  const appUrl = process.env.APP_URL

  if (!clientId) {
    console.error('[Yandex OAuth] YANDEX_CLIENT_ID not configured')
    throw ApiError.internal('OAuth not configured')
  }

  if (!appUrl) {
    console.error('[Yandex OAuth] APP_URL not configured')
    throw ApiError.internal('OAuth not configured')
  }

  const state = generateState()
  const { codeVerifier, codeChallenge } = generatePKCE()

  setOAuthStateCookie(res, state)
  setPKCECookie(res, codeVerifier)

  const redirectUri = `${appUrl}/api/auth/yandex/callback`
  const authUrl = buildYandexAuthUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
  })

  return res.redirect(302, authUrl)
})

// ==================== GET /api/auth/yandex/callback ====================
// OAuth callbacks use redirects, not JSON -- keep inline error handling
router.get('/yandex/callback', async (req: Request, res: Response) => {
  const appUrl = process.env.APP_URL || ''

  const rateLimitResult = await checkAuthRateLimit(req)
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    logRateLimitExceeded(req, '/api/auth/yandex/callback')
    clearOAuthCookies(res)
    return res.redirect(302, `${appUrl}/login?error=rate_limit_exceeded`)
  }

  try {
    const { code, state, error: oauthError } = req.query

    if (oauthError) {
      console.error('[Yandex OAuth] Provider error:', oauthError)
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=oauth_error`)
    }

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

    const storedState = getStateCookie(req)
    if (!storedState) {
      logCsrfDetected(req, 'yandex', { provided_state: state, expected_state: null })
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_state`)
    }

    const stateBuffer = Buffer.from(state, 'utf8')
    const storedBuffer = Buffer.from(storedState, 'utf8')
    const statesMatch = stateBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(stateBuffer, storedBuffer)

    if (!statesMatch) {
      logCsrfDetected(req, 'yandex', { provided_state: state, expected_state: storedState })
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_state`)
    }

    if (!validateState(storedState)) {
      console.error('[Yandex OAuth] State expired or invalid format')
      logCsrfDetected(req, 'yandex', { state: storedState, reason: 'expired_or_invalid' })
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_state`)
    }

    const codeVerifier = getPKCECookie(req)
    if (!codeVerifier) {
      console.error('[Yandex OAuth] Missing PKCE code verifier')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    const clientId = process.env.YANDEX_CLIENT_ID
    const clientSecret = process.env.YANDEX_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[Yandex OAuth] Missing OAuth credentials')
      clearOAuthCookies(res)
      return res.redirect(302, `${appUrl}/login?error=configuration_error`)
    }

    const oauthUser = await exchangeYandexCode({
      code,
      clientId,
      clientSecret,
      codeVerifier,
    })

    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, oauthUser.email.toLowerCase()))
      .limit(1)

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: oauthUser.email.toLowerCase(),
          name: oauthUser.name,
          image: oauthUser.image,
          provider: 'yandex',
          providerId: oauthUser.providerId,
          role: 'user',
          generationsLeft: 5,
        })
        .returning()

      user = newUser
    } else if (!user.provider) {
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

    const accessToken = createAccessToken({
      userId: user.id,
      role: user.role,
    })
    const refreshToken = await createRefreshToken(user.id)

    setAuthCookies(res, { accessToken, refreshToken })
    clearOAuthCookies(res)

    logOAuthCallbackSuccess(req, user.id, user.email, 'yandex')

    return res.redirect(302, appUrl || '/')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logOAuthCallbackFailed(req, errorMessage, 'yandex')
    console.error('[Yandex OAuth] Callback error:', error)
    clearOAuthCookies(res)
    return res.redirect(302, `${appUrl}/login?error=authentication_failed`)
  }
})

// ==================== GET /api/auth/telegram/redirect ====================
// Redirects user to oauth.telegram.org for authentication
router.get('/telegram/redirect', async (req: Request, res: Response) => {
  await requireOAuthRedirectRateLimit(req)

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.APP_URL

  if (!botToken) {
    console.error('[Telegram OAuth] TELEGRAM_BOT_TOKEN not configured')
    throw ApiError.internal('OAuth not configured')
  }

  if (!appUrl) {
    console.error('[Telegram OAuth] APP_URL not configured')
    throw ApiError.internal('OAuth not configured')
  }

  // Extract bot_id from token (first part before colon)
  const botId = botToken.split(':')[0]
  if (!botId || !/^\d+$/.test(botId)) {
    console.error('[Telegram OAuth] Invalid bot token format')
    throw ApiError.internal('OAuth not configured')
  }

  // Generate state for CSRF protection (same mechanism as Yandex)
  const state = generateState()
  setOAuthStateCookie(res, state)

  // Build oauth.telegram.org URL
  // return_to includes state in query param for validation
  const returnTo = `${appUrl}/auth/telegram/callback?state=${encodeURIComponent(state)}`
  const authUrl = new URL('https://oauth.telegram.org/auth')
  authUrl.searchParams.set('bot_id', botId)
  authUrl.searchParams.set('origin', appUrl)
  authUrl.searchParams.set('return_to', returnTo)
  authUrl.searchParams.set('request_access', 'write')
  authUrl.searchParams.set('embed', '0')

  return res.redirect(302, authUrl.toString())
})

// ==================== POST /api/auth/telegram/callback ====================
// Receives auth data from client after parsing hash fragment from oauth.telegram.org
router.post('/telegram/callback', async (req: Request, res: Response) => {
  const rateLimitResult = await checkAuthRateLimit(req)
  if (!rateLimitResult.success) {
    logRateLimitExceeded(req, '/api/auth/telegram/callback')
    throw ApiError.tooManyRequests('Rate limit exceeded')
  }

  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const appUrl = process.env.APP_URL

    if (!botToken) {
      console.error('[Telegram OAuth] TELEGRAM_BOT_TOKEN not configured')
      throw ApiError.internal('OAuth not configured')
    }

    // Validate Origin header for CSRF protection
    const origin = req.headers.origin
    if (appUrl && origin) {
      const expectedOrigin = new URL(appUrl).origin
      if (origin !== expectedOrigin) {
        console.error('[Telegram OAuth] Origin mismatch:', { origin, expected: expectedOrigin })
        throw ApiError.forbidden('Invalid origin')
      }
    }

    // Validate state from cookie (CSRF protection)
    const { state: providedState } = req.body
    const storedState = getStateCookie(req)

    if (!storedState || !providedState) {
      logCsrfDetected(req, 'telegram', { provided_state: providedState, expected_state: storedState })
      throw ApiError.badRequest('Invalid state')
    }

    const stateBuffer = Buffer.from(String(providedState), 'utf8')
    const storedBuffer = Buffer.from(storedState, 'utf8')
    const statesMatch = stateBuffer.length === storedBuffer.length &&
      crypto.timingSafeEqual(stateBuffer, storedBuffer)

    if (!statesMatch) {
      logCsrfDetected(req, 'telegram', { provided_state: providedState, expected_state: storedState })
      throw ApiError.badRequest('Invalid state')
    }

    if (!validateState(storedState)) {
      console.error('[Telegram OAuth] State expired or invalid format')
      logCsrfDetected(req, 'telegram', { state: storedState, reason: 'expired_or_invalid' })
      throw ApiError.badRequest('State expired')
    }

    // Clear OAuth cookies after validation
    clearOAuthCookies(res)

    // Extract and validate auth data from request body
    const { hash, auth_date, id, first_name, last_name, username, photo_url } = req.body

    if (!hash || typeof hash !== 'string') {
      console.error('[Telegram OAuth] Missing hash parameter')
      throw ApiError.badRequest('Missing hash')
    }

    if (!auth_date) {
      console.error('[Telegram OAuth] Missing auth_date parameter')
      throw ApiError.badRequest('Missing auth_date')
    }

    if (!id) {
      console.error('[Telegram OAuth] Missing id parameter')
      throw ApiError.badRequest('Missing id')
    }

    // Validate auth_date (not older than 5 minutes)
    const authTimestamp = parseInt(String(auth_date), 10)
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const MAX_AGE_SECONDS = 5 * 60

    if (isNaN(authTimestamp) || currentTimestamp - authTimestamp > MAX_AGE_SECONDS) {
      logExpiredAuth(req, 'telegram', { auth_date: authTimestamp, current_time: currentTimestamp })
      throw ApiError.badRequest('Authentication expired')
    }

    // Build data check string for hash verification
    const dataCheckParams: Record<string, string> = {}

    dataCheckParams.auth_date = String(auth_date)
    if (first_name) dataCheckParams.first_name = String(first_name)
    dataCheckParams.id = String(id)
    if (last_name) dataCheckParams.last_name = String(last_name)
    if (photo_url) dataCheckParams.photo_url = String(photo_url)
    if (username) dataCheckParams.username = String(username)

    const dataCheckString = Object.keys(dataCheckParams)
      .sort()
      .map(key => `${key}=${dataCheckParams[key]}`)
      .join('\n')

    // Compute expected hash: HMAC-SHA256(SHA256(bot_token), data_check_string)
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest()

    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    // Timing-safe comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex')
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex')

    if (hashBuffer.length !== calculatedBuffer.length ||
        !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      logInvalidSignature(req, 'telegram', { telegram_id: String(id) })
      throw ApiError.badRequest('Invalid signature')
    }

    // Create or find user
    const telegramId = String(id)
    const name = [first_name || '', last_name || ''].filter(Boolean).join(' ') || null
    const photoUrl = typeof photo_url === 'string' ? photo_url : null

    const email = typeof username === 'string' && username
      ? `${username}@telegram`
      : `${telegramId}@telegram`

    let [user] = await db
      .select()
      .from(users)
      .where(
        or(
          and(
            eq(users.provider, 'telegram'),
            eq(users.providerId, telegramId)
          ),
          eq(users.email, email.toLowerCase())
        )
      )
      .limit(1)

    if (!user) {
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name,
          image: photoUrl,
          provider: 'telegram',
          providerId: telegramId,
          role: 'user',
          generationsLeft: 5,
        })
        .returning()

      user = newUser
    } else if (user.provider !== 'telegram') {
      await db
        .update(users)
        .set({
          provider: 'telegram',
          providerId: telegramId,
          image: user.image || photoUrl,
          name: user.name || name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id))
    }

    // Create JWT tokens
    const accessToken = createAccessToken({
      userId: user.id,
      role: user.role,
    })
    const refreshToken = await createRefreshToken(user.id)

    setAuthCookies(res, { accessToken, refreshToken })

    logOAuthCallbackSuccess(req, user.id, user.email, 'telegram')

    return res.status(200).json({ success: true })
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logOAuthCallbackFailed(req, errorMessage, 'telegram')
    console.error('[Telegram OAuth] Callback error:', error)
    throw ApiError.internal('Authentication failed')
  }
})

export default router

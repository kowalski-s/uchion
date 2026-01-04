import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { eq, or, and } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { createAccessToken, createRefreshToken } from '../../_lib/auth/tokens.js'
import { setAuthCookies } from '../../_lib/auth/cookies.js'
import { checkAuthRateLimit } from '../../_lib/auth/rate-limit.js'
import {
  logOAuthCallbackSuccess,
  logOAuthCallbackFailed,
  logRateLimitExceeded,
  logInvalidSignature,
  logExpiredAuth,
} from '../../_lib/auth/audit-log.js'

/**
 * Telegram Login Widget callback handler
 *
 * Security measures:
 * - HMAC-SHA256 signature verification
 * - auth_date freshness check (max 5 minutes)
 * - Bot token never exposed to client
 *
 * @see https://core.telegram.org/widgets/login#checking-authorization
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const appUrl = process.env.APP_URL || ''

  // Apply rate limiting
  const rateLimitResult = checkAuthRateLimit(req)
  if (!rateLimitResult.success) {
    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    logRateLimitExceeded(req, '/api/auth/telegram/callback')
    return res
      .status(429)
      .setHeader('Retry-After', retryAfter.toString())
      .redirect(302, `${appUrl}/login?error=rate_limit_exceeded`)
  }

  try {
    // Get Telegram bot token
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      console.error('[Telegram Login] TELEGRAM_BOT_TOKEN not configured')
      return res.redirect(302, `${appUrl}/login?error=configuration_error`)
    }

    // Extract Telegram Login data from query parameters
    const { hash, auth_date, id, first_name, last_name, username, photo_url } = req.query

    // Validate required fields
    if (!hash || typeof hash !== 'string') {
      console.error('[Telegram Login] Missing hash parameter')
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    if (!auth_date || typeof auth_date !== 'string') {
      console.error('[Telegram Login] Missing auth_date parameter')
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    if (!id || typeof id !== 'string') {
      console.error('[Telegram Login] Missing id parameter')
      return res.redirect(302, `${appUrl}/login?error=invalid_request`)
    }

    // Check auth_date freshness (max 5 minutes)
    const authTimestamp = parseInt(auth_date, 10)
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const MAX_AGE_SECONDS = 5 * 60 // 5 minutes

    if (currentTimestamp - authTimestamp > MAX_AGE_SECONDS) {
      logExpiredAuth(req, 'telegram', { auth_date: authTimestamp, current_time: currentTimestamp })
      return res.redirect(302, `${appUrl}/login?error=authentication_expired`)
    }

    // Prepare data_check_string (all params except hash, sorted alphabetically)
    const dataCheckParams: Record<string, string> = {}

    if (auth_date) dataCheckParams.auth_date = String(auth_date)
    if (first_name && typeof first_name === 'string') dataCheckParams.first_name = first_name
    if (id) dataCheckParams.id = String(id)
    if (last_name && typeof last_name === 'string') dataCheckParams.last_name = last_name
    if (photo_url && typeof photo_url === 'string') dataCheckParams.photo_url = photo_url
    if (username && typeof username === 'string') dataCheckParams.username = username

    // Sort keys alphabetically and create data_check_string
    const dataCheckString = Object.keys(dataCheckParams)
      .sort()
      .map(key => `${key}=${dataCheckParams[key]}`)
      .join('\n')

    // Verify hash using HMAC-SHA256
    // Step 1: secret_key = SHA256(bot_token) for Telegram Login Widget
    // NOTE: This is different from Telegram Web App which uses HMAC(WebAppData, token)
    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest()

    // Step 2: hash = HMAC-SHA256(secret_key, data_check_string)
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex')

    // Step 3: Compare hashes using timing-safe comparison
    const hashBuffer = Buffer.from(hash, 'hex')
    const calculatedBuffer = Buffer.from(calculatedHash, 'hex')

    if (hashBuffer.length !== calculatedBuffer.length ||
        !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
      logInvalidSignature(req, 'telegram', { telegram_id: String(id) })
      return res.redirect(302, `${appUrl}/login?error=invalid_signature`)
    }

    // Hash is valid, proceed with authentication
    const telegramId = String(id)
    const name = [first_name || '', last_name || ''].filter(Boolean).join(' ') || null
    const photoUrl = typeof photo_url === 'string' ? photo_url : null

    // Find user by providerId (telegram ID) or email (if username)
    // Telegram doesn't always provide email, so we'll use username@telegram or just providerId
    const email = typeof username === 'string' && username
      ? `${username}@telegram`
      : `${telegramId}@telegram`

    // Try to find existing user by provider ID or email
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
      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          email: email.toLowerCase(),
          name,
          image: photoUrl,
          provider: 'telegram',
          providerId: telegramId,
          role: 'user',
          generationsLeft: 3,
        })
        .returning()

      user = newUser
    } else if (user.provider !== 'telegram') {
      // Update existing user with Telegram info (account linking)
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
      email: user.email,
      role: user.role,
    })
    const refreshToken = await createRefreshToken(user.id)

    // Set auth cookies
    setAuthCookies(res, { accessToken, refreshToken })

    // Log successful authentication
    logOAuthCallbackSuccess(req, user.id, user.email, 'telegram')

    // Redirect to app
    return res.redirect(302, appUrl || '/')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logOAuthCallbackFailed(req, errorMessage, 'telegram')
    console.error('[Telegram Login] Callback error:', error)
    return res.redirect(302, `${appUrl}/login?error=authentication_failed`)
  }
}

import type { Request, Response } from 'express'
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible'
import { getRedisClient, secondsUntilMidnightMSK } from '../lib/redis.js'
import { ApiError } from './error-handler.js'
import type { AuthenticatedRequest } from '../types.js'

// ==================== RATE LIMITER SETUP ====================

// Cache created limiters to avoid recreating on every request
const limiterCache = new Map<string, RateLimiterAbstract>()

function createLimiter(keyPrefix: string, points: number, duration: number): RateLimiterAbstract {
  const cacheKey = `${keyPrefix}:${points}:${duration}`
  const cached = limiterCache.get(cacheKey)
  if (cached) return cached

  const redis = getRedisClient()
  let limiter: RateLimiterAbstract

  if (redis) {
    limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix,
      points,
      duration,
      insuranceLimiter: new RateLimiterMemory({
        keyPrefix: `mem:${keyPrefix}`,
        points,
        duration,
      }),
    })
  } else {
    console.warn(`[RateLimit] Redis unavailable, using in-memory limiter for: ${keyPrefix}`)
    limiter = new RateLimiterMemory({
      keyPrefix,
      points,
      duration,
    })
  }

  limiterCache.set(cacheKey, limiter)
  return limiter
}

// ==================== TYPES ====================

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // timestamp ms
}

// ==================== IP EXTRACTION ====================

/**
 * Get client IP from request.
 * Relies on Express `trust proxy` setting for correct X-Forwarded-For handling.
 */
export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown'
}

// ==================== HELPER ====================

async function consumeLimit(
  limiter: RateLimiterAbstract,
  key: string
): Promise<RateLimitResult> {
  try {
    const res = await limiter.consume(key, 1)
    return {
      success: true,
      limit: limiter.points,
      remaining: res.remainingPoints,
      reset: Date.now() + res.msBeforeNext,
    }
  } catch (rejRes: unknown) {
    const rej = rejRes as { remainingPoints?: number; msBeforeNext?: number }
    return {
      success: false,
      limit: limiter.points,
      remaining: rej.remainingPoints ?? 0,
      reset: Date.now() + (rej.msBeforeNext ?? 60000),
    }
  }
}

// ==================== GENERIC RATE LIMIT ====================

interface RateLimitOptions {
  maxRequests?: number
  windowSeconds?: number
  identifier?: string
}

/**
 * Generic rate limit check with custom options.
 * Used by admin, folders, worksheets routes with per-endpoint configs.
 */
export async function checkRateLimit(
  req: Request,
  options: RateLimitOptions = {}
): Promise<RateLimitResult> {
  const {
    maxRequests = 5,
    windowSeconds = 60,
    identifier,
  } = options

  const key = identifier || getClientIp(req)
  // Use identifier prefix for caching (e.g., "admin:stats" from "admin:stats:userId")
  const prefix = `rl:${key.replace(/:[^:]+$/, '')}`
  const limiter = createLimiter(prefix, maxRequests, windowSeconds)
  return consumeLimit(limiter, key)
}

/**
 * Like checkRateLimit, but throws ApiError.tooManyRequests on failure.
 * Eliminates the 5-line boilerplate pattern in every route handler.
 */
export async function requireRateLimit(
  req: Request,
  options: RateLimitOptions = {}
): Promise<void> {
  const result = await checkRateLimit(req, options)
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
    throw ApiError.tooManyRequests('Too many requests', retryAfter)
  }
}

/**
 * Wraps a dedicated rate limit check function and throws on failure.
 */
async function requireDedicated(
  checkFn: () => Promise<RateLimitResult>,
  message = 'Too many requests'
): Promise<void> {
  const result = await checkFn()
  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
    throw ApiError.tooManyRequests(message, retryAfter)
  }
}

// ==================== DEDICATED LIMITERS ====================

export async function checkAuthRateLimit(req: Request): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:auth', 10, 5 * 60)
  return consumeLimit(limiter, getClientIp(req))
}

export async function checkOAuthRedirectRateLimit(req: Request): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:oauth', 20, 10 * 60)
  return consumeLimit(limiter, getClientIp(req))
}

export async function checkMeRateLimit(req: Request): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:me', 60, 60)
  return consumeLimit(limiter, getClientIp(req))
}

export async function checkRefreshRateLimit(req: Request): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:refresh', 10, 60)
  return consumeLimit(limiter, getClientIp(req))
}

export async function checkGenerateRateLimit(
  req: Request,
  userId: string
): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:gen:user', 20, 60 * 60)
  return consumeLimit(limiter, userId)
}

export async function checkEmailSendCodeRateLimit(req: Request, email: string): Promise<RateLimitResult> {
  // 3 requests per 10 minutes per email
  const limiter = createLimiter('rl:email:send', 3, 10 * 60)
  return consumeLimit(limiter, email.toLowerCase())
}

export async function checkEmailVerifyCodeRateLimit(req: Request, email?: string): Promise<RateLimitResult> {
  // 10 attempts per 10 minutes per IP
  const ipLimiter = createLimiter('rl:email:verify:ip', 10, 10 * 60)
  const ipResult = await consumeLimit(ipLimiter, getClientIp(req))
  if (!ipResult.success) return ipResult

  // 10 attempts per 10 minutes per email (prevents distributed brute-force)
  if (email) {
    const emailLimiter = createLimiter('rl:email:verify:email', 10, 10 * 60)
    const emailResult = await consumeLimit(emailLimiter, email.toLowerCase())
    if (!emailResult.success) return emailResult
  }

  return ipResult
}

export async function checkBillingCreateLinkRateLimit(
  req: Request,
  userId: string
): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:bill:link', 10, 10 * 60)
  return consumeLimit(limiter, userId)
}

export async function checkBillingWebhookRateLimit(req: Request): Promise<RateLimitResult> {
  const limiter = createLimiter('rl:bill:wh', 100, 60)
  return consumeLimit(limiter, getClientIp(req))
}

// ==================== THROWING VARIANTS OF DEDICATED LIMITERS ====================

export async function requireAuthRateLimit(req: Request): Promise<void> {
  return requireDedicated(() => checkAuthRateLimit(req))
}

export async function requireOAuthRedirectRateLimit(req: Request): Promise<void> {
  return requireDedicated(() => checkOAuthRedirectRateLimit(req), 'Too many requests. Please try again later.')
}

export async function requireMeRateLimit(req: Request): Promise<void> {
  return requireDedicated(() => checkMeRateLimit(req))
}

export async function requireRefreshRateLimit(req: Request): Promise<void> {
  return requireDedicated(() => checkRefreshRateLimit(req), 'Too many refresh attempts')
}

export async function requireGenerateRateLimit(req: Request, userId: string): Promise<void> {
  return requireDedicated(() => checkGenerateRateLimit(req, userId))
}

export async function requireEmailSendCodeRateLimit(req: Request, email: string): Promise<void> {
  return requireDedicated(() => checkEmailSendCodeRateLimit(req, email), 'Too many code requests. Please try again later.')
}

export async function requireEmailVerifyCodeRateLimit(req: Request, email?: string): Promise<void> {
  return requireDedicated(() => checkEmailVerifyCodeRateLimit(req, email), 'Too many verification attempts. Please try again later.')
}

export async function requireBillingCreateLinkRateLimit(req: Request, userId: string): Promise<void> {
  return requireDedicated(() => checkBillingCreateLinkRateLimit(req, userId))
}

export async function requireBillingWebhookRateLimit(req: Request): Promise<void> {
  return requireDedicated(() => checkBillingWebhookRateLimit(req))
}

// ==================== RATE LIMIT MIDDLEWARE WRAPPER ====================

interface WithRateLimitOptions {
  /** Prefix for the rate limit key (e.g., 'worksheets:list') */
  prefix: string
  /** Maximum requests allowed in the window */
  maxRequests: number
  /** Window duration in seconds */
  windowSeconds: number
  /** Key mode: 'user' uses authenticated user ID, 'ip' uses client IP */
  keyMode?: 'user' | 'ip'
}

/**
 * Middleware wrapper that applies rate limiting before the handler runs.
 * Eliminates boilerplate rate limit checks inside every handler.
 *
 * Usage with authenticated routes:
 *   router.get('/', withAuth(withRateLimit({ prefix: 'worksheets:list', maxRequests: 30, windowSeconds: 60 },
 *     async (req, res) => { ... }
 *   )))
 */
export function withRateLimit<T extends Request = AuthenticatedRequest>(
  options: WithRateLimitOptions,
  handler: (req: T, res: Response) => Promise<void | Response> | void | Response
) {
  return async (req: T, res: Response) => {
    const keyMode = options.keyMode ?? 'user'
    const identifier = keyMode === 'user' && 'user' in req && (req as unknown as AuthenticatedRequest).user
      ? `${options.prefix}:${(req as unknown as AuthenticatedRequest).user.id}`
      : `${options.prefix}:${getClientIp(req)}`

    const result = await checkRateLimit(req, {
      maxRequests: options.maxRequests,
      windowSeconds: options.windowSeconds,
      identifier,
    })

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
      throw ApiError.tooManyRequests('Too many requests', retryAfter)
    }

    return handler(req, res)
  }
}

// ==================== DAILY GENERATION LIMIT ====================

/**
 * Check and increment daily generation counter for paid users.
 * Uses Redis key with TTL until midnight MSK.
 */
export async function checkDailyGenerationLimit(
  userId: string,
  dailyLimit: number = 20
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const redis = getRedisClient()
  const key = `daily:gen:${userId}`

  if (!redis) {
    console.warn('[RateLimit] Redis unavailable for daily limit check, denying request')
    return { allowed: false, used: 0, limit: dailyLimit }
  }

  try {
    const current = await redis.get(key)
    const used = current ? parseInt(current, 10) : 0

    if (used >= dailyLimit) {
      return { allowed: false, used, limit: dailyLimit }
    }

    const newCount = await redis.incr(key)

    if (newCount === 1) {
      const ttl = secondsUntilMidnightMSK()
      await redis.expire(key, ttl)
    }

    return { allowed: true, used: newCount, limit: dailyLimit }
  } catch (err) {
    console.warn('[RateLimit] Daily limit check error, denying request:', err)
    return { allowed: false, used: 0, limit: dailyLimit }
  }
}

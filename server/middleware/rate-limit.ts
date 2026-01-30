import type { Request } from 'express'
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible'
import { getRedisClient, secondsUntilMidnightMSK } from '../lib/redis.js'

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
    console.warn('[RateLimit] Redis unavailable for daily limit check, allowing request')
    return { allowed: true, used: 0, limit: dailyLimit }
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
    console.error('[RateLimit] Daily limit check error:', err)
    return { allowed: true, used: 0, limit: dailyLimit }
  }
}

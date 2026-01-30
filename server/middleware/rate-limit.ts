import type { Request } from 'express'
import { RateLimiterRedis, RateLimiterMemory, RateLimiterAbstract } from 'rate-limiter-flexible'
import { getRedisClient, secondsUntilMidnightMSK } from '../lib/redis.js'

// ==================== RATE LIMITER SETUP ====================

let rateLimiterBackend: 'redis' | 'memory' = 'memory'

function createLimiter(keyPrefix: string, points: number, duration: number): RateLimiterAbstract {
  const redis = getRedisClient()
  if (redis) {
    rateLimiterBackend = 'redis'
    return new RateLimiterRedis({
      storeClient: redis,
      keyPrefix,
      points,
      duration,
    })
  }

  console.warn(`[RateLimit] Redis unavailable, using in-memory limiter for: ${keyPrefix}`)
  return new RateLimiterMemory({
    keyPrefix,
    points,
    duration,
  })
}

// Lazily initialized limiters
let _authLimiter: RateLimiterAbstract | null = null
let _oauthRedirectLimiter: RateLimiterAbstract | null = null
let _meLimiter: RateLimiterAbstract | null = null
let _refreshLimiter: RateLimiterAbstract | null = null
let _generateUserLimiter: RateLimiterAbstract | null = null
let _billingCreateLinkLimiter: RateLimiterAbstract | null = null
let _billingWebhookLimiter: RateLimiterAbstract | null = null

function getAuthLimiter() {
  if (!_authLimiter) _authLimiter = createLimiter('rl:auth', 10, 5 * 60)
  return _authLimiter
}
function getOAuthRedirectLimiter() {
  if (!_oauthRedirectLimiter) _oauthRedirectLimiter = createLimiter('rl:oauth', 20, 10 * 60)
  return _oauthRedirectLimiter
}
function getMeLimiter() {
  if (!_meLimiter) _meLimiter = createLimiter('rl:me', 60, 60)
  return _meLimiter
}
function getRefreshLimiter() {
  if (!_refreshLimiter) _refreshLimiter = createLimiter('rl:refresh', 10, 60)
  return _refreshLimiter
}
function getGenerateUserLimiter() {
  if (!_generateUserLimiter) _generateUserLimiter = createLimiter('rl:gen:user', 20, 60 * 60)
  return _generateUserLimiter
}
function getBillingCreateLinkLimiter() {
  if (!_billingCreateLinkLimiter) _billingCreateLinkLimiter = createLimiter('rl:bill:link', 10, 10 * 60)
  return _billingCreateLinkLimiter
}
function getBillingWebhookLimiter() {
  if (!_billingWebhookLimiter) _billingWebhookLimiter = createLimiter('rl:bill:wh', 100, 60)
  return _billingWebhookLimiter
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
  // With `trust proxy` configured, req.ip is already the correct client IP
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
    // rate-limiter-flexible throws RateLimiterRes on limit exceeded
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
  const prefix = `rl:custom:${key.split(':')[0] || 'generic'}`
  const limiter = createLimiter(prefix, maxRequests, windowSeconds)
  return consumeLimit(limiter, key)
}

// ==================== PUBLIC FUNCTIONS ====================

export async function checkAuthRateLimit(req: Request): Promise<RateLimitResult> {
  return consumeLimit(getAuthLimiter(), getClientIp(req))
}

export async function checkOAuthRedirectRateLimit(req: Request): Promise<RateLimitResult> {
  return consumeLimit(getOAuthRedirectLimiter(), getClientIp(req))
}

export async function checkMeRateLimit(req: Request): Promise<RateLimitResult> {
  return consumeLimit(getMeLimiter(), getClientIp(req))
}

export async function checkRefreshRateLimit(req: Request): Promise<RateLimitResult> {
  return consumeLimit(getRefreshLimiter(), getClientIp(req))
}

export async function checkGenerateRateLimit(
  req: Request,
  userId: string
): Promise<RateLimitResult> {
  return consumeLimit(getGenerateUserLimiter(), userId)
}

export async function checkBillingCreateLinkRateLimit(
  req: Request,
  userId: string
): Promise<RateLimitResult> {
  return consumeLimit(getBillingCreateLinkLimiter(), userId)
}

export async function checkBillingWebhookRateLimit(req: Request): Promise<RateLimitResult> {
  return consumeLimit(getBillingWebhookLimiter(), getClientIp(req))
}

// ==================== DAILY GENERATION LIMIT ====================

/**
 * Check and increment daily generation counter for paid users.
 * Uses Redis key with TTL until midnight MSK.
 * Returns { allowed, used, limit }
 */
export async function checkDailyGenerationLimit(
  userId: string,
  dailyLimit: number = 20
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const redis = getRedisClient()
  const key = `daily:gen:${userId}`

  if (!redis) {
    // Fallback: allow but log warning (in-memory not suitable for daily counters)
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

    // Set TTL only on first increment (when key was just created)
    if (newCount === 1) {
      const ttl = secondsUntilMidnightMSK()
      await redis.expire(key, ttl)
    }

    return { allowed: true, used: newCount, limit: dailyLimit }
  } catch (err) {
    console.error('[RateLimit] Daily limit check error:', err)
    // On error, allow to avoid blocking legitimate users
    return { allowed: true, used: 0, limit: dailyLimit }
  }
}

export function getRateLimiterBackend(): string {
  return rateLimiterBackend
}

import type { VercelRequest } from '@vercel/node'

/**
 * Simple in-memory rate limiter
 *
 * Production note: For production with multiple instances,
 * consider using Upstash Redis or Vercel KV for distributed rate limiting.
 *
 * Current implementation uses in-memory Map, which works for single instance
 * or short-lived serverless functions.
 */

interface RateLimitRecord {
  count: number
  resetAt: number
}

// In-memory store (per-instance)
const rateLimitStore = new Map<string, RateLimitRecord>()

// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Rate limit options
 */
interface RateLimitOptions {
  /**
   * Maximum number of requests allowed in the time window
   * Default: 5
   */
  maxRequests?: number

  /**
   * Time window in seconds
   * Default: 60 (1 minute)
   */
  windowSeconds?: number

  /**
   * Custom identifier (e.g., IP, user ID)
   * If not provided, uses request IP
   */
  identifier?: string
}

/**
 * Rate limit result
 */
interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp
}

/**
 * Get client IP from request
 */
function getClientIp(req: VercelRequest): string {
  // Vercel provides client IP in headers
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string') {
    return realIp
  }

  return 'unknown'
}

/**
 * Check rate limit for a request
 *
 * @param req - Vercel request object
 * @param options - Rate limit options
 * @returns Rate limit result
 *
 * @example
 * ```typescript
 * const result = checkRateLimit(req, { maxRequests: 5, windowSeconds: 60 })
 * if (!result.success) {
 *   return res.status(429).json({
 *     error: 'Too many requests',
 *     retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
 *   })
 * }
 * ```
 */
export function checkRateLimit(
  req: VercelRequest,
  options: RateLimitOptions = {}
): RateLimitResult {
  const {
    maxRequests = 5,
    windowSeconds = 60,
    identifier,
  } = options

  // Get identifier (IP or custom)
  const key = identifier || getClientIp(req)
  const now = Date.now()
  const windowMs = windowSeconds * 1000

  // Get or create record
  let record = rateLimitStore.get(key)

  // If record doesn't exist or window expired, create new
  if (!record || record.resetAt < now) {
    record = {
      count: 1,
      resetAt: now + windowMs,
    }
    rateLimitStore.set(key, record)

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      reset: record.resetAt,
    }
  }

  // Increment count
  record.count++

  // Check if limit exceeded
  if (record.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      reset: record.resetAt,
    }
  }

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - record.count,
    reset: record.resetAt,
  }
}

/**
 * Rate limit middleware for auth endpoints
 *
 * @example
 * ```typescript
 * export default async function handler(req: VercelRequest, res: VercelResponse) {
 *   const rateLimitResult = checkAuthRateLimit(req)
 *   if (!rateLimitResult.success) {
 *     return res.status(429)
 *       .setHeader('Retry-After', Math.ceil((rateLimitResult.reset - Date.now()) / 1000))
 *       .json({ error: 'Too many authentication attempts' })
 *   }
 *
 *   // Continue with authentication...
 * }
 * ```
 */
export function checkAuthRateLimit(req: VercelRequest): RateLimitResult {
  // Stricter limits for auth endpoints to prevent brute force
  return checkRateLimit(req, {
    maxRequests: 10, // 10 attempts
    windowSeconds: 5 * 60, // per 5 minutes
  })
}

/**
 * Rate limit middleware for OAuth redirect endpoints
 */
export function checkOAuthRedirectRateLimit(req: VercelRequest): RateLimitResult {
  return checkRateLimit(req, {
    maxRequests: 20, // 20 redirect attempts
    windowSeconds: 10 * 60, // per 10 minutes
  })
}

/**
 * Rate limit for /api/auth/me endpoint
 * Higher limits since this is called frequently for session checks
 */
export function checkMeRateLimit(req: VercelRequest): RateLimitResult {
  return checkRateLimit(req, {
    maxRequests: 60, // 60 requests
    windowSeconds: 60, // per minute
  })
}

/**
 * Rate limit for /api/auth/refresh endpoint
 * Moderate limits - token refresh happens occasionally
 */
export function checkRefreshRateLimit(req: VercelRequest): RateLimitResult {
  return checkRateLimit(req, {
    maxRequests: 10, // 10 refresh attempts
    windowSeconds: 60, // per minute
  })
}

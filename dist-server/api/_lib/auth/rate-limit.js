// In-memory store (per-instance)
const rateLimitStore = new Map();
// Cleanup old entries periodically (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
        if (record.resetAt < now) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);
/**
 * Get client IP from request
 */
function getClientIp(req) {
    // Vercel provides client IP in headers
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
        return realIp;
    }
    return 'unknown';
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
export function checkRateLimit(req, options = {}) {
    const { maxRequests = 5, windowSeconds = 60, identifier, } = options;
    // Get identifier (IP or custom)
    const key = identifier || getClientIp(req);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    // Get or create record
    let record = rateLimitStore.get(key);
    // If record doesn't exist or window expired, create new
    if (!record || record.resetAt < now) {
        record = {
            count: 1,
            resetAt: now + windowMs,
        };
        rateLimitStore.set(key, record);
        return {
            success: true,
            limit: maxRequests,
            remaining: maxRequests - 1,
            reset: record.resetAt,
        };
    }
    // Increment count
    record.count++;
    // Check if limit exceeded
    if (record.count > maxRequests) {
        return {
            success: false,
            limit: maxRequests,
            remaining: 0,
            reset: record.resetAt,
        };
    }
    return {
        success: true,
        limit: maxRequests,
        remaining: maxRequests - record.count,
        reset: record.resetAt,
    };
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
export function checkAuthRateLimit(req) {
    // Stricter limits for auth endpoints to prevent brute force
    return checkRateLimit(req, {
        maxRequests: 10, // 10 attempts
        windowSeconds: 5 * 60, // per 5 minutes
    });
}
/**
 * Rate limit middleware for OAuth redirect endpoints
 */
export function checkOAuthRedirectRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 20, // 20 redirect attempts
        windowSeconds: 10 * 60, // per 10 minutes
    });
}
/**
 * Rate limit for /api/auth/me endpoint
 * Higher limits since this is called frequently for session checks
 */
export function checkMeRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 60, // 60 requests
        windowSeconds: 60, // per minute
    });
}
/**
 * Rate limit for /api/auth/refresh endpoint
 * Moderate limits - token refresh happens occasionally
 */
export function checkRefreshRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 10, // 10 refresh attempts
        windowSeconds: 60, // per minute
    });
}
/**
 * Rate limit for /api/generate endpoint
 * Critical: This endpoint costs money (OpenAI API calls)
 *
 * Limits:
 * - Guests (by IP): 5 generations per hour (matches frontend guest limit of 3)
 * - Authenticated users: 20 generations per hour (can be adjusted based on subscription)
 */
export function checkGenerateRateLimit(req, userId) {
    if (userId) {
        // Authenticated users - more generous limits
        return checkRateLimit(req, {
            maxRequests: 20,
            windowSeconds: 60 * 60, // 1 hour
            identifier: `generate:user:${userId}`,
        });
    }
    // Guests - strict limits by IP
    return checkRateLimit(req, {
        maxRequests: 5, // Slightly more than frontend limit (3) as buffer
        windowSeconds: 60 * 60, // 1 hour
        identifier: `generate:guest:${getClientIp(req)}`,
    });
}
/**
 * Get client IP - exported for use in other modules
 */
export { getClientIp };
//# sourceMappingURL=rate-limit.js.map
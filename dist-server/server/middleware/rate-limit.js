import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { getRedisClient, secondsUntilMidnightMSK } from '../lib/redis.js';
import { ApiError } from './error-handler.js';
// ==================== RATE LIMITER SETUP ====================
// Cache created limiters to avoid recreating on every request
const limiterCache = new Map();
function createLimiter(keyPrefix, points, duration) {
    const cacheKey = `${keyPrefix}:${points}:${duration}`;
    const cached = limiterCache.get(cacheKey);
    if (cached)
        return cached;
    const redis = getRedisClient();
    let limiter;
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
        });
    }
    else {
        console.warn(`[RateLimit] Redis unavailable, using in-memory limiter for: ${keyPrefix}`);
        limiter = new RateLimiterMemory({
            keyPrefix,
            points,
            duration,
        });
    }
    limiterCache.set(cacheKey, limiter);
    return limiter;
}
// ==================== IP EXTRACTION ====================
/**
 * Get client IP from request.
 * Relies on Express `trust proxy` setting for correct X-Forwarded-For handling.
 */
export function getClientIp(req) {
    return req.ip || req.socket.remoteAddress || 'unknown';
}
// ==================== HELPER ====================
async function consumeLimit(limiter, key) {
    try {
        const res = await limiter.consume(key, 1);
        return {
            success: true,
            limit: limiter.points,
            remaining: res.remainingPoints,
            reset: Date.now() + res.msBeforeNext,
        };
    }
    catch (rejRes) {
        const rej = rejRes;
        return {
            success: false,
            limit: limiter.points,
            remaining: rej.remainingPoints ?? 0,
            reset: Date.now() + (rej.msBeforeNext ?? 60000),
        };
    }
}
/**
 * Generic rate limit check with custom options.
 * Used by admin, folders, worksheets routes with per-endpoint configs.
 */
export async function checkRateLimit(req, options = {}) {
    const { maxRequests = 5, windowSeconds = 60, identifier, } = options;
    const key = identifier || getClientIp(req);
    // Use identifier prefix for caching (e.g., "admin:stats" from "admin:stats:userId")
    const prefix = `rl:${key.replace(/:[^:]+$/, '')}`;
    const limiter = createLimiter(prefix, maxRequests, windowSeconds);
    return consumeLimit(limiter, key);
}
/**
 * Like checkRateLimit, but throws ApiError.tooManyRequests on failure.
 * Eliminates the 5-line boilerplate pattern in every route handler.
 */
export async function requireRateLimit(req, options = {}) {
    const result = await checkRateLimit(req, options);
    if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        throw ApiError.tooManyRequests('Too many requests', retryAfter);
    }
}
/**
 * Wraps a dedicated rate limit check function and throws on failure.
 */
async function requireDedicated(checkFn, message = 'Too many requests') {
    const result = await checkFn();
    if (!result.success) {
        const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
        throw ApiError.tooManyRequests(message, retryAfter);
    }
}
// ==================== DEDICATED LIMITERS ====================
export async function checkAuthRateLimit(req) {
    const limiter = createLimiter('rl:auth', 10, 5 * 60);
    return consumeLimit(limiter, getClientIp(req));
}
export async function checkOAuthRedirectRateLimit(req) {
    const limiter = createLimiter('rl:oauth', 20, 10 * 60);
    return consumeLimit(limiter, getClientIp(req));
}
export async function checkMeRateLimit(req) {
    const limiter = createLimiter('rl:me', 60, 60);
    return consumeLimit(limiter, getClientIp(req));
}
export async function checkRefreshRateLimit(req) {
    const limiter = createLimiter('rl:refresh', 10, 60);
    return consumeLimit(limiter, getClientIp(req));
}
export async function checkGenerateRateLimit(req, userId) {
    const limiter = createLimiter('rl:gen:user', 20, 60 * 60);
    return consumeLimit(limiter, userId);
}
export async function checkBillingCreateLinkRateLimit(req, userId) {
    const limiter = createLimiter('rl:bill:link', 10, 10 * 60);
    return consumeLimit(limiter, userId);
}
export async function checkBillingWebhookRateLimit(req) {
    const limiter = createLimiter('rl:bill:wh', 100, 60);
    return consumeLimit(limiter, getClientIp(req));
}
// ==================== THROWING VARIANTS OF DEDICATED LIMITERS ====================
export async function requireAuthRateLimit(req) {
    return requireDedicated(() => checkAuthRateLimit(req));
}
export async function requireOAuthRedirectRateLimit(req) {
    return requireDedicated(() => checkOAuthRedirectRateLimit(req), 'Too many requests. Please try again later.');
}
export async function requireMeRateLimit(req) {
    return requireDedicated(() => checkMeRateLimit(req));
}
export async function requireRefreshRateLimit(req) {
    return requireDedicated(() => checkRefreshRateLimit(req), 'Too many refresh attempts');
}
export async function requireGenerateRateLimit(req, userId) {
    return requireDedicated(() => checkGenerateRateLimit(req, userId));
}
export async function requireBillingCreateLinkRateLimit(req, userId) {
    return requireDedicated(() => checkBillingCreateLinkRateLimit(req, userId));
}
export async function requireBillingWebhookRateLimit(req) {
    return requireDedicated(() => checkBillingWebhookRateLimit(req));
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
export function withRateLimit(options, handler) {
    return async (req, res) => {
        const keyMode = options.keyMode ?? 'user';
        const identifier = keyMode === 'user' && 'user' in req && req.user
            ? `${options.prefix}:${req.user.id}`
            : `${options.prefix}:${getClientIp(req)}`;
        const result = await checkRateLimit(req, {
            maxRequests: options.maxRequests,
            windowSeconds: options.windowSeconds,
            identifier,
        });
        if (!result.success) {
            const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
            throw ApiError.tooManyRequests('Too many requests', retryAfter);
        }
        return handler(req, res);
    };
}
// ==================== DAILY GENERATION LIMIT ====================
/**
 * Check and increment daily generation counter for paid users.
 * Uses Redis key with TTL until midnight MSK.
 */
export async function checkDailyGenerationLimit(userId, dailyLimit = 20) {
    const redis = getRedisClient();
    const key = `daily:gen:${userId}`;
    if (!redis) {
        console.warn('[RateLimit] Redis unavailable for daily limit check, denying request');
        return { allowed: false, used: 0, limit: dailyLimit };
    }
    try {
        const current = await redis.get(key);
        const used = current ? parseInt(current, 10) : 0;
        if (used >= dailyLimit) {
            return { allowed: false, used, limit: dailyLimit };
        }
        const newCount = await redis.incr(key);
        if (newCount === 1) {
            const ttl = secondsUntilMidnightMSK();
            await redis.expire(key, ttl);
        }
        return { allowed: true, used: newCount, limit: dailyLimit };
    }
    catch (err) {
        console.warn('[RateLimit] Daily limit check error, denying request:', err);
        return { allowed: false, used: 0, limit: dailyLimit };
    }
}
//# sourceMappingURL=rate-limit.js.map
import { RateLimiterRedis, RateLimiterMemory } from 'rate-limiter-flexible';
import { getRedisClient, secondsUntilMidnightMSK } from '../lib/redis.js';
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
// ==================== DAILY GENERATION LIMIT ====================
/**
 * Check and increment daily generation counter for paid users.
 * Uses Redis key with TTL until midnight MSK.
 */
export async function checkDailyGenerationLimit(userId, dailyLimit = 20) {
    const redis = getRedisClient();
    const key = `daily:gen:${userId}`;
    if (!redis) {
        console.warn('[RateLimit] Redis unavailable for daily limit check, allowing request');
        return { allowed: true, used: 0, limit: dailyLimit };
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
        console.error('[RateLimit] Daily limit check error:', err);
        return { allowed: true, used: 0, limit: dailyLimit };
    }
}
//# sourceMappingURL=rate-limit.js.map
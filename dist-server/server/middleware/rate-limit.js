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
export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
        return realIp;
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}
/**
 * Check rate limit for a request
 */
export function checkRateLimit(req, options = {}) {
    const { maxRequests = 5, windowSeconds = 60, identifier, } = options;
    const key = identifier || getClientIp(req);
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    let record = rateLimitStore.get(key);
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
    record.count++;
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
export function checkAuthRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 10,
        windowSeconds: 5 * 60,
    });
}
export function checkOAuthRedirectRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 20,
        windowSeconds: 10 * 60,
    });
}
export function checkMeRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 60,
        windowSeconds: 60,
    });
}
export function checkRefreshRateLimit(req) {
    return checkRateLimit(req, {
        maxRequests: 10,
        windowSeconds: 60,
    });
}
export function checkGenerateRateLimit(req, userId) {
    if (userId) {
        return checkRateLimit(req, {
            maxRequests: 20,
            windowSeconds: 60 * 60,
            identifier: `generate:user:${userId}`,
        });
    }
    return checkRateLimit(req, {
        maxRequests: 5,
        windowSeconds: 60 * 60,
        identifier: `generate:guest:${getClientIp(req)}`,
    });
}
//# sourceMappingURL=rate-limit.js.map
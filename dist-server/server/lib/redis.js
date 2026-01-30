import Redis from 'ioredis';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;
export function getRedisClient() {
    if (redisClient)
        return redisClient;
    try {
        redisClient = new Redis(REDIS_URL, {
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                if (times > 5)
                    return null; // Stop retrying after 5 attempts
                return Math.min(times * 200, 2000);
            },
            lazyConnect: true,
        });
        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });
        redisClient.on('connect', () => {
            console.log('[Redis] Connected successfully');
        });
        redisClient.connect().catch((err) => {
            console.error('[Redis] Failed to connect:', err.message);
            redisClient = null;
        });
        return redisClient;
    }
    catch (err) {
        console.error('[Redis] Initialization error:', err);
        return null;
    }
}
/**
 * Get seconds until next midnight Moscow time (UTC+3)
 */
export function secondsUntilMidnightMSK() {
    const now = new Date();
    // Moscow is UTC+3
    const mskOffset = 3 * 60 * 60 * 1000;
    const mskNow = new Date(now.getTime() + mskOffset);
    const mskMidnight = new Date(mskNow);
    mskMidnight.setUTCHours(24, 0, 0, 0); // Next midnight in MSK-as-UTC
    return Math.ceil((mskMidnight.getTime() - mskNow.getTime()) / 1000);
}
//# sourceMappingURL=redis.js.map
import Redis from 'ioredis'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

let redisClient: Redis | null = null
let redisReady = false

export function getRedisClient(): Redis | null {
  if (redisClient && redisReady) return redisClient
  if (redisClient) return redisClient // Return even if not ready yet -- RateLimiterRedis handles reconnection

  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null
        return Math.min(times * 200, 2000)
      },
      enableOfflineQueue: true,
    })

    redisClient.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
      redisReady = false
    })

    redisClient.on('ready', () => {
      console.log('[Redis] Connected successfully')
      redisReady = true
    })

    return redisClient
  } catch (err) {
    console.error('[Redis] Initialization error:', err)
    return null
  }
}

/**
 * Check if Redis is connected and ready
 */
export function isRedisReady(): boolean {
  return redisReady
}

/**
 * Get seconds until next midnight Moscow time (UTC+3)
 */
export function secondsUntilMidnightMSK(): number {
  const now = new Date()
  // Moscow is UTC+3
  const mskOffset = 3 * 60 * 60 * 1000
  const mskNow = new Date(now.getTime() + mskOffset)
  const mskMidnight = new Date(mskNow)
  mskMidnight.setUTCHours(24, 0, 0, 0)

  return Math.ceil((mskMidnight.getTime() - mskNow.getTime()) / 1000)
}

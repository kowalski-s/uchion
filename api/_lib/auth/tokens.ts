import crypto from 'crypto'
import { db } from '../../../db/index.js'
import { refreshTokens } from '../../../db/schema.js'
import { eq, and, isNull, lt } from 'drizzle-orm'

// ==================== TYPES ====================

export interface AccessTokenPayload {
  sub: string          // user ID (UUID)
  email: string
  role: 'user' | 'admin'
  iat: number          // issued at (Unix timestamp)
  exp: number          // expires at (Unix timestamp)
  type: 'access'
}

export interface RefreshTokenPayload {
  sub: string          // user ID (UUID)
  jti: string          // unique token ID for rotation tracking
  iat: number
  exp: number
  type: 'refresh'
}

// ==================== CONSTANTS ====================

const ACCESS_TOKEN_EXPIRY = 60 * 60              // 1 hour in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60   // 7 days in seconds

// ==================== JWT HELPERS ====================

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters')
  }
  return secret
}

function base64urlEncode(data: string | Buffer): string {
  const buffer = typeof data === 'string' ? Buffer.from(data) : data
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function base64urlDecode(str: string): string {
  // Add padding if necessary
  const pad = str.length % 4
  let padded = str
  if (pad) {
    padded += '='.repeat(4 - pad)
  }
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
}

function createSignature(header: string, payload: string, secret: string): string {
  const data = `${header}.${payload}`
  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(data)
  return base64urlEncode(hmac.digest())
}

function createJWT<T extends object>(payload: T, expirySeconds: number): string {
  const secret = getSecret()
  const now = Math.floor(Date.now() / 1000)

  const header = { alg: 'HS256', typ: 'JWT' }
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expirySeconds,
  }

  const headerBase64 = base64urlEncode(JSON.stringify(header))
  const payloadBase64 = base64urlEncode(JSON.stringify(fullPayload))
  const signature = createSignature(headerBase64, payloadBase64, secret)

  return `${headerBase64}.${payloadBase64}.${signature}`
}

function verifyJWT<T>(token: string): T | null {
  try {
    const secret = getSecret()
    const parts = token.split('.')

    if (parts.length !== 3) {
      return null
    }

    const [headerBase64, payloadBase64, signature] = parts

    // Verify signature using timing-safe comparison to prevent timing attacks
    const expectedSignature = createSignature(headerBase64, payloadBase64, secret)

    // Both signatures must have same length for timingSafeEqual
    const sigBuffer = Buffer.from(signature, 'utf8')
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8')

    if (sigBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null
    }

    // Decode payload
    const payload = JSON.parse(base64urlDecode(payloadBase64)) as T & { exp: number }

    // Check expiration
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

function decodeJWTWithoutVerification<T>(token: string): T | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payloadBase64 = parts[1]
    return JSON.parse(base64urlDecode(payloadBase64)) as T
  } catch {
    return null
  }
}

// ==================== ACCESS TOKEN ====================

interface CreateAccessTokenParams {
  userId: string
  email: string
  role: 'user' | 'admin'
}

/**
 * Create a new access token (1 hour expiry)
 */
export function createAccessToken(params: CreateAccessTokenParams): string {
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp'> = {
    sub: params.userId,
    email: params.email,
    role: params.role,
    type: 'access',
  }

  return createJWT(payload, ACCESS_TOKEN_EXPIRY)
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  const payload = verifyJWT<AccessTokenPayload>(token)

  if (!payload || payload.type !== 'access') {
    return null
  }

  return payload
}

// ==================== REFRESH TOKEN ====================

/**
 * Create a new refresh token (7 days expiry)
 * Also stores the token ID (jti) in the database for revocation tracking
 */
export async function createRefreshToken(userId: string): Promise<string> {
  const jti = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000)

  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    jti,
    type: 'refresh',
  }

  // Store in database for revocation tracking
  await db.insert(refreshTokens).values({
    userId,
    jti,
    expiresAt,
  })

  return createJWT(payload, REFRESH_TOKEN_EXPIRY)
}

/**
 * Verify and decode a refresh token
 * Also checks if the token has been revoked in the database
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload | null> {
  const payload = verifyJWT<RefreshTokenPayload>(token)

  if (!payload || payload.type !== 'refresh') {
    return null
  }

  // Check if token is revoked in database
  const [dbToken] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.jti, payload.jti),
        isNull(refreshTokens.revokedAt)
      )
    )
    .limit(1)

  if (!dbToken) {
    return null
  }

  return payload
}

/**
 * Decode a refresh token without verification (for logout)
 */
export function decodeRefreshToken(token: string): RefreshTokenPayload | null {
  return decodeJWTWithoutVerification<RefreshTokenPayload>(token)
}

// ==================== REVOCATION ====================

/**
 * Revoke a specific refresh token by its jti
 */
export async function revokeRefreshToken(jti: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.jti, jti))
}

/**
 * Revoke all refresh tokens for a user (e.g., on password change or security event)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.userId, userId),
        isNull(refreshTokens.revokedAt)
      )
    )
}

/**
 * Clean up expired tokens from database (can be run periodically)
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date()
  await db
    .delete(refreshTokens)
    .where(lt(refreshTokens.expiresAt, now))
}

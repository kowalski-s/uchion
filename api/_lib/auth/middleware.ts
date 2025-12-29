import type { VercelRequest, VercelResponse } from '@vercel/node'
import { eq } from 'drizzle-orm'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { getTokenFromCookie, ACCESS_TOKEN_COOKIE } from './cookies.js'
import { verifyAccessToken } from './tokens.js'

// ==================== TYPES ====================

export interface AuthUser {
  id: string
  email: string
  role: 'user' | 'admin'
}

export type AuthenticatedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser
) => Promise<void> | void

export type OptionalAuthHandler = (
  req: VercelRequest,
  res: VercelResponse,
  user: AuthUser | null
) => Promise<void> | void

// ==================== MIDDLEWARE ====================

/**
 * Middleware that requires authentication
 * Returns 401 if user is not authenticated
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE)

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      const payload = verifyAccessToken(token)

      if (!payload) {
        return res.status(401).json({ error: 'Invalid or expired token' })
      }

      // Verify user still exists in database
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1)

      if (!user) {
        return res.status(401).json({ error: 'User not found' })
      }

      return await handler(req, res, user)
    } catch (error) {
      console.error('[Auth Middleware] Error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/**
 * Middleware that requires admin role
 * Returns 403 if user is not admin
 */
export function withAdminAuth(handler: AuthenticatedHandler) {
  return withAuth(async (req, res, user) => {
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    return await handler(req, res, user)
  })
}

/**
 * Middleware that optionally authenticates
 * Provides user if authenticated, null otherwise
 * Does not return 401 for unauthenticated requests
 */
export function withOptionalAuth(handler: OptionalAuthHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE)

      if (!token) {
        return await handler(req, res, null)
      }

      const payload = verifyAccessToken(token)

      if (!payload) {
        return await handler(req, res, null)
      }

      // Verify user still exists in database
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(eq(users.id, payload.sub))
        .limit(1)

      return await handler(req, res, user || null)
    } catch (error) {
      console.error('[Auth Middleware] Error:', error)
      // For optional auth, continue without user on error
      return await handler(req, res, null)
    }
  }
}

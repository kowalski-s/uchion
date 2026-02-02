import type { Request, Response } from 'express'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { getTokenFromCookie, ACCESS_TOKEN_COOKIE } from './cookies.js'
import { verifyAccessToken } from '../../api/_lib/auth/tokens.js'
import { ApiError } from './error-handler.js'
import type { AuthUser, AuthenticatedRequest } from '../types.js'

export type { AuthUser }

/**
 * Middleware that requires authentication.
 * Throws ApiError.unauthorized if user is not authenticated.
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void | Response> | void | Response
) {
  return async (req: Request, res: Response) => {
    const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE)

    if (!token) {
      throw ApiError.unauthorized('Authentication required')
    }

    const payload = verifyAccessToken(token)

    if (!payload) {
      throw ApiError.unauthorized('Invalid or expired token')
    }

    // Verify user still exists in database and is not deleted
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.id, payload.sub),
        isNull(users.deletedAt)
      ))
      .limit(1)

    if (!user) {
      throw ApiError.unauthorized('User not found or deactivated')
    }

    // Attach user to request
    ;(req as AuthenticatedRequest).user = user as AuthUser

    return await handler(req as AuthenticatedRequest, res)
  }
}

/**
 * Middleware that requires admin role.
 * Throws ApiError.forbidden if user is not admin.
 */
export function withAdminAuth(
  handler: (req: AuthenticatedRequest, res: Response) => Promise<void | Response> | void | Response
) {
  return withAuth(async (req, res) => {
    if (req.user.role !== 'admin') {
      throw ApiError.forbidden('Admin access required')
    }
    return await handler(req, res)
  })
}

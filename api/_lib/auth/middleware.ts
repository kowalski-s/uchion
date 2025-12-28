import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './config'

export type AuthenticatedHandler = (
  req: VercelRequest,
  res: VercelResponse,
  userId: string
) => Promise<void> | void

/**
 * Middleware to protect API routes
 * Requires user to be authenticated
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Get session
      const session = await getServerSession(req, res, authOptions)

      if (!session || !session.user) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const userId = (session.user as any).id

      if (!userId) {
        return res.status(401).json({ error: 'Invalid session' })
      }

      // Call the handler with userId
      return await handler(req, res, userId)
    } catch (error) {
      console.error('Auth middleware error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

/**
 * Middleware to require admin role
 */
export function withAdminAuth(handler: AuthenticatedHandler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    try {
      // Get session
      const session = await getServerSession(req, res, authOptions)

      if (!session || !session.user) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const userId = (session.user as any).id
      const role = (session.user as any).role

      if (!userId || role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' })
      }

      // Call the handler with userId
      return await handler(req, res, userId)
    } catch (error) {
      console.error('Admin auth middleware error:', error)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
}

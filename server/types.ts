import type { Request, Response, NextFunction } from 'express'

// Re-export Express types with aliases for easier migration
export type ExpressRequest = Request
export type ExpressResponse = Response
export type ExpressNextFunction = NextFunction

// Auth user type
export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: 'user' | 'admin'
}

// Request with authenticated user
export interface AuthenticatedRequest extends Request {
  user: AuthUser
}

// Handler types
export type RouteHandler = (
  req: Request,
  res: Response
) => Promise<void | Response> | void | Response

export type AuthenticatedHandler = (
  req: AuthenticatedRequest,
  res: Response
) => Promise<void | Response> | void | Response


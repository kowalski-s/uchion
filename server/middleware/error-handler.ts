import type { Request, Response, NextFunction } from 'express'

/**
 * Custom API error class for structured error responses.
 * Throw this in route handlers to trigger the global error handler.
 *
 * Response format: { error: 'message text', details?: {...} }
 * This is compatible with the frontend error parsing (data.error as string).
 */
export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
    public readonly headers?: Record<string, string>
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** 400 Bad Request */
  static badRequest(message: string, code?: string): ApiError {
    return new ApiError(400, message, code)
  }

  /** 400 Validation Error (with field details) */
  static validation(details: Record<string, unknown>, message = 'Validation error'): ApiError {
    return new ApiError(400, message, 'VALIDATION_ERROR', details)
  }

  /** 401 Unauthorized */
  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, 'UNAUTHORIZED')
  }

  /** 403 Forbidden */
  static forbidden(message: string, code?: string): ApiError {
    return new ApiError(403, message, code)
  }

  /** 404 Not Found */
  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, message, 'NOT_FOUND')
  }

  /** 429 Too Many Requests */
  static tooManyRequests(message = 'Too many requests', retryAfterSeconds?: number): ApiError {
    const headers = retryAfterSeconds != null
      ? { 'Retry-After': retryAfterSeconds.toString() }
      : undefined
    return new ApiError(429, message, 'RATE_LIMIT_EXCEEDED', undefined, headers)
  }

  /** 500 Internal Server Error */
  static internal(message = 'Internal server error'): ApiError {
    return new ApiError(500, message, 'INTERNAL_ERROR')
  }
}

/**
 * Global error handling middleware.
 * Must be registered AFTER all routes in server.ts.
 *
 * Handles:
 * - ApiError instances -> structured JSON response
 * - Unknown errors -> 500 with generic message
 *
 * Does NOT handle SSE routes (generate.ts, presentations.ts) -
 * those manage their own error flow via sendEvent().
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    if (err.headers) {
      for (const [key, value] of Object.entries(err.headers)) {
        res.setHeader(key, value)
      }
    }

    const body: Record<string, unknown> = { error: err.message }
    if (err.details) {
      body.details = err.details
    }

    res.status(err.statusCode).json(body)
    return
  }

  // Unknown error
  console.error('[Server Error]', err)
  res.status(500).json({ error: 'Internal server error' })
}

import type { Request } from 'express'

// Legacy file - use Express Request type instead of VercelRequest
type VercelRequest = Request

/**
 * Audit log event types
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_REFRESH = 'auth.token.refresh',
  AUTH_TOKEN_REVOKED = 'auth.token.revoked',

  // OAuth events
  OAUTH_REDIRECT = 'oauth.redirect',
  OAUTH_CALLBACK_SUCCESS = 'oauth.callback.success',
  OAUTH_CALLBACK_FAILED = 'oauth.callback.failed',

  // Security events
  SECURITY_RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SECURITY_INVALID_SIGNATURE = 'security.invalid_signature',
  SECURITY_CSRF_DETECTED = 'security.csrf.detected',
  SECURITY_EXPIRED_AUTH = 'security.expired_auth',
}

/**
 * Audit log entry
 */
interface AuditLogEntry {
  timestamp: string
  eventType: AuditEventType
  userId?: string
  userEmail?: string
  provider?: string
  ipAddress: string
  userAgent?: string
  success: boolean
  errorMessage?: string
  metadata?: Record<string, unknown>
}

/**
 * Get client IP from request
 */
function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string') {
    return realIp
  }

  return 'unknown'
}

/**
 * Get user agent from request
 */
function getUserAgent(req: VercelRequest): string {
  const userAgent = req.headers['user-agent']
  return typeof userAgent === 'string' ? userAgent : 'unknown'
}

/**
 * Log audit event
 *
 * In production, this should write to:
 * - Database (for long-term storage and queries)
 * - External monitoring service (DataDog, Sentry, etc.)
 * - SIEM system for security analysis
 *
 * Current implementation: Console logging (suitable for development + Vercel logs)
 */
export function logAuditEvent(
  eventType: AuditEventType,
  req: VercelRequest,
  options: {
    userId?: string
    userEmail?: string
    provider?: string
    success: boolean
    errorMessage?: string
    metadata?: Record<string, unknown>
  }
): void {
  const entry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    eventType,
    userId: options.userId,
    userEmail: options.userEmail,
    provider: options.provider,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    success: options.success,
    errorMessage: options.errorMessage,
    metadata: options.metadata,
  }

  // Log to console (will appear in Vercel logs)
  const logLevel = options.success ? 'info' : 'warn'
  const logMessage = `[AUDIT] ${eventType} | IP: ${entry.ipAddress} | User: ${options.userEmail || options.userId || 'unknown'} | Success: ${options.success}`

  if (logLevel === 'info') {
    console.info(logMessage, entry)
  } else {
    console.warn(logMessage, entry)
  }

  // TODO: In production, also send to:
  // - Database audit_logs table
  // - External monitoring service
  // - SIEM for security analysis
}

/**
 * Log successful login
 */
export function logLoginSuccess(
  req: VercelRequest,
  userId: string,
  userEmail: string,
  provider: 'yandex' | 'telegram'
): void {
  logAuditEvent(AuditEventType.AUTH_LOGIN_SUCCESS, req, {
    userId,
    userEmail,
    provider,
    success: true,
  })
}

/**
 * Log failed login attempt
 */
export function logLoginFailed(
  req: VercelRequest,
  errorMessage: string,
  provider?: 'yandex' | 'telegram',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.AUTH_LOGIN_FAILED, req, {
    provider,
    success: false,
    errorMessage,
    metadata,
  })
}

/**
 * Log OAuth callback success
 */
export function logOAuthCallbackSuccess(
  req: VercelRequest,
  userId: string,
  userEmail: string,
  provider: 'yandex' | 'telegram'
): void {
  logAuditEvent(AuditEventType.OAUTH_CALLBACK_SUCCESS, req, {
    userId,
    userEmail,
    provider,
    success: true,
  })
}

/**
 * Log OAuth callback failure
 */
export function logOAuthCallbackFailed(
  req: VercelRequest,
  errorMessage: string,
  provider: 'yandex' | 'telegram',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.OAUTH_CALLBACK_FAILED, req, {
    provider,
    success: false,
    errorMessage,
    metadata,
  })
}

/**
 * Log rate limit exceeded
 */
export function logRateLimitExceeded(
  req: VercelRequest,
  endpoint: string
): void {
  logAuditEvent(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, req, {
    success: false,
    errorMessage: `Rate limit exceeded on ${endpoint}`,
    metadata: { endpoint },
  })
}

/**
 * Log invalid signature detection
 */
export function logInvalidSignature(
  req: VercelRequest,
  provider: 'telegram',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.SECURITY_INVALID_SIGNATURE, req, {
    provider,
    success: false,
    errorMessage: 'Invalid signature detected - possible tampering',
    metadata,
  })
}

/**
 * Log CSRF attack detection
 */
export function logCsrfDetected(
  req: VercelRequest,
  provider: 'yandex',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.SECURITY_CSRF_DETECTED, req, {
    provider,
    success: false,
    errorMessage: 'CSRF attack detected - state mismatch',
    metadata,
  })
}

/**
 * Log expired authentication attempt
 */
export function logExpiredAuth(
  req: VercelRequest,
  provider: 'telegram',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.SECURITY_EXPIRED_AUTH, req, {
    provider,
    success: false,
    errorMessage: 'Expired authentication attempt - possible replay attack',
    metadata,
  })
}

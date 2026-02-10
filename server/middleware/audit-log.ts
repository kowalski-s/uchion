import type { Request } from 'express'

/**
 * Audit log event types
 */
export enum AuditEventType {
  AUTH_LOGIN_SUCCESS = 'auth.login.success',
  AUTH_LOGIN_FAILED = 'auth.login.failed',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_TOKEN_REFRESH = 'auth.token.refresh',
  AUTH_TOKEN_REVOKED = 'auth.token.revoked',
  OAUTH_REDIRECT = 'oauth.redirect',
  OAUTH_CALLBACK_SUCCESS = 'oauth.callback.success',
  OAUTH_CALLBACK_FAILED = 'oauth.callback.failed',
  SECURITY_RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SECURITY_INVALID_SIGNATURE = 'security.invalid_signature',
  SECURITY_CSRF_DETECTED = 'security.csrf.detected',
  SECURITY_EXPIRED_AUTH = 'security.expired_auth',
}

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

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }

  const realIp = req.headers['x-real-ip']
  if (typeof realIp === 'string') {
    return realIp
  }

  return req.ip || req.socket.remoteAddress || 'unknown'
}

function getUserAgent(req: Request): string {
  const userAgent = req.headers['user-agent']
  return typeof userAgent === 'string' ? userAgent : 'unknown'
}

export function logAuditEvent(
  eventType: AuditEventType,
  req: Request,
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

  const logLevel = options.success ? 'info' : 'warn'
  const logMessage = `[AUDIT] ${eventType} | IP: ${entry.ipAddress} | User: ${options.userEmail || options.userId || 'unknown'} | Success: ${options.success}`

  if (logLevel === 'info') {
    console.info(logMessage, entry)
  } else {
    console.warn(logMessage, entry)
  }
}

export function logLoginSuccess(
  req: Request,
  userId: string,
  userEmail: string,
  provider: 'yandex' | 'telegram' | 'email'
): void {
  logAuditEvent(AuditEventType.AUTH_LOGIN_SUCCESS, req, {
    userId,
    userEmail,
    provider,
    success: true,
  })
}

export function logLoginFailed(
  req: Request,
  errorMessage: string,
  provider?: 'yandex' | 'telegram' | 'email',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.AUTH_LOGIN_FAILED, req, {
    provider,
    success: false,
    errorMessage,
    metadata,
  })
}

export function logOAuthCallbackSuccess(
  req: Request,
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

export function logOAuthCallbackFailed(
  req: Request,
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

export function logRateLimitExceeded(
  req: Request,
  endpoint: string
): void {
  logAuditEvent(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, req, {
    success: false,
    errorMessage: `Rate limit exceeded on ${endpoint}`,
    metadata: { endpoint },
  })
}

export function logInvalidSignature(
  req: Request,
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

export function logCsrfDetected(
  req: Request,
  provider: 'yandex' | 'telegram',
  metadata?: Record<string, unknown>
): void {
  logAuditEvent(AuditEventType.SECURITY_CSRF_DETECTED, req, {
    provider,
    success: false,
    errorMessage: 'CSRF attack detected - state mismatch',
    metadata,
  })
}

export function logExpiredAuth(
  req: Request,
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

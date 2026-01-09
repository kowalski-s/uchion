/**
 * Audit log event types
 */
export var AuditEventType;
(function (AuditEventType) {
    AuditEventType["AUTH_LOGIN_SUCCESS"] = "auth.login.success";
    AuditEventType["AUTH_LOGIN_FAILED"] = "auth.login.failed";
    AuditEventType["AUTH_LOGOUT"] = "auth.logout";
    AuditEventType["AUTH_TOKEN_REFRESH"] = "auth.token.refresh";
    AuditEventType["AUTH_TOKEN_REVOKED"] = "auth.token.revoked";
    AuditEventType["OAUTH_REDIRECT"] = "oauth.redirect";
    AuditEventType["OAUTH_CALLBACK_SUCCESS"] = "oauth.callback.success";
    AuditEventType["OAUTH_CALLBACK_FAILED"] = "oauth.callback.failed";
    AuditEventType["SECURITY_RATE_LIMIT_EXCEEDED"] = "security.rate_limit.exceeded";
    AuditEventType["SECURITY_INVALID_SIGNATURE"] = "security.invalid_signature";
    AuditEventType["SECURITY_CSRF_DETECTED"] = "security.csrf.detected";
    AuditEventType["SECURITY_EXPIRED_AUTH"] = "security.expired_auth";
})(AuditEventType || (AuditEventType = {}));
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
        return realIp;
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
}
function getUserAgent(req) {
    const userAgent = req.headers['user-agent'];
    return typeof userAgent === 'string' ? userAgent : 'unknown';
}
export function logAuditEvent(eventType, req, options) {
    const entry = {
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
    };
    const logLevel = options.success ? 'info' : 'warn';
    const logMessage = `[AUDIT] ${eventType} | IP: ${entry.ipAddress} | User: ${options.userEmail || options.userId || 'unknown'} | Success: ${options.success}`;
    if (logLevel === 'info') {
        console.info(logMessage, entry);
    }
    else {
        console.warn(logMessage, entry);
    }
}
export function logLoginSuccess(req, userId, userEmail, provider) {
    logAuditEvent(AuditEventType.AUTH_LOGIN_SUCCESS, req, {
        userId,
        userEmail,
        provider,
        success: true,
    });
}
export function logLoginFailed(req, errorMessage, provider, metadata) {
    logAuditEvent(AuditEventType.AUTH_LOGIN_FAILED, req, {
        provider,
        success: false,
        errorMessage,
        metadata,
    });
}
export function logOAuthCallbackSuccess(req, userId, userEmail, provider) {
    logAuditEvent(AuditEventType.OAUTH_CALLBACK_SUCCESS, req, {
        userId,
        userEmail,
        provider,
        success: true,
    });
}
export function logOAuthCallbackFailed(req, errorMessage, provider, metadata) {
    logAuditEvent(AuditEventType.OAUTH_CALLBACK_FAILED, req, {
        provider,
        success: false,
        errorMessage,
        metadata,
    });
}
export function logRateLimitExceeded(req, endpoint) {
    logAuditEvent(AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED, req, {
        success: false,
        errorMessage: `Rate limit exceeded on ${endpoint}`,
        metadata: { endpoint },
    });
}
export function logInvalidSignature(req, provider, metadata) {
    logAuditEvent(AuditEventType.SECURITY_INVALID_SIGNATURE, req, {
        provider,
        success: false,
        errorMessage: 'Invalid signature detected - possible tampering',
        metadata,
    });
}
export function logCsrfDetected(req, provider, metadata) {
    logAuditEvent(AuditEventType.SECURITY_CSRF_DETECTED, req, {
        provider,
        success: false,
        errorMessage: 'CSRF attack detected - state mismatch',
        metadata,
    });
}
export function logExpiredAuth(req, provider, metadata) {
    logAuditEvent(AuditEventType.SECURITY_EXPIRED_AUTH, req, {
        provider,
        success: false,
        errorMessage: 'Expired authentication attempt - possible replay attack',
        metadata,
    });
}
//# sourceMappingURL=audit-log.js.map
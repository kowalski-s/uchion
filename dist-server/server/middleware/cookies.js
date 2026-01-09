// ==================== COOKIE NAMES ====================
export const ACCESS_TOKEN_COOKIE = 'uchion_access_token';
export const REFRESH_TOKEN_COOKIE = 'uchion_refresh_token';
export const STATE_COOKIE = 'uchion_oauth_state';
export const PKCE_COOKIE = 'uchion_pkce_verifier';
// ==================== CONSTANTS ====================
const ACCESS_TOKEN_MAX_AGE = 60 * 60; // 1 hour
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days
const OAUTH_COOKIE_MAX_AGE = 10 * 60; // 10 minutes
function getBaseOptions() {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
    };
}
function setCookie(res, name, value, maxAge, customPath) {
    const options = { ...getBaseOptions(), maxAge };
    const path = customPath || options.path;
    res.cookie(name, value, {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        path,
        maxAge: maxAge * 1000, // Express uses milliseconds
    });
}
function clearCookie(res, name, customPath) {
    const options = getBaseOptions();
    res.clearCookie(name, {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        path: customPath || options.path,
    });
}
/**
 * Set both access and refresh token cookies
 */
export function setAuthCookies(res, tokens) {
    setCookie(res, ACCESS_TOKEN_COOKIE, tokens.accessToken, ACCESS_TOKEN_MAX_AGE);
    setCookie(res, REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE);
}
/**
 * Clear both access and refresh token cookies
 */
export function clearAuthCookies(res) {
    clearCookie(res, ACCESS_TOKEN_COOKIE);
    clearCookie(res, REFRESH_TOKEN_COOKIE);
}
// ==================== OAUTH FLOW COOKIES ====================
const OAUTH_COOKIE_PATH = '/api/auth/';
/**
 * Set OAuth state cookie (for CSRF protection)
 */
export function setOAuthStateCookie(res, state) {
    setCookie(res, STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH);
}
/**
 * Set PKCE code verifier cookie
 */
export function setPKCECookie(res, codeVerifier) {
    setCookie(res, PKCE_COOKIE, codeVerifier, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH);
}
/**
 * Clear OAuth flow cookies after callback
 */
export function clearOAuthCookies(res) {
    clearCookie(res, STATE_COOKIE, OAUTH_COOKIE_PATH);
    clearCookie(res, PKCE_COOKIE, OAUTH_COOKIE_PATH);
}
// ==================== COOKIE READING ====================
/**
 * Get a specific cookie value from request
 * Uses cookie-parser middleware
 */
export function getTokenFromCookie(req, cookieName) {
    return req.cookies?.[cookieName] || null;
}
/**
 * Get OAuth state from cookie
 */
export function getStateCookie(req) {
    return getTokenFromCookie(req, STATE_COOKIE);
}
/**
 * Get PKCE code verifier from cookie
 */
export function getPKCECookie(req) {
    return getTokenFromCookie(req, PKCE_COOKIE);
}
//# sourceMappingURL=cookies.js.map
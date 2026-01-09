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
    const parts = [
        `${name}=${value}`,
        `Path=${path}`,
        `Max-Age=${maxAge}`,
        options.httpOnly ? 'HttpOnly' : '',
        options.secure ? 'Secure' : '',
        `SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`,
    ].filter(Boolean);
    // Get existing Set-Cookie headers
    const existingCookies = res.getHeader('Set-Cookie');
    const cookieArray = Array.isArray(existingCookies)
        ? existingCookies
        : existingCookies
            ? [existingCookies]
            : [];
    // Add new cookie
    cookieArray.push(parts.join('; '));
    res.setHeader('Set-Cookie', cookieArray);
}
function clearCookie(res, name, customPath) {
    setCookie(res, name, '', 0, customPath);
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
// Restrict OAuth cookies to /api/auth/ path for security
const OAUTH_COOKIE_PATH = '/api/auth/';
/**
 * Set OAuth state cookie (for CSRF protection)
 * Path restricted to /api/auth/ for security
 */
export function setOAuthStateCookie(res, state) {
    setCookie(res, STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH);
}
/**
 * Set PKCE code verifier cookie
 * Path restricted to /api/auth/ for security
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
 * Parse cookies from request header
 */
function parseCookies(req) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) {
        return {};
    }
    const cookies = {};
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
        const [name, ...rest] = pair.trim().split('=');
        if (name) {
            cookies[name] = rest.join('=');
        }
    }
    return cookies;
}
/**
 * Get a specific cookie value from request
 */
export function getTokenFromCookie(req, cookieName) {
    const cookies = parseCookies(req);
    return cookies[cookieName] || null;
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
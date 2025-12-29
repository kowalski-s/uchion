import type { VercelRequest, VercelResponse } from '@vercel/node'

// ==================== COOKIE NAMES ====================

export const ACCESS_TOKEN_COOKIE = 'uchion_access_token'
export const REFRESH_TOKEN_COOKIE = 'uchion_refresh_token'
export const STATE_COOKIE = 'uchion_oauth_state'
export const PKCE_COOKIE = 'uchion_pkce_verifier'

// ==================== CONSTANTS ====================

const ACCESS_TOKEN_MAX_AGE = 60 * 60              // 1 hour
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60   // 7 days
const OAUTH_COOKIE_MAX_AGE = 10 * 60             // 10 minutes

// ==================== HELPERS ====================

interface CookieOptions {
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict' | 'lax' | 'none'
  path: string
  maxAge: number
}

function getBaseOptions(): Omit<CookieOptions, 'maxAge'> {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  }
}

function setCookie(res: VercelResponse, name: string, value: string, maxAge: number): void {
  const options = { ...getBaseOptions(), maxAge }

  const parts = [
    `${name}=${value}`,
    `Path=${options.path}`,
    `Max-Age=${maxAge}`,
    options.httpOnly ? 'HttpOnly' : '',
    options.secure ? 'Secure' : '',
    `SameSite=${options.sameSite.charAt(0).toUpperCase() + options.sameSite.slice(1)}`,
  ].filter(Boolean)

  // Get existing Set-Cookie headers
  const existingCookies = res.getHeader('Set-Cookie')
  const cookieArray = Array.isArray(existingCookies)
    ? existingCookies
    : existingCookies
    ? [existingCookies as string]
    : []

  // Add new cookie
  cookieArray.push(parts.join('; '))
  res.setHeader('Set-Cookie', cookieArray)
}

function clearCookie(res: VercelResponse, name: string): void {
  setCookie(res, name, '', 0)
}

// ==================== AUTH COOKIES ====================

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

/**
 * Set both access and refresh token cookies
 */
export function setAuthCookies(res: VercelResponse, tokens: AuthTokens): void {
  setCookie(res, ACCESS_TOKEN_COOKIE, tokens.accessToken, ACCESS_TOKEN_MAX_AGE)
  setCookie(res, REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE)
}

/**
 * Clear both access and refresh token cookies
 */
export function clearAuthCookies(res: VercelResponse): void {
  clearCookie(res, ACCESS_TOKEN_COOKIE)
  clearCookie(res, REFRESH_TOKEN_COOKIE)
}

// ==================== OAUTH FLOW COOKIES ====================

/**
 * Set OAuth state cookie (for CSRF protection)
 */
export function setOAuthStateCookie(res: VercelResponse, state: string): void {
  setCookie(res, STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE)
}

/**
 * Set PKCE code verifier cookie
 */
export function setPKCECookie(res: VercelResponse, codeVerifier: string): void {
  setCookie(res, PKCE_COOKIE, codeVerifier, OAUTH_COOKIE_MAX_AGE)
}

/**
 * Clear OAuth flow cookies after callback
 */
export function clearOAuthCookies(res: VercelResponse): void {
  clearCookie(res, STATE_COOKIE)
  clearCookie(res, PKCE_COOKIE)
}

// ==================== COOKIE READING ====================

/**
 * Parse cookies from request header
 */
function parseCookies(req: VercelRequest): Record<string, string> {
  const cookieHeader = req.headers.cookie
  if (!cookieHeader) {
    return {}
  }

  const cookies: Record<string, string> = {}
  const pairs = cookieHeader.split(';')

  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split('=')
    if (name) {
      cookies[name] = rest.join('=')
    }
  }

  return cookies
}

/**
 * Get a specific cookie value from request
 */
export function getTokenFromCookie(req: VercelRequest, cookieName: string): string | null {
  const cookies = parseCookies(req)
  return cookies[cookieName] || null
}

/**
 * Get OAuth state from cookie
 */
export function getStateCookie(req: VercelRequest): string | null {
  return getTokenFromCookie(req, STATE_COOKIE)
}

/**
 * Get PKCE code verifier from cookie
 */
export function getPKCECookie(req: VercelRequest): string | null {
  return getTokenFromCookie(req, PKCE_COOKIE)
}

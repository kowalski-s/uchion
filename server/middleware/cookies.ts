import type { Request, Response } from 'express'

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

function setCookie(
  res: Response,
  name: string,
  value: string,
  maxAge: number,
  customPath?: string
): void {
  const options = { ...getBaseOptions(), maxAge }
  const path = customPath || options.path

  res.cookie(name, value, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path,
    maxAge: maxAge * 1000, // Express uses milliseconds
  })
}

function clearCookie(res: Response, name: string, customPath?: string): void {
  const options = getBaseOptions()
  res.clearCookie(name, {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: customPath || options.path,
  })
}

// ==================== AUTH COOKIES ====================

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

/**
 * Set both access and refresh token cookies
 */
export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  setCookie(res, ACCESS_TOKEN_COOKIE, tokens.accessToken, ACCESS_TOKEN_MAX_AGE)
  setCookie(res, REFRESH_TOKEN_COOKIE, tokens.refreshToken, REFRESH_TOKEN_MAX_AGE)
}

/**
 * Clear both access and refresh token cookies
 */
export function clearAuthCookies(res: Response): void {
  clearCookie(res, ACCESS_TOKEN_COOKIE)
  clearCookie(res, REFRESH_TOKEN_COOKIE)
}

// ==================== OAUTH FLOW COOKIES ====================

const OAUTH_COOKIE_PATH = '/api/auth/'

/**
 * Set OAuth state cookie (for CSRF protection)
 */
export function setOAuthStateCookie(res: Response, state: string): void {
  setCookie(res, STATE_COOKIE, state, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH)
}

/**
 * Set PKCE code verifier cookie
 */
export function setPKCECookie(res: Response, codeVerifier: string): void {
  setCookie(res, PKCE_COOKIE, codeVerifier, OAUTH_COOKIE_MAX_AGE, OAUTH_COOKIE_PATH)
}

/**
 * Clear OAuth flow cookies after callback
 */
export function clearOAuthCookies(res: Response): void {
  clearCookie(res, STATE_COOKIE, OAUTH_COOKIE_PATH)
  clearCookie(res, PKCE_COOKIE, OAUTH_COOKIE_PATH)
}

// ==================== COOKIE READING ====================

/**
 * Get a specific cookie value from request
 * Uses cookie-parser middleware
 */
export function getTokenFromCookie(req: Request, cookieName: string): string | null {
  return req.cookies?.[cookieName] || null
}

/**
 * Get OAuth state from cookie
 */
export function getStateCookie(req: Request): string | null {
  return getTokenFromCookie(req, STATE_COOKIE)
}

/**
 * Get PKCE code verifier from cookie
 */
export function getPKCECookie(req: Request): string | null {
  return getTokenFromCookie(req, PKCE_COOKIE)
}

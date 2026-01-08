import crypto from 'crypto'

// ==================== PKCE & STATE ====================

/**
 * Generate cryptographically secure state parameter with timestamp
 * Used for CSRF protection in OAuth flow
 *
 * Format: {random_bytes}.{timestamp}
 * This allows validation of state age to prevent replay attacks
 */
export function generateState(): string {
  const randomPart = base64url(crypto.randomBytes(32))
  const timestamp = Date.now()
  return `${randomPart}.${timestamp}`
}

/**
 * Validate OAuth state parameter
 *
 * Checks:
 * 1. Format is valid (contains timestamp)
 * 2. Timestamp is not too old (max 10 minutes)
 *
 * @param state - State parameter to validate
 * @param maxAgeSeconds - Maximum age of state in seconds (default: 10 minutes)
 * @returns true if valid, false otherwise
 */
export function validateState(state: string, maxAgeSeconds: number = 10 * 60): boolean {
  try {
    const parts = state.split('.')
    if (parts.length !== 2) {
      return false
    }

    const timestamp = parseInt(parts[1], 10)
    if (isNaN(timestamp)) {
      return false
    }

    const now = Date.now()
    const age = (now - timestamp) / 1000 // Convert to seconds

    return age <= maxAgeSeconds
  } catch {
    return false
  }
}

/**
 * Generate PKCE code verifier and challenge
 * code_verifier: 43-128 char random string
 * code_challenge: base64url(SHA256(code_verifier))
 */
export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // 32 bytes = 43 characters in base64url
  const codeVerifier = base64url(crypto.randomBytes(32))
  const hash = crypto.createHash('sha256').update(codeVerifier).digest()
  const codeChallenge = base64url(hash)

  return { codeVerifier, codeChallenge }
}

/**
 * base64url encoding without padding (RFC 4648)
 */
function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

// ==================== SHARED TYPES ====================

interface OAuthUserResult {
  providerId: string
  email: string
  name: string | null
  image: string | null
}

// ==================== YANDEX OAUTH ====================

interface YandexAuthParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scope?: string
}

/**
 * Build Yandex OAuth authorization URL
 * Note: Yandex supports PKCE with code_challenge_method=S256
 */
export function buildYandexAuthUrl(params: YandexAuthParams): string {
  const {
    clientId,
    redirectUri,
    state,
    codeChallenge,
  } = params

  const url = new URL('https://oauth.yandex.com/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // Yandex uses "login:email login:info" for email and profile
  url.searchParams.set('scope', 'login:email login:info')

  return url.toString()
}

interface YandexTokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
}

interface YandexUserInfo {
  id: string
  login: string
  default_email?: string
  emails?: string[]
  real_name?: string
  first_name?: string
  last_name?: string
  display_name?: string
  default_avatar_id?: string
}

interface YandexExchangeParams {
  code: string
  clientId: string
  clientSecret: string
  codeVerifier: string
}

/**
 * Exchange Yandex authorization code for tokens and user info
 */
export async function exchangeYandexCode(params: YandexExchangeParams): Promise<OAuthUserResult> {
  const { code, clientId, clientSecret, codeVerifier } = params

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth.yandex.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('[Yandex OAuth] Token exchange failed:', error)
    throw new Error('Failed to exchange authorization code')
  }

  const tokens = await tokenResponse.json() as YandexTokenResponse

  // Get user info
  const userResponse = await fetch('https://login.yandex.ru/info?format=json', {
    headers: {
      Authorization: `OAuth ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    console.error('[Yandex OAuth] Failed to get user info')
    throw new Error('Failed to get user info')
  }

  const userInfo = await userResponse.json() as YandexUserInfo

  // Yandex provides email in default_email or emails array
  const email = userInfo.default_email || userInfo.emails?.[0]
  if (!email) {
    throw new Error('Email not provided by Yandex')
  }

  // Build avatar URL if available
  let image: string | null = null
  if (userInfo.default_avatar_id) {
    image = `https://avatars.yandex.net/get-yapic/${userInfo.default_avatar_id}/islands-200`
  }

  return {
    providerId: userInfo.id,
    email,
    name: userInfo.real_name || userInfo.display_name || null,
    image,
  }
}

import crypto from 'crypto'

// ==================== PKCE & STATE ====================

/**
 * Generate cryptographically secure state parameter (32 bytes)
 * Used for CSRF protection in OAuth flow
 */
export function generateState(): string {
  return base64url(crypto.randomBytes(32))
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

// ==================== GOOGLE OAUTH ====================

interface GoogleAuthParams {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scope?: string
}

/**
 * Build Google OAuth authorization URL
 */
export function buildGoogleAuthUrl(params: GoogleAuthParams): string {
  const {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    scope = 'openid email profile'
  } = params

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scope)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'consent')

  return url.toString()
}

interface GoogleTokenResponse {
  access_token: string
  id_token: string
  refresh_token?: string
  expires_in: number
  token_type: string
  scope: string
}

interface GoogleUserInfo {
  id: string
  email: string
  verified_email: boolean
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

interface GoogleExchangeParams {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
  codeVerifier: string
}

interface OAuthUserResult {
  providerId: string
  email: string
  name: string | null
  image: string | null
}

/**
 * Exchange Google authorization code for tokens and user info
 */
export async function exchangeGoogleCode(params: GoogleExchangeParams): Promise<OAuthUserResult> {
  const { code, clientId, clientSecret, redirectUri, codeVerifier } = params

  // Exchange code for tokens
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text()
    console.error('[Google OAuth] Token exchange failed:', error)
    throw new Error('Failed to exchange authorization code')
  }

  const tokens: GoogleTokenResponse = await tokenResponse.json()

  // Get user info
  const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  })

  if (!userResponse.ok) {
    console.error('[Google OAuth] Failed to get user info')
    throw new Error('Failed to get user info')
  }

  const userInfo: GoogleUserInfo = await userResponse.json()

  if (!userInfo.email) {
    throw new Error('Email not provided by Google')
  }

  return {
    providerId: userInfo.id,
    email: userInfo.email,
    name: userInfo.name || null,
    image: userInfo.picture || null,
  }
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

  const tokens: YandexTokenResponse = await tokenResponse.json()

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

  const userInfo: YandexUserInfo = await userResponse.json()

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

# Migration History: Authentication Providers

> **Note**: This is a historical document. The authentication system has undergone two migrations:
> 1. **Google OAuth -> Telegram Login Widget** (December 30, 2025) -- described below
> 2. **Telegram Login Widget -> Email OTP** (later) -- Telegram was replaced with passwordless Email OTP via Unisender Go
>
> Current auth providers: **Yandex OAuth (PKCE) + Email OTP (passwordless)**
> See [AUTH_SUMMARY.md](./AUTH_SUMMARY.md) for current auth documentation.

---

## Migration 1: Google OAuth -> Telegram Login (Dec 30, 2025)

**Status**: Completed, then superseded by Email OTP migration.

Replaced Google OAuth with Telegram Login Widget, maintaining Yandex OAuth as the primary OAuth provider. Required for Russian legislation compliance (ФЗ-152).

## Migration 2: Telegram Login -> Email OTP

**Status**: Completed.

Replaced Telegram Login Widget with passwordless Email OTP authentication:
- 6-digit code sent to email via Unisender Go API
- Timing-safe comparison, atomic attempt increment
- Max 5 attempts per code, 10 min expiration
- Rate limits: 3 sends/10min per email, 10 verifications/10min per IP+email
- New table: `email_codes`
- Provider changed from `'telegram'` to `'email'`

### Files Changed (Telegram -> Email OTP)
- `server/routes/auth.ts` -- replaced Telegram callback with Email OTP endpoints
- `api/_lib/email.ts` -- new Unisender Go integration
- `src/pages/LoginPage.tsx` -- replaced Telegram Widget with Email OTP form
- `db/schema.ts` -- added `email_codes` table, updated provider comment
- Removed: `TelegramLoginButton` component, `TelegramCallbackPage`

### Current Auth Endpoints
- `GET /api/auth/yandex/redirect` -- Start Yandex OAuth
- `GET /api/auth/yandex/callback` -- Yandex OAuth callback
- `POST /api/auth/email/send-code` -- Send OTP code
- `POST /api/auth/email/verify-code` -- Verify OTP code
- `POST /api/auth/logout` -- Logout
- `POST /api/auth/refresh` -- Refresh token
- `GET /api/auth/me` -- Current user

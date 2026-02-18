# Authentication Summary

## Overview

Custom OAuth 2.0 implementation for Uchion with JWT tokens, supporting Yandex OAuth and Email OTP (passwordless) login.

## Providers

### 1. Yandex OAuth
- Full OAuth 2.0 flow with PKCE
- Callback: `/api/auth/yandex/callback`
- Requires: `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`

### 2. Email OTP (Passwordless)
- 6-значный код отправляется на email через Unisender Go
- Endpoints: `/api/auth/email/send-code`, `/api/auth/email/verify-code`
- Requires: `UNISENDER_GO_API_KEY`
- Срок действия кода: 10 минут
- Max 5 попыток на код
- Rate limit: 3 отправки / 10 мин на email

## Endpoints

### Authentication Flow
- `GET /api/auth/yandex/redirect` - Start Yandex OAuth
- `GET /api/auth/yandex/callback` - Yandex OAuth callback
- `POST /api/auth/email/send-code` - Send OTP code to email
- `POST /api/auth/email/verify-code` - Verify OTP code
- `POST /api/auth/logout` - Logout (revokes tokens)
- `POST /api/auth/refresh` - Refresh access token

### User Info
- `GET /api/auth/me` - Get current user info

## Token Strategy

### Access Token
- Lifetime: 1 hour
- Stored in: httpOnly cookie (`access_token`)
- Contains: userId, email, role

### Refresh Token
- Lifetime: 7 days
- Stored in: httpOnly cookie (`refresh_token`)
- Tracked in database for revocation
- Rotated on each refresh
- Family tracking для детекции кражи токенов

## Security Features

1. **PKCE**: Code challenge/verifier for Yandex OAuth
2. **State Validation**: Timestamped, timing-safe comparison
3. **JWT Signing**: HMAC-SHA256 with timing-safe verification
4. **Secure Cookies**: httpOnly, Secure (prod), SameSite=Lax
5. **Token Revocation**: Database tracking for refresh tokens
6. **Rate Limiting**: Per-endpoint limits
7. **Email OTP**: Timing-safe comparison, atomic attempt increment
8. **Audit Logging**: All auth events logged

## Middleware

### `withAuth`
Requires authenticated user:
```typescript
import { withAuth } from '../middleware/auth.js'

router.get('/protected', withAuth, (req, res) => {
  const user = req.user // { id, email, role }
})
```

### `withAdminAuth`
Requires admin role:
```typescript
router.get('/admin', withAdminAuth, (req, res) => {
  // Only admins can access
})
```

### `withOptionalAuth`
Optional authentication:
```typescript
router.get('/public', withOptionalAuth, (req, res) => {
  if (req.user) {
    // Authenticated user
  } else {
    // Guest
  }
})
```

## Environment Variables

### Required
```bash
AUTH_SECRET=your-secret-min-32-chars  # JWT signing
DATABASE_URL=postgresql://...          # Token storage
```

### OAuth Providers
```bash
# Yandex OAuth
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...

# Email OTP
UNISENDER_GO_API_KEY=...
```

## File Structure

```
server/
├── routes/
│   └── auth.ts           # Auth endpoints (Yandex, Email OTP, refresh, logout)
└── middleware/
    ├── auth.ts           # Auth middleware (withAuth, withAdminAuth)
    ├── cookies.ts        # Cookie handling
    └── audit-log.ts      # Security event logging

api/_lib/auth/
├── tokens.ts             # JWT creation/verification
├── oauth.ts              # PKCE, state management
├── cookies.ts            # Cookie configuration
└── audit-log.ts          # Security event logging

api/_lib/
└── email.ts              # Unisender Go (OTP email sending)
```

## Database Tables

### users
- `id` (UUID)
- `email` (unique)
- `name`
- `role` (user/admin)
- `provider` ('yandex' | 'email')
- `providerId`
- `createdAt`, `updatedAt`, `deletedAt`

### refresh_tokens
- `id` (UUID)
- `userId`
- `jti` (token ID)
- `familyId` (for family tracking)
- `expiresAt`
- `revokedAt`
- `createdAt`

### email_codes
- `id` (UUID)
- `email`
- `code` (6-digit)
- `expiresAt` (10 min)
- `attempts` (max 5)
- `usedAt`
- `createdAt`

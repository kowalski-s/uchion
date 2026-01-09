# Authentication Summary

## Overview

Custom OAuth 2.0 implementation for Uchion with JWT tokens, supporting Yandex and Telegram login.

## Providers

### 1. Yandex OAuth
- Full OAuth 2.0 flow with PKCE
- Callback: `/api/auth/yandex/callback`
- Requires: `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`

### 2. Telegram Login Widget
- Widget-based authentication
- Callback: `/api/auth/telegram/callback`
- Requires: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`

## Endpoints

### Authentication Flow
- `GET /api/auth/yandex/redirect` - Start Yandex OAuth
- `GET /api/auth/yandex/callback` - Yandex OAuth callback
- `GET /api/auth/telegram/callback` - Telegram login callback
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

## Security Features

1. **PKCE**: Code challenge/verifier for OAuth
2. **State Validation**: Timestamped, timing-safe comparison
3. **JWT Signing**: HMAC-SHA256 with timing-safe verification
4. **Secure Cookies**: httpOnly, Secure (prod), SameSite=Lax
5. **Token Revocation**: Database tracking for refresh tokens
6. **Rate Limiting**: Per-endpoint limits

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
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
VITE_TELEGRAM_BOT_USERNAME=...  # For frontend widget
```

## File Structure

```
server/
├── routes/
│   └── auth.ts           # Auth endpoints
└── middleware/
    ├── auth.ts           # Auth middleware
    └── cookies.ts        # Cookie handling

api/_lib/auth/
├── tokens.ts             # JWT creation/verification
├── oauth.ts              # PKCE, state management
├── cookies.ts            # Cookie configuration
├── rate-limit.ts         # Rate limiting
└── audit-log.ts          # Security event logging
```

## Database Tables

### users
- `id` (UUID)
- `email` (unique)
- `name`
- `role` (user/admin)
- `provider` (yandex/telegram)
- `providerId`
- `createdAt`, `updatedAt`, `deletedAt`

### refresh_tokens
- `id` (UUID)
- `userId`
- `jti` (token ID)
- `expiresAt`
- `revokedAt`
- `createdAt`

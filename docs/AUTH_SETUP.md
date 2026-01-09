# Authentication Setup Guide

## Overview

Uchion uses a custom OAuth 2.0 implementation with JWT tokens. This guide covers setup for development and production.

## Quick Start

### 1. Copy environment example

```bash
cp .env.example .env.local
```

### 2. Configure required variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Auth Secret (generate with: openssl rand -base64 32)
AUTH_SECRET=your-secret-minimum-32-characters

# OAuth Providers (optional for local dev)
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_BOT_USERNAME=...
VITE_TELEGRAM_BOT_USERNAME=...
```

### 3. Apply database migrations

```bash
npm run db:push
```

### 4. Start development

```bash
npm run dev
```

---

## Setting Up OAuth Providers

### Yandex OAuth

1. Go to [Yandex OAuth](https://oauth.yandex.ru/)
2. Create new application
3. Select required permissions:
   - `login:email` - User email
   - `login:info` - User name
4. Add Callback URIs:
   - Development: `http://localhost:5173/api/auth/yandex/callback`
   - Production: `https://yourdomain.com/api/auth/yandex/callback`
5. Copy Client ID and Client Secret to `.env.local`

```bash
YANDEX_CLIENT_ID=your-client-id
YANDEX_CLIENT_SECRET=your-client-secret
```

### Telegram Login Widget

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow instructions
3. Get bot token and save to `TELEGRAM_BOT_TOKEN`
4. Set domain for widget: `/setdomain` → enter your domain
5. Save bot username (without @) to `TELEGRAM_BOT_USERNAME`

```bash
TELEGRAM_BOT_TOKEN=123456789:ABC-DEF...
TELEGRAM_BOT_USERNAME=YourBotName
VITE_TELEGRAM_BOT_USERNAME=YourBotName  # For frontend widget
```

---

## Generating AUTH_SECRET

```bash
# Linux/Mac
openssl rand -base64 32

# Windows (PowerShell)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Important**: Use different secrets for development and production!

---

## API Endpoints

### Authentication Flow

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/yandex/redirect` | GET | Start Yandex OAuth flow |
| `/api/auth/yandex/callback` | GET | Yandex OAuth callback |
| `/api/auth/telegram/callback` | GET | Telegram login callback |
| `/api/auth/logout` | POST | Logout (revokes tokens) |
| `/api/auth/refresh` | POST | Refresh access token |
| `/api/auth/me` | GET | Get current user info |

### Testing Auth

```bash
# Check health
curl http://localhost:3000/api/health

# Check auth (should return 401)
curl http://localhost:3000/api/auth/me
```

---

## Protecting Routes

### Backend (Express)

```typescript
import { Router } from 'express'
import { withAuth, withAdminAuth, withOptionalAuth } from '../middleware/auth.js'

const router = Router()

// Requires authentication
router.get('/protected', withAuth, (req, res) => {
  const user = req.user // { id, email, role }
  res.json({ userId: user.id })
})

// Requires admin role
router.get('/admin-only', withAdminAuth, (req, res) => {
  res.json({ message: 'Admin access granted' })
})

// Optional auth (guests allowed)
router.get('/public', withOptionalAuth, (req, res) => {
  if (req.user) {
    res.json({ greeting: `Hello, ${req.user.email}` })
  } else {
    res.json({ greeting: 'Hello, guest' })
  }
})
```

### Frontend (React)

```typescript
// src/lib/api.ts
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'include', // Important: send cookies
  })

  if (response.status === 401) {
    // Token expired, try refresh
    const refreshed = await refreshToken()
    if (refreshed) {
      return fetch(url, { ...options, credentials: 'include' })
    }
    // Redirect to login
    window.location.href = '/'
  }

  return response
}
```

---

## Security Features

### Token Configuration
- **Access Token**: 1 hour lifetime, httpOnly cookie
- **Refresh Token**: 7 days lifetime, rotated on each use
- **Cookie Settings**: Secure (prod), SameSite=Lax, httpOnly

### OAuth Security
- **PKCE**: Code challenge/verifier for Yandex OAuth
- **State Validation**: Timestamped state with timing-safe comparison
- **Signature Verification**: HMAC-SHA256 for Telegram data

### Rate Limiting
| Endpoint | Limit |
|----------|-------|
| OAuth redirect | 20/10min |
| OAuth callback | 10/5min |
| Token refresh | 10/1min |
| `/api/auth/me` | 60/1min |

---

## Database Schema

### users table
```sql
id          UUID PRIMARY KEY
email       VARCHAR UNIQUE
name        VARCHAR
role        VARCHAR DEFAULT 'user'  -- 'user' or 'admin'
provider    VARCHAR                  -- 'yandex' or 'telegram'
providerId  VARCHAR
createdAt   TIMESTAMP
updatedAt   TIMESTAMP
deletedAt   TIMESTAMP               -- Soft delete
```

### refresh_tokens table
```sql
id          UUID PRIMARY KEY
userId      UUID REFERENCES users
jti         VARCHAR UNIQUE          -- Token ID
expiresAt   TIMESTAMP
revokedAt   TIMESTAMP               -- For revocation
createdAt   TIMESTAMP
```

---

## Troubleshooting

### "AUTH_SECRET must be at least 32 characters"

Generate a proper secret:
```bash
openssl rand -base64 32
```

### OAuth redirect mismatch

Ensure callback URLs match exactly:
- Development: `http://localhost:5173/api/auth/{provider}/callback`
- Production: `https://yourdomain.com/api/auth/{provider}/callback`

### Cookies not being set

Check:
1. Using `credentials: 'include'` in fetch requests
2. Same domain for frontend and API
3. HTTPS in production

### Token expired errors

The frontend should automatically:
1. Catch 401 responses
2. Call `/api/auth/refresh`
3. Retry the original request

---

## File Structure

```
server/
├── routes/
│   └── auth.ts              # All auth endpoints
└── middleware/
    ├── auth.ts              # withAuth, withAdminAuth
    ├── cookies.ts           # Cookie configuration
    └── rate-limit.ts        # Rate limiting

api/_lib/auth/
├── tokens.ts                # JWT creation/verification
├── oauth.ts                 # PKCE, state helpers
├── cookies.ts               # Cookie settings
├── rate-limit.ts            # Rate limit configuration
├── audit-log.ts             # Security event logging
└── middleware.ts            # Legacy middleware (Vercel)
```

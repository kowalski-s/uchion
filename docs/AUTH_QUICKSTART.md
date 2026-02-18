# Authentication Quick Start

## 5-Minute Setup

### 1. Configure environment

```bash
# Copy example
cp .env.example .env.local

# Edit .env.local with your values:
DATABASE_URL=postgresql://...
AUTH_SECRET=<run: openssl rand -base64 32>
```

### 2. Push database schema

```bash
npm run db:push
```

### 3. Start development

```bash
npm run dev
```

### 4. Test authentication

```bash
# Health check
curl http://localhost:3000/api/health

# Should return 401 (not authenticated)
curl http://localhost:3000/api/auth/me
```

---

## Testing Auth Providers (Optional)

### Yandex OAuth

1. Get credentials from [Yandex OAuth](https://oauth.yandex.ru/)
2. Add to `.env.local`:
   ```bash
   YANDEX_CLIENT_ID=your-id
   YANDEX_CLIENT_SECRET=your-secret
   ```
3. Add callback URL in Yandex: `http://localhost:5173/api/auth/yandex/callback`
4. Open `http://localhost:5173` and click "Login with Yandex"

### Email OTP

1. Get API key from [Unisender Go](https://go.unisender.ru/)
2. Add to `.env.local`:
   ```bash
   UNISENDER_GO_API_KEY=your-api-key
   ```
3. Open `http://localhost:5173`, enter email, receive 6-digit code
4. Enter code to complete login

---

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/auth/me` | GET | Yes | Current user |
| `/api/auth/logout` | POST | Yes | Logout |
| `/api/auth/refresh` | POST | Cookie | Refresh token |
| `/api/auth/yandex/redirect` | GET | No | Start Yandex OAuth |
| `/api/auth/email/send-code` | POST | No | Send OTP code |
| `/api/auth/email/verify-code` | POST | No | Verify OTP code |

---

## Protecting Your Routes

```typescript
import { withAuth } from '../middleware/auth.js'

// This route requires login
router.get('/my-data', withAuth, (req, res) => {
  const userId = req.user!.id
  // ... fetch user data
})
```

---

## Frontend Integration

```typescript
// Always include credentials for auth cookies
const response = await fetch('/api/auth/me', {
  credentials: 'include'
})

if (response.ok) {
  const user = await response.json()
  console.log('Logged in as:', user.email)
} else {
  console.log('Not logged in')
}
```

---

## Need More?

- Full setup guide: [AUTH_SETUP.md](./AUTH_SETUP.md)
- Security details: [AUTH_SUMMARY.md](./AUTH_SUMMARY.md)
- Architecture: [architecture-overview.md](./architecture-overview.md)

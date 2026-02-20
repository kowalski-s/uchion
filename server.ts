import dotenv from 'dotenv'
// Load env files - .env.local takes priority over .env
dotenv.config({ path: '.env.local', override: true })
dotenv.config({ path: '.env' })
import express, { type Request } from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'

// Routes
import authRoutes from './server/routes/auth.js'
import foldersRoutes from './server/routes/folders.js'
import worksheetsRoutes from './server/routes/worksheets.js'
import generateRoutes from './server/routes/generate.js'
import presentationsRoutes from './server/routes/presentations.js'
import healthRoutes from './server/routes/health.js'
import adminRoutes from './server/routes/admin/index.js'
import telegramRoutes from './server/routes/telegram.js'
import billingRoutes from './server/routes/billing.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ==================== STARTUP CONFIG VALIDATION ====================

function validateProdamusConfig() {
  const secret = process.env.PRODAMUS_SECRET
  const payformUrl = process.env.PRODAMUS_PAYFORM_URL
  const isProduction = process.env.NODE_ENV === 'production'
  const debugEnabled = process.env.PRODAMUS_DEBUG === 'true'

  console.log('[Startup] ========== PRODAMUS CONFIG CHECK ==========')
  console.log('[Startup] NODE_ENV:', process.env.NODE_ENV || 'development')
  console.log('[Startup] PRODAMUS_DEBUG:', debugEnabled ? 'ENABLED' : 'disabled')
  console.log('[Startup] PRODAMUS_SECRET:', secret ? 'SET' : 'NOT SET')
  console.log('[Startup] PRODAMUS_PAYFORM_URL:', payformUrl || 'NOT SET')

  if (isProduction) {
    if (!secret) {
      console.error('[Startup] FATAL: PRODAMUS_SECRET is required in production!')
      process.exit(1)
    }
    if (!payformUrl) {
      console.error('[Startup] FATAL: PRODAMUS_PAYFORM_URL is required in production!')
      process.exit(1)
    }
    console.log('[Startup] Prodamus config: OK')
  } else {
    console.log('[Startup] Development mode - Prodamus config optional')
  }
  console.log('[Startup] ================================================')
}

validateProdamusConfig()

const app = express()
const PORT = process.env.PORT || 3000

// Trust first proxy (nginx/reverse proxy) for correct IP in rate limiting
app.set('trust proxy', 1)

// ==================== MIDDLEWARE ====================

// Parse JSON bodies with raw body preservation for webhooks
app.use(express.json({
  limit: '1mb',
  verify: (req, _res, buf) => {
    // Store raw body for webhook signature verification
    if (req.url?.includes('/api/billing/') && req.url?.includes('/webhook')) {
      (req as Request & { rawBody?: string }).rawBody = buf.toString()
    }
  }
}))

// Parse URL-encoded bodies (for Prodamus webhooks)
app.use(express.urlencoded({
  limit: '1mb',
  extended: true,
  verify: (req, _res, buf) => {
    if (req.url?.includes('/api/billing/') && req.url?.includes('/webhook')) {
      (req as Request & { rawBody?: string }).rawBody = buf.toString()
    }
  }
}))

// Parse cookies
app.use(cookieParser())

// ---- CORS: reject cross-origin requests explicitly ----
const APP_ORIGIN = process.env.APP_URL || `http://localhost:${PORT}`
app.use((req, res, next) => {
  // Skip CORS check for webhook endpoints (external providers call these server-to-server)
  if (req.path.includes('/webhook')) return next()

  const origin = req.headers.origin
  // Allow same-origin and requests with no Origin (same-origin navigations, curl, etc.)
  if (origin && origin !== APP_ORIGIN) {
    return res.status(403).json({ error: 'Forbidden: cross-origin request' })
  }
  // Explicitly set CORS headers to deny everything except our origin
  res.setHeader('Access-Control-Allow-Origin', APP_ORIGIN)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }
  next()
})

// ---- CSRF: verify Origin on state-changing requests ----
app.use((req, res, next) => {
  // Only check mutating methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  // Skip webhook endpoints (external providers call these)
  if (req.path.includes('/webhook')) return next()
  // Skip OAuth callbacks (redirects from providers)
  if (req.path.includes('/callback')) return next()

  const origin = req.headers.origin
  const referer = req.headers.referer

  // At least one must be present and match our app origin
  if (origin) {
    if (origin !== APP_ORIGIN) {
      return res.status(403).json({ error: 'Forbidden: origin mismatch' })
    }
    return next()
  }
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin
      if (refererOrigin !== APP_ORIGIN) {
        return res.status(403).json({ error: 'Forbidden: referer mismatch' })
      }
      return next()
    } catch {
      return res.status(403).json({ error: 'Forbidden: invalid referer' })
    }
  }
  // No Origin or Referer -- allow only in development (curl, Postman, etc.)
  if (process.env.NODE_ENV !== 'production') return next()
  return res.status(403).json({ error: 'Forbidden: missing origin' })
})

// ---- Security headers ----
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '0') // Disabled; modern browsers use CSP instead
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // HSTS: enforce HTTPS for 1 year, include subdomains
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  // CSP: style-src keeps 'unsafe-inline' because Tailwind/KaTeX require it.
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ')
  )
  next()
})

// ==================== API ROUTES ====================

app.use('/api/auth', authRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/worksheets', worksheetsRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/presentations', presentationsRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/telegram', telegramRoutes)
app.use('/api/billing', billingRoutes)
app.use('/api', healthRoutes)

// ==================== STATIC FILES ====================

// Serve static files from dist folder (production build)
// In dev (tsx): __dirname is project root, dist is ./dist
// In prod (compiled): __dirname is dist-server/, dist is ../dist
const isCompiledServer = __dirname.endsWith('dist-server')
const distPath = isCompiledServer
  ? path.join(__dirname, '..', 'dist')
  : path.join(__dirname, 'dist')
app.use(express.static(distPath))

// SPA fallback - serve index.html for all non-API routes
// Express 5 requires named wildcard pattern
app.get('/{*path}', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' })
  }
  res.sendFile(path.join(distPath, 'index.html'))
})

// ==================== ERROR HANDLING ====================

import { errorHandler } from './server/middleware/error-handler.js'
app.use(errorHandler)

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)

  // Send startup alert to admins (non-blocking)
  import('./api/_lib/telegram/bot.js').then(({ sendAdminAlert }) => {
    const env = process.env.NODE_ENV || 'development'
    const time = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })
    sendAdminAlert({
      message: `Сервер запущен\n\nПорт: ${PORT}\nОкружение: ${env}\nВремя: ${time}`,
      level: 'info',
    }).catch(() => { /* ignore if Telegram unavailable */ })
  }).catch(() => { /* ignore */ })
})

export default app

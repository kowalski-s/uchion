import 'dotenv/config'
import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'path'
import { fileURLToPath } from 'url'

// Routes
import authRoutes from './server/routes/auth.js'
import foldersRoutes from './server/routes/folders.js'
import worksheetsRoutes from './server/routes/worksheets.js'
import generateRoutes from './server/routes/generate.js'
import healthRoutes from './server/routes/health.js'
import adminRoutes from './server/routes/admin.js'
import telegramRoutes from './server/routes/telegram.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3000

// ==================== MIDDLEWARE ====================

// Parse JSON bodies
app.use(express.json())

// Parse cookies
app.use(cookieParser())

// Security headers (moved from vercel.json)
app.use((_req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://telegram.org; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.openai.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  )
  next()
})

// ==================== API ROUTES ====================

app.use('/api/auth', authRoutes)
app.use('/api/folders', foldersRoutes)
app.use('/api/worksheets', worksheetsRoutes)
app.use('/api/generate', generateRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/telegram', telegramRoutes)
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

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err)
  res.status(500).json({ error: 'Internal server error' })
})

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app

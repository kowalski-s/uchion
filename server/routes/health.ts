import { Router } from 'express'
import type { Request, Response } from 'express'

const router = Router()

// ==================== GET /api/health ====================
router.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend API is running!'
  })
})

// ==================== GET /api/pdf ====================
// PDF generation is now client-side only
router.get('/pdf', (_req: Request, res: Response) => {
  return res.status(405).json({ error: 'PDF generation is client-side only now' })
})

export default router

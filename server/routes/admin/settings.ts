import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { eq } from 'drizzle-orm'
import { withAdminAuth } from '../../middleware/auth.js'
import { requireRateLimit } from '../../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../../types.js'

const router = Router()

// ==================== GET /api/admin/settings ====================
router.get('/', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  const [user] = await db
    .select({
      telegramChatId: users.telegramChatId,
      wantsAlerts: users.wantsAlerts,
    })
    .from(users)
    .where(eq(users.id, req.user.id))
    .limit(1)

  return res.json({
    telegramChatId: user?.telegramChatId || null,
    wantsAlerts: user?.wantsAlerts || false,
  })
}))

// ==================== POST /api/admin/settings/telegram ====================
const UpdateTelegramSchema = z.object({
  chatId: z.string().regex(/^\d+$/, 'Chat ID должен содержать только цифры').min(1).max(20),
})

router.post('/telegram', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:settings:${req.user.id}`,
  })

  const parse = UpdateTelegramSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      error: parse.error.flatten().fieldErrors.chatId?.[0] || 'Некорректный Chat ID',
    })
  }

  const { chatId } = parse.data

  await db
    .update(users)
    .set({
      telegramChatId: chatId,
      wantsAlerts: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.user.id))

  console.log(`[Admin Settings] ${req.user.email} linked Telegram chatId=${chatId}`)

  return res.json({
    success: true,
    telegramChatId: chatId,
    wantsAlerts: true,
  })
}))

// ==================== DELETE /api/admin/settings/telegram ====================
router.delete('/telegram', withAdminAuth(async (req: AuthenticatedRequest, res: Response) => {
  await requireRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `admin:settings:${req.user.id}`,
  })

  await db
    .update(users)
    .set({
      telegramChatId: null,
      wantsAlerts: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, req.user.id))

  console.log(`[Admin Settings] ${req.user.email} unlinked Telegram`)

  return res.json({
    success: true,
    telegramChatId: null,
    wantsAlerts: false,
  })
}))

export default router

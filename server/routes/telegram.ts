/**
 * Telegram Bot Webhook Routes
 * Handles incoming messages from Telegram Bot API
 */

import { Router } from 'express'
import type { Request, Response } from 'express'
import { verifyWebhookSecret } from '../../api/_lib/telegram/bot.js'
import { handleTelegramUpdate, type TelegramUpdate } from '../../api/_lib/telegram/commands.js'

const router = Router()

// ==================== POST /api/telegram/webhook ====================
/**
 * Webhook endpoint for receiving Telegram bot updates
 *
 * Telegram sends updates here when users interact with the bot.
 * The endpoint verifies the request authenticity and processes commands.
 *
 * Security:
 * - Uses X-Telegram-Bot-Api-Secret-Token header for verification
 * - Set TELEGRAM_WEBHOOK_SECRET in environment variables
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Verify the request is from Telegram using secret token
    const secretToken = req.headers['x-telegram-bot-api-secret-token'] as string | undefined
    const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET

    if (!verifyWebhookSecret(secretToken, expectedToken)) {
      console.error('[Telegram Webhook] Invalid secret token')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const update = req.body as TelegramUpdate

    // Validate basic update structure
    if (!update || typeof update.update_id !== 'number') {
      console.error('[Telegram Webhook] Invalid update format')
      return res.status(400).json({ error: 'Invalid update format' })
    }

    // Process the update asynchronously (don't wait for completion)
    // Telegram expects a quick 200 OK response
    handleTelegramUpdate(update).catch((error) => {
      console.error('[Telegram Webhook] Error processing update:', error)
    })

    // Always return 200 OK to Telegram
    // Even if processing fails, we don't want Telegram to retry
    return res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Unexpected error:', error)
    // Still return 200 to prevent Telegram from retrying
    return res.status(200).json({ ok: true })
  }
})

export default router

/**
 * Telegram Bot Webhook Routes
 * Handles incoming messages from Telegram Bot API
 */
import { Router } from 'express';
import { verifyWebhookSecret } from '../../api/_lib/telegram/bot.js';
import { handleTelegramUpdate } from '../../api/_lib/telegram/commands.js';
const router = Router();
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
router.post('/webhook', async (req, res) => {
    // Log that we received a request (before any validation)
    console.log('[Telegram Webhook] Received request');
    try {
        // Verify the request is from Telegram using secret token
        const secretToken = req.headers['x-telegram-bot-api-secret-token'];
        const expectedToken = process.env.TELEGRAM_WEBHOOK_SECRET;
        // Log secret token status for debugging
        console.log('[Telegram Webhook] Secret token in request:', secretToken ? 'present' : 'missing');
        console.log('[Telegram Webhook] Expected token configured:', expectedToken ? 'yes' : 'no');
        if (!verifyWebhookSecret(secretToken, expectedToken)) {
            console.error('[Telegram Webhook] Invalid secret token - rejecting request');
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const update = req.body;
        // Log incoming update details
        console.log('[Telegram Webhook] Update ID:', update?.update_id);
        if (update?.message) {
            console.log('[Telegram Webhook] Message from:', update.message.from?.username || update.message.from?.id);
            console.log('[Telegram Webhook] Chat ID:', update.message.chat?.id);
            console.log('[Telegram Webhook] Text:', update.message.text);
        }
        // Validate basic update structure
        if (!update || typeof update.update_id !== 'number') {
            console.error('[Telegram Webhook] Invalid update format');
            return res.status(400).json({ error: 'Invalid update format' });
        }
        // Process the update asynchronously (don't wait for completion)
        // Telegram expects a quick 200 OK response
        handleTelegramUpdate(update).catch((error) => {
            console.error('[Telegram Webhook] Error processing update:', error);
        });
        console.log('[Telegram Webhook] Returning 200 OK');
        // Always return 200 OK to Telegram
        // Even if processing fails, we don't want Telegram to retry
        return res.status(200).json({ ok: true });
    }
    catch (error) {
        console.error('[Telegram Webhook] Unexpected error:', error);
        // Still return 200 to prevent Telegram from retrying
        return res.status(200).json({ ok: true });
    }
});
export default router;
//# sourceMappingURL=telegram.js.map
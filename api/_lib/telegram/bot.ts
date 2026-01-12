/**
 * Telegram Bot API utilities
 * Used for sending alerts to admins and handling bot commands
 */

import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { eq, and, isNotNull } from 'drizzle-orm'

// ==================== TYPES ====================

export type AlertLevel = 'info' | 'warning' | 'critical'

interface SendMessageOptions {
  chatId: string
  text: string
  parseMode?: 'HTML' | 'Markdown'
}

interface SendAlertOptions {
  message: string
  level: AlertLevel
}

interface TelegramApiResponse {
  ok: boolean
  result?: unknown
  description?: string
  error_code?: number
}

// ==================== CONSTANTS ====================

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

const ALERT_EMOJI: Record<AlertLevel, string> = {
  info: '\u2139\ufe0f',      // info emoji
  warning: '\u26a0\ufe0f',   // warning emoji
  critical: '\ud83d\udea8',  // critical emoji
}

const ALERT_PREFIX: Record<AlertLevel, string> = {
  info: 'INFO',
  warning: 'WARNING',
  critical: 'CRITICAL',
}

// ==================== CORE FUNCTIONS ====================

/**
 * Get the Telegram bot token from environment
 */
function getBotToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN || null
}

/**
 * Send a message to a specific Telegram chat
 */
export async function sendTelegramMessage(options: SendMessageOptions): Promise<boolean> {
  const { chatId, text, parseMode = 'HTML' } = options
  const botToken = getBotToken()

  if (!botToken) {
    console.error('[Telegram Bot] TELEGRAM_BOT_TOKEN not configured')
    return false
  }

  try {
    const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
      }),
    })

    const data = await response.json() as TelegramApiResponse

    if (!data.ok) {
      console.error('[Telegram Bot] Failed to send message:', data.description)
      return false
    }

    return true
  } catch (error) {
    console.error('[Telegram Bot] Error sending message:', error)
    return false
  }
}

/**
 * Send an alert to all admins who have alerts enabled
 *
 * @param options - Alert options (message and level)
 * @returns Object with success status and count of messages sent
 *
 * @example
 * await sendAdminAlert({
 *   message: 'Server is experiencing high load',
 *   level: 'warning'
 * })
 */
export async function sendAdminAlert(options: SendAlertOptions): Promise<{ success: boolean; sentCount: number }> {
  const { message, level } = options

  try {
    // Find all admins with alerts enabled and chat ID set
    const admins = await db
      .select({
        id: users.id,
        email: users.email,
        telegramChatId: users.telegramChatId,
      })
      .from(users)
      .where(
        and(
          eq(users.role, 'admin'),
          eq(users.wantsAlerts, true),
          isNotNull(users.telegramChatId)
        )
      )

    if (admins.length === 0) {
      console.log('[Telegram Alert] No admins subscribed to alerts')
      return { success: true, sentCount: 0 }
    }

    // Format the alert message
    const emoji = ALERT_EMOJI[level]
    const prefix = ALERT_PREFIX[level]
    const formattedMessage = `${emoji} <b>[${prefix}]</b>\n\n${message}`

    let sentCount = 0
    const errors: string[] = []

    // Send to all subscribed admins
    for (const admin of admins) {
      if (!admin.telegramChatId) continue

      const sent = await sendTelegramMessage({
        chatId: admin.telegramChatId,
        text: formattedMessage,
        parseMode: 'HTML',
      })

      if (sent) {
        sentCount++
        console.log(`[Telegram Alert] Sent ${level} alert to admin ${admin.email}`)
      } else {
        errors.push(`Failed to send to ${admin.email}`)
      }
    }

    if (errors.length > 0) {
      console.error('[Telegram Alert] Some alerts failed:', errors)
    }

    return {
      success: errors.length === 0,
      sentCount,
    }
  } catch (error) {
    console.error('[Telegram Alert] Error sending alerts:', error)
    return { success: false, sentCount: 0 }
  }
}

/**
 * Verify that a webhook request is from Telegram
 * Uses the secret token method (X-Telegram-Bot-Api-Secret-Token header)
 *
 * @param secretToken - The secret token from the request header
 * @param expectedToken - The expected secret token (from env)
 */
export function verifyWebhookSecret(secretToken: string | undefined, expectedToken: string | undefined): boolean {
  if (!expectedToken) {
    // If no secret token is configured, skip verification (not recommended for production)
    console.warn('[Telegram Webhook] No secret token configured - skipping verification')
    return true
  }

  if (!secretToken) {
    console.error('[Telegram Webhook] Missing secret token in request')
    return false
  }

  return secretToken === expectedToken
}

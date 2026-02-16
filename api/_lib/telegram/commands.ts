/**
 * Telegram Bot command handlers
 * Processes commands sent to the bot by users
 */

import { db } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { eq, and } from 'drizzle-orm'
import { sendTelegramMessage } from './bot.js'

// ==================== TYPES ====================

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
}

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  first_name?: string
  last_name?: string
  username?: string
}

// ==================== RESPONSE MESSAGES ====================

const MESSAGES = {
  SUBSCRIBED: '\u2705 \u0412\u044b \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u043d\u044b \u043d\u0430 \u0430\u043b\u0435\u0440\u0442\u044b!',
  UNSUBSCRIBED: '\u274c \u0412\u044b \u043e\u0442\u043f\u0438\u0441\u0430\u043d\u044b \u043e\u0442 \u0430\u043b\u0435\u0440\u0442\u043e\u0432',
  ALERTS_ON: '\u2705 \u0410\u043b\u0435\u0440\u0442\u044b \u0432\u043a\u043b\u044e\u0447\u0435\u043d\u044b',
  ALERTS_OFF: '\u274c \u0410\u043b\u0435\u0440\u0442\u044b \u0432\u044b\u043a\u043b\u044e\u0447\u0435\u043d\u044b',
  NOT_ADMIN: '\u274c \u0422\u043e\u043b\u044c\u043a\u043e \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u044b \u043c\u043e\u0433\u0443\u0442 \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f \u043d\u0430 \u0430\u043b\u0435\u0440\u0442\u044b',
  USER_NOT_FOUND: '\u274c \u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d. \u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0432\u0430\u0448 Chat ID \u0432 \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430\u0445 \u0430\u0434\u043c\u0438\u043d-\u043f\u0430\u043d\u0435\u043b\u0438',
  HELP: '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u043a\u043e\u043c\u0430\u043d\u0434\u044b:\n/subscribe - \u043f\u043e\u0434\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f \u043d\u0430 \u0430\u043b\u0435\u0440\u0442\u044b\n/unsubscribe - \u043e\u0442\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f \u043e\u0442 \u0430\u043b\u0435\u0440\u0442\u043e\u0432\n/status - \u043f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0441\u0442\u0430\u0442\u0443\u0441 \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438',
  ERROR: '\u274c \u041f\u0440\u043e\u0438\u0437\u043e\u0448\u043b\u0430 \u043e\u0448\u0438\u0431\u043a\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435',
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Find a user by their Telegram ID.
 * First tries provider='telegram' + providerId (legacy login).
 * Falls back to telegramChatId (linked via admin settings).
 */
async function findUserByTelegramId(telegramId: string) {
  // 1. Legacy: user logged in via Telegram OAuth
  const [byProvider] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      wantsAlerts: users.wantsAlerts,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(
      and(
        eq(users.provider, 'telegram'),
        eq(users.providerId, telegramId)
      )
    )
    .limit(1)

  if (byProvider) return byProvider

  // 2. Fallback: admin linked Chat ID via settings page
  const [byChatId] = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      wantsAlerts: users.wantsAlerts,
      telegramChatId: users.telegramChatId,
    })
    .from(users)
    .where(eq(users.telegramChatId, telegramId))
    .limit(1)

  return byChatId || null
}

/**
 * Update user's alert subscription status
 */
async function updateAlertSubscription(userId: string, chatId: string, wantsAlerts: boolean) {
  await db
    .update(users)
    .set({
      telegramChatId: chatId,
      wantsAlerts,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

/**
 * Disable alerts for a user
 */
async function disableAlerts(userId: string) {
  await db
    .update(users)
    .set({
      wantsAlerts: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
}

// ==================== COMMAND HANDLERS ====================

/**
 * Handle /subscribe command
 * Subscribes an admin to receive alerts
 */
async function handleSubscribe(telegramId: string, chatId: string): Promise<string> {
  const user = await findUserByTelegramId(telegramId)

  if (!user) {
    return MESSAGES.USER_NOT_FOUND
  }

  if (user.role !== 'admin') {
    return MESSAGES.NOT_ADMIN
  }

  await updateAlertSubscription(user.id, chatId, true)
  console.log(`[Telegram Bot] Admin ${user.email} subscribed to alerts (chatId: ${chatId})`)

  return MESSAGES.SUBSCRIBED
}

/**
 * Handle /unsubscribe command
 * Unsubscribes a user from alerts
 */
async function handleUnsubscribe(telegramId: string): Promise<string> {
  const user = await findUserByTelegramId(telegramId)

  if (!user) {
    return MESSAGES.USER_NOT_FOUND
  }

  await disableAlerts(user.id)
  console.log(`[Telegram Bot] User ${user.email} unsubscribed from alerts`)

  return MESSAGES.UNSUBSCRIBED
}

/**
 * Handle /status command
 * Shows current subscription status
 */
async function handleStatus(telegramId: string): Promise<string> {
  const user = await findUserByTelegramId(telegramId)

  if (!user) {
    return MESSAGES.USER_NOT_FOUND
  }

  return user.wantsAlerts ? MESSAGES.ALERTS_ON : MESSAGES.ALERTS_OFF
}

// ==================== MAIN HANDLER ====================

/**
 * Process an incoming Telegram update (webhook payload)
 */
export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  console.log('[Telegram Bot] Processing update...')

  const message = update.message

  // Only process text messages from users (not bots)
  if (!message || !message.text || !message.from || message.from.is_bot) {
    console.log('[Telegram Bot] Skipping: no message, no text, no from, or is_bot')
    return
  }

  const telegramId = String(message.from.id)
  const chatId = String(message.chat.id)
  const text = message.text.trim()

  console.log(`[Telegram Bot] Processing command from telegramId=${telegramId}, chatId=${chatId}, text="${text}"`)

  let response: string

  try {
    // Parse command (remove bot username if present, e.g., /subscribe@BotName)
    const command = text.split('@')[0].toLowerCase()
    console.log(`[Telegram Bot] Parsed command: "${command}"`)

    switch (command) {
      case '/subscribe':
        console.log('[Telegram Bot] Handling /subscribe...')
        response = await handleSubscribe(telegramId, chatId)
        break

      case '/unsubscribe':
        console.log('[Telegram Bot] Handling /unsubscribe...')
        response = await handleUnsubscribe(telegramId)
        break

      case '/status':
        console.log('[Telegram Bot] Handling /status...')
        response = await handleStatus(telegramId)
        break

      case '/start':
      case '/help':
        console.log('[Telegram Bot] Handling /start or /help...')
        response = MESSAGES.HELP
        break

      default:
        // Ignore non-command messages or respond with help
        if (text.startsWith('/')) {
          console.log('[Telegram Bot] Unknown command, returning help')
          response = MESSAGES.HELP
        } else {
          console.log('[Telegram Bot] Not a command, ignoring')
          // Ignore regular messages
          return
        }
    }

    console.log(`[Telegram Bot] Response: "${response}"`)
  } catch (error) {
    console.error('[Telegram Bot] Error handling command:', error)
    response = MESSAGES.ERROR
  }

  // Send response back to the user
  console.log(`[Telegram Bot] Sending response to chatId=${chatId}...`)
  const sent = await sendTelegramMessage({
    chatId,
    text: response,
  })
  console.log(`[Telegram Bot] Message sent: ${sent}`)
}

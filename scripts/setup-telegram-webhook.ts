/**
 * Script to setup Telegram bot webhook
 *
 * Usage:
 *   npx tsx scripts/setup-telegram-webhook.ts set <url>     # Set webhook URL
 *   npx tsx scripts/setup-telegram-webhook.ts info          # Get current webhook info
 *   npx tsx scripts/setup-telegram-webhook.ts delete        # Delete webhook
 *
 * Environment variables:
 *   TELEGRAM_BOT_TOKEN - Required. The bot token from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET - Optional. Secret token for webhook verification
 *
 * Example:
 *   npx tsx scripts/setup-telegram-webhook.ts set https://yourdomain.com/api/telegram/webhook
 */

import 'dotenv/config'

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

interface TelegramResponse {
  ok: boolean
  result?: unknown
  description?: string
}

interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
  max_connections?: number
  allowed_updates?: string[]
}

async function callTelegramApi<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables')
  }

  const response = await fetch(`${TELEGRAM_API_BASE}${botToken}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: params ? JSON.stringify(params) : undefined,
  })

  const data = await response.json() as TelegramResponse

  if (!data.ok) {
    throw new Error(data.description || 'Telegram API error')
  }

  return data.result as T
}

async function setWebhook(url: string): Promise<void> {
  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET

  console.log('\nSetting webhook...')
  console.log(`URL: ${url}`)

  if (secretToken) {
    console.log('Secret token: [configured]')
  } else {
    console.log('Secret token: [not configured - consider setting TELEGRAM_WEBHOOK_SECRET]')
  }

  const params: Record<string, unknown> = {
    url,
    allowed_updates: ['message'], // Only receive message updates
  }

  if (secretToken) {
    params.secret_token = secretToken
  }

  await callTelegramApi('setWebhook', params)

  console.log('\nWebhook set successfully!')
}

async function getWebhookInfo(): Promise<void> {
  console.log('\nGetting webhook info...\n')

  const info = await callTelegramApi<WebhookInfo>('getWebhookInfo')

  console.log('Current webhook configuration:')
  console.log('-----------------------------')

  if (info.url) {
    console.log(`URL: ${info.url}`)
  } else {
    console.log('URL: [not set]')
  }

  console.log(`Pending updates: ${info.pending_update_count}`)

  if (info.last_error_date) {
    const errorDate = new Date(info.last_error_date * 1000)
    console.log(`\nLast error: ${errorDate.toISOString()}`)
    console.log(`Error message: ${info.last_error_message}`)
  }

  if (info.max_connections) {
    console.log(`Max connections: ${info.max_connections}`)
  }

  if (info.allowed_updates && info.allowed_updates.length > 0) {
    console.log(`Allowed updates: ${info.allowed_updates.join(', ')}`)
  }
}

async function deleteWebhook(): Promise<void> {
  console.log('\nDeleting webhook...')

  await callTelegramApi('deleteWebhook')

  console.log('Webhook deleted successfully!')
}

async function showHelp(): Promise<void> {
  console.log(`
Telegram Webhook Setup Script
==============================

Usage:
  npx tsx scripts/setup-telegram-webhook.ts <command> [args]

Commands:
  set <url>  - Set the webhook URL
  info       - Show current webhook configuration
  delete     - Remove the webhook

Environment Variables:
  TELEGRAM_BOT_TOKEN       - Required. Your bot token from @BotFather
  TELEGRAM_WEBHOOK_SECRET  - Optional. Secret token for request verification

Examples:
  # Set webhook for production
  npx tsx scripts/setup-telegram-webhook.ts set https://uchion.ru/api/telegram/webhook

  # Check current webhook
  npx tsx scripts/setup-telegram-webhook.ts info

  # Remove webhook (useful for development with polling)
  npx tsx scripts/setup-telegram-webhook.ts delete
`)
}

async function main() {
  const command = process.argv[2]
  const url = process.argv[3]

  try {
    switch (command) {
      case 'set':
        if (!url) {
          console.error('\nError: URL is required for set command')
          console.error('Usage: npx tsx scripts/setup-telegram-webhook.ts set <url>')
          process.exit(1)
        }
        await setWebhook(url)
        break

      case 'info':
        await getWebhookInfo()
        break

      case 'delete':
        await deleteWebhook()
        break

      case 'help':
      case '--help':
      case '-h':
        await showHelp()
        break

      default:
        if (command) {
          console.error(`\nUnknown command: ${command}`)
        }
        await showHelp()
        process.exit(command ? 1 : 0)
    }
  } catch (error) {
    console.error('\nError:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))

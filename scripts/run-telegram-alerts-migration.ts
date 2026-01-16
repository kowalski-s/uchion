/**
 * Script to apply telegram_alerts migration
 * Adds telegram_chat_id and wants_alerts columns to users table
 *
 * Usage: npx tsx scripts/run-telegram-alerts-migration.ts
 */

import 'dotenv/config'
import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'

async function runMigration() {
  console.log('Running Telegram Alerts migration...\n')

  try {
    // 1. Add telegram_chat_id column
    console.log('Adding telegram_chat_id column to users table...')
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(50)`)
    console.log('  Done.')

    // 2. Add wants_alerts column
    console.log('Adding wants_alerts column to users table...')
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS wants_alerts BOOLEAN NOT NULL DEFAULT false`)
    console.log('  Done.')

    console.log('\nMigration completed successfully!')
  } catch (error) {
    console.error('\nMigration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()

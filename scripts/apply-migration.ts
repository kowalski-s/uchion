import 'dotenv/config'
import { db } from '../db'
import { sql } from 'drizzle-orm'

async function applyMigration() {
  try {
    console.log('Applying migration: Add email_verified and image columns...')

    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified" timestamp with time zone`)
    console.log('✓ Added email_verified column')

    await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "image" text`)
    console.log('✓ Added image column')

    console.log('\nMigration applied successfully!')
    process.exit(0)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()

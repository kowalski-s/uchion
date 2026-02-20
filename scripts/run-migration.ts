import * as dotenv from 'dotenv'
dotenv.config()

import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'

async function runMigration() {
  console.log('Running migration: add prodamus_profile_id...')

  try {
    await db.execute(sql`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "prodamus_profile_id" varchar(50)`)
    console.log('Done! Column prodamus_profile_id added.')

    // Verify
    const result = await db.execute(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'subscriptions' AND column_name = 'prodamus_profile_id'
    `)
    console.log('Verification:', Array.isArray(result) ? (result.length > 0 ? 'Column exists' : 'FAILED') : 'OK (query ran)')

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()

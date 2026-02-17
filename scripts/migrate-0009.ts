/**
 * Migration 0009: Add started_at and completed_at to generations table
 * Run: npx tsx scripts/migrate-0009.ts
 */
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true })
dotenv.config({ path: '.env' })

import postgres from 'postgres'

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const sql = postgres(DATABASE_URL, { max: 1 })

async function migrate() {
  console.log('[Migration 0009] Adding started_at and completed_at to generations...')

  // Check if columns already exist
  const existing = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'generations' AND column_name IN ('started_at', 'completed_at')
  `

  const existingCols = existing.map(r => r.column_name)

  if (existingCols.includes('started_at') && existingCols.includes('completed_at')) {
    console.log('[Migration 0009] Columns already exist, skipping.')
  } else {
    if (!existingCols.includes('started_at')) {
      await sql`ALTER TABLE generations ADD COLUMN started_at timestamptz`
      console.log('[Migration 0009] Added started_at')
    }
    if (!existingCols.includes('completed_at')) {
      await sql`ALTER TABLE generations ADD COLUMN completed_at timestamptz`
      console.log('[Migration 0009] Added completed_at')
    }
  }

  console.log('[Migration 0009] Done.')
  await sql.end()
}

migrate().catch(err => {
  console.error('[Migration 0009] Failed:', err)
  process.exit(1)
})

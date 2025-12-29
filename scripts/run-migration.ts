import * as dotenv from 'dotenv'
dotenv.config()

import { db } from '../db/index.js'
import { sql } from 'drizzle-orm'

async function runMigration() {
  console.log('Running OAuth migration...')

  try {
    // 1. Add OAuth columns to users table
    console.log('Adding provider columns to users table...')
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider VARCHAR(50)`)
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id VARCHAR(255)`)

    // 2. Create index for OAuth lookups
    console.log('Creating users_provider_idx index...')
    await db.execute(sql`CREATE INDEX IF NOT EXISTS users_provider_idx ON users(provider, provider_id)`)

    // 3. Create refresh_tokens table
    console.log('Creating refresh_tokens table...')
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        jti VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // 4. Create indexes for refresh_tokens
    console.log('Creating refresh_tokens indexes...')
    await db.execute(sql`CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS refresh_tokens_jti_idx ON refresh_tokens(jti)`)

    console.log('Migration completed successfully!')

    // Optional: Drop old NextAuth tables
    // Uncomment these lines after verifying the migration works
    // console.log('Dropping old NextAuth tables...')
    // await db.execute(sql`DROP TABLE IF EXISTS accounts`)
    // await db.execute(sql`DROP TABLE IF EXISTS sessions`)
    // await db.execute(sql`DROP TABLE IF EXISTS verification_tokens`)
    // console.log('NextAuth tables dropped.')

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()

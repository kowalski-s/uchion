import * as dotenv from 'dotenv'
// Load env BEFORE any other imports
dotenv.config({ path: '.env.local' })
dotenv.config() // fallback to .env

// Dynamic import after dotenv is loaded
async function runMigration() {
  const { db } = await import('../db/index.js')
  const { sql } = await import('drizzle-orm')

  console.log('Running folders and worksheet titles migration...')

  try {
    // 1. Create folders table
    console.log('Creating folders table...')
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(7) DEFAULT '#6366f1',
        parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `)

    // 2. Create indexes for folders
    console.log('Creating folders indexes...')
    await db.execute(sql`CREATE INDEX IF NOT EXISTS folders_user_id_idx ON folders(user_id)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS folders_parent_id_idx ON folders(parent_id)`)
    await db.execute(sql`CREATE INDEX IF NOT EXISTS folders_deleted_at_idx ON folders(deleted_at)`)

    // 3. Add folder_id and title columns to worksheets
    console.log('Adding folder_id column to worksheets...')
    await db.execute(sql`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES folders(id) ON DELETE SET NULL`)

    console.log('Adding title column to worksheets...')
    await db.execute(sql`ALTER TABLE worksheets ADD COLUMN IF NOT EXISTS title VARCHAR(200)`)

    // 4. Create index for folder_id in worksheets
    console.log('Creating worksheets_folder_id_idx index...')
    await db.execute(sql`CREATE INDEX IF NOT EXISTS worksheets_folder_id_idx ON worksheets(folder_id)`)

    console.log('Migration completed successfully!')

  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }

  process.exit(0)
}

runMigration()

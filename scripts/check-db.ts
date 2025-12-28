import 'dotenv/config'
import { db } from '../db'
import { users } from '../db/schema'
import { sql } from 'drizzle-orm'

async function checkDatabase() {
  try {
    console.log('Checking database connection...')

    // Check if users table exists
    const result = await db.select().from(users).limit(1)
    console.log('✓ Database connection successful')
    console.log('✓ Users table exists')
    console.log('Number of users:', result.length)

    // Check table structure
    const tableInfo = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `)

    console.log('\nUsers table structure:')
    console.log(tableInfo.rows)

    process.exit(0)
  } catch (error) {
    console.error('Database check failed:', error)
    process.exit(1)
  }
}

checkDatabase()

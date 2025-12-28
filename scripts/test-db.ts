import 'dotenv/config'
import { db } from '../db'
import { users } from '../db/schema'

async function testDB() {
  console.log('Testing database connection...')
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET ✅' : 'NOT SET ❌')

  try {
    console.log('\nTrying to query users table...')
    const allUsers = await db.select().from(users).limit(1)
    console.log('✅ Database connection successful!')
    console.log('Found users:', allUsers.length)
    process.exit(0)
  } catch (error) {
    console.error('❌ Database connection failed!')
    console.error('Error:', error instanceof Error ? error.message : String(error))
    console.error('Stack:', error instanceof Error ? error.stack : 'No stack trace')
    process.exit(1)
  }
}

testDB()

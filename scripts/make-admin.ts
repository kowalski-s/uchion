/**
 * Script to grant admin role to a user
 * Usage: npx tsx scripts/make-admin.ts <email-or-id>
 */

import 'dotenv/config'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq, or, desc } from 'drizzle-orm'

async function main() {
  const arg = process.argv[2]

  if (!arg) {
    // Show recent users if no argument
    console.log('\nПоследние 10 пользователей:\n')

    const recentUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        provider: users.provider,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10)

    recentUsers.forEach((user, i) => {
      const roleIcon = user.role === 'admin' ? '👑' : '  '
      console.log(`${roleIcon} ${i + 1}. ${user.email}`)
      console.log(`      ID: ${user.id}`)
      console.log(`      Имя: ${user.name || '-'} | Провайдер: ${user.provider}`)
      console.log()
    })

    console.log('\nИспользование: npx tsx scripts/make-admin.ts <email или id>\n')
    process.exit(0)
  }

  // Find user by email or ID
  const [user] = await db
    .select()
    .from(users)
    .where(or(
      eq(users.email, arg),
      eq(users.id, arg)
    ))
    .limit(1)

  if (!user) {
    console.error(`\n❌ Пользователь не найден: ${arg}\n`)
    process.exit(1)
  }

  if (user.role === 'admin') {
    console.log(`\n✅ Пользователь ${user.email} уже является администратором\n`)
    process.exit(0)
  }

  // Update role to admin
  await db
    .update(users)
    .set({ role: 'admin', updatedAt: new Date() })
    .where(eq(users.id, user.id))

  console.log(`\n✅ Пользователь ${user.email} теперь администратор!\n`)
  console.log(`   Перейди на /admin для доступа к админ-панели\n`)
}

main()
  .catch(console.error)
  .finally(() => process.exit(0))

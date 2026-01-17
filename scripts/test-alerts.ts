/**
 * Test script for generation alerts
 * Usage: npx tsx scripts/test-alerts.ts
 */

import 'dotenv/config'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { createAccessToken } from '../api/_lib/auth/tokens.js'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

async function getAdminToken(): Promise<string> {
  // Find an admin user
  const [admin] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1)

  if (!admin) {
    throw new Error('No admin user found in database')
  }

  console.log(`Found admin: ${admin.email}`)

  // Create access token
  const token = createAccessToken({
    userId: admin.id,
    email: admin.email,
    role: admin.role,
  })

  return token
}

async function testEndpoint(
  name: string,
  method: string,
  path: string,
  token: string,
  body?: object
): Promise<void> {
  console.log(`\n=== ${name} ===`)
  console.log(`${method} ${path}`)

  const headers: Record<string, string> = {
    Cookie: `uchion_access_token=${token}`,
  }
  if (body) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await response.json()
  console.log(`Status: ${response.status}`)
  console.log('Response:', JSON.stringify(data, null, 2))
}

async function main() {
  console.log('🔐 Getting admin token...')
  const token = await getAdminToken()
  console.log('✅ Token obtained')

  // Test 1: Get current metrics
  await testEndpoint('Get Metrics', 'GET', '/api/admin/alerts/metrics', token)

  // Test 2: Reset state
  await testEndpoint('Reset State', 'POST', '/api/admin/alerts/reset', token)

  // Test 3: Test high error rate alert
  console.log('\n' + '='.repeat(50))
  console.log('Testing HIGH ERROR RATE alert (>10% failures)')
  console.log('='.repeat(50))

  await testEndpoint(
    'Test Error Rate Alert',
    'POST',
    '/api/admin/alerts/test/error-rate',
    token,
    { totalGenerations: 20, failRate: 0.15 } // 15% fail rate
  )

  // Test 4: Reset cooldowns to test again
  await testEndpoint('Reset Cooldowns', 'POST', '/api/admin/alerts/reset-cooldowns', token)

  // Test 5: Test timeout alert
  console.log('\n' + '='.repeat(50))
  console.log('Testing AI TIMEOUT alert (3 consecutive timeouts)')
  console.log('='.repeat(50))

  await testEndpoint(
    'Test Timeout Alert',
    'POST',
    '/api/admin/alerts/test/timeout',
    token,
    { consecutiveTimeouts: 3 }
  )

  // Test 6: Test low quality alert
  console.log('\n' + '='.repeat(50))
  console.log('Testing LOW QUALITY alert (score < 8)')
  console.log('='.repeat(50))

  await testEndpoint(
    'Test Low Quality Alert',
    'POST',
    '/api/admin/alerts/test/low-quality',
    token,
    { score: 5, topic: 'Деление с остатком', subject: 'math', grade: 3 }
  )

  // Final metrics
  await testEndpoint('Final Metrics', 'GET', '/api/admin/alerts/metrics', token)

  console.log('\n✅ All tests completed!')
  process.exit(0)
}

main().catch((err) => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})

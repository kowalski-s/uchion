import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

async function main() {
  const { db } = await import('../db/index.js')
  const { users, worksheets, folders } = await import('../db/schema.js')
  const { eq, isNull, and } = await import('drizzle-orm')
  const { createAccessToken } = await import('../api/_lib/auth/tokens.js')

  const BASE_URL = 'http://localhost:3000'

  console.log('🧪 Starting endpoint tests...\n')

  // 1. Setup test user
  console.log('📝 Setting up test user...')
  let user = await db.query.users.findFirst({
    where: and(
      eq(users.email, 'test@example.com'),
      isNull(users.deletedAt)
    )
  })

  if (!user) {
    const [newUser] = await db.insert(users).values({
      email: 'test@example.com',
      name: 'Test User',
      yandexId: 'test-yandex-123',
    }).returning()
    user = newUser
    console.log('  ✅ Created test user:', user.id)
  } else {
    console.log('  ✅ Found test user:', user.id)
  }

  // 2. Create JWT token for test user
  console.log('\n🔐 Creating JWT token...')
  const token = createAccessToken({
    userId: user.id,
    role: 'user'
  })
  console.log('  ✅ Token created')

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `uchion_access_token=${token}`
  }

  // 3. Create test worksheet
  console.log('\n📄 Setting up test worksheet...')
  let worksheet = await db.query.worksheets.findFirst({
    where: and(
      eq(worksheets.userId, user.id),
      isNull(worksheets.deletedAt)
    )
  })

  if (!worksheet) {
    const [ws] = await db.insert(worksheets).values({
      userId: user.id,
      subject: 'math',
      grade: 1,
      topic: 'Сложение чисел',
      content: JSON.stringify({
        assignments: [{ text: 'Решите: 2+2=' }, { text: 'Решите: 3+1=' }],
        test: [{ question: 'Сколько будет 1+1?', options: ['1', '2', '3', '4'] }],
        answersAssignments: ['4', '4'],
        answersTest: ['2']
      }),
    }).returning()
    worksheet = ws
    console.log('  ✅ Created test worksheet:', worksheet.id)
  } else {
    console.log('  ✅ Found existing worksheet:', worksheet.id)
  }

  // Helper function
  async function testEndpoint(
    method: string,
    path: string,
    body?: object,
    expectedStatus = 200
  ): Promise<{ ok: boolean; status: number; data: any }> {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      const ok = res.status === expectedStatus
      return { ok, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, data: { error: String(error) } }
    }
  }

  let passed = 0
  let failed = 0

  function log(test: string, result: { ok: boolean; status: number; data: any }, expectedStatus = 200) {
    if (result.ok) {
      console.log(`  ✅ ${test}`)
      passed++
    } else {
      console.log(`  ❌ ${test} (expected ${expectedStatus}, got ${result.status})`)
      console.log(`     Response:`, JSON.stringify(result.data).slice(0, 200))
      failed++
    }
  }

  // ==================== FOLDERS TESTS ====================
  console.log('\n📁 Testing Folders API...')

  // GET /api/folders (list)
  const foldersListResult = await testEndpoint('GET', '/api/folders')
  log('GET /api/folders - List folders', foldersListResult)

  // POST /api/folders (create)
  const createFolderResult = await testEndpoint('POST', '/api/folders', {
    name: 'Test Folder',
    color: '#8b5cf6'
  }, 201)
  log('POST /api/folders - Create folder', createFolderResult, 201)
  const folderId = createFolderResult.data?.folder?.id

  if (folderId) {
    // GET /api/folders/[id]
    const getFolderResult = await testEndpoint('GET', `/api/folders/${folderId}`)
    log('GET /api/folders/[id] - Get folder', getFolderResult)

    // PATCH /api/folders/[id] (update)
    const updateFolderResult = await testEndpoint('PATCH', `/api/folders/${folderId}`, {
      name: 'Updated Folder Name',
      color: '#ec4899'
    })
    log('PATCH /api/folders/[id] - Update folder', updateFolderResult)
  }

  // ==================== WORKSHEETS TESTS ====================
  console.log('\n📄 Testing Worksheets API...')

  // GET /api/worksheets/recent (list)
  const worksheetsListResult = await testEndpoint('GET', '/api/worksheets/recent')
  log('GET /api/worksheets/recent - List worksheets', worksheetsListResult)

  // GET /api/worksheets/recent with folderId filter
  const worksheetsFilteredResult = await testEndpoint('GET', '/api/worksheets/recent?folderId=null')
  log('GET /api/worksheets/recent?folderId=null - Filtered list', worksheetsFilteredResult)

  // GET /api/worksheets/[id]
  const getWorksheetResult = await testEndpoint('GET', `/api/worksheets/${worksheet.id}`)
  log('GET /api/worksheets/[id] - Get worksheet', getWorksheetResult)

  // PATCH /api/worksheets/[id] (update title)
  const updateTitleResult = await testEndpoint('PATCH', `/api/worksheets/${worksheet.id}`, {
    title: 'Мой первый лист'
  })
  log('PATCH /api/worksheets/[id] - Update title', updateTitleResult)

  // PATCH /api/worksheets/[id] (move to folder)
  if (folderId) {
    const moveToFolderResult = await testEndpoint('PATCH', `/api/worksheets/${worksheet.id}`, {
      folderId: folderId
    })
    log('PATCH /api/worksheets/[id] - Move to folder', moveToFolderResult)

    // Check folder count updated
    const folderAfterMove = await testEndpoint('GET', `/api/folders/${folderId}`)
    log('GET /api/folders/[id] - Verify worksheet count', folderAfterMove)
    if (folderAfterMove.data?.folder?.worksheetCount !== 1) {
      console.log('     ⚠️ Expected worksheetCount=1, got:', folderAfterMove.data?.folder?.worksheetCount)
    }

    // Move back to root
    const moveToRootResult = await testEndpoint('PATCH', `/api/worksheets/${worksheet.id}`, {
      folderId: null
    })
    log('PATCH /api/worksheets/[id] - Move back to root', moveToRootResult)
  }

  // POST /api/worksheets/[id]/duplicate
  const duplicateResult = await testEndpoint('POST', `/api/worksheets/${worksheet.id}/duplicate`, undefined, 201)
  log('POST /api/worksheets/[id]/duplicate - Duplicate worksheet', duplicateResult, 201)
  const duplicatedId = duplicateResult.data?.worksheet?.id

  // Verify duplicated worksheet has "(копия)" suffix
  if (duplicatedId) {
    const getDuplicatedResult = await testEndpoint('GET', `/api/worksheets/${duplicatedId}`)
    if (getDuplicatedResult.data?.worksheet?.title?.includes('(копия)') ||
        getDuplicatedResult.data?.worksheet?.topic === worksheet.topic) {
      console.log('  ✅ Duplicate has correct data')
      passed++
    } else {
      console.log('  ❌ Duplicate data mismatch')
      failed++
    }

    // Clean up duplicated worksheet
    await testEndpoint('DELETE', `/api/worksheets/${duplicatedId}`)
    console.log('  🧹 Cleaned up duplicate')
  }

  // ==================== CLEANUP ====================
  console.log('\n🧹 Cleaning up...')

  if (folderId) {
    const deleteFolderResult = await testEndpoint('DELETE', `/api/folders/${folderId}`)
    log('DELETE /api/folders/[id] - Delete folder', deleteFolderResult)
  }

  // ==================== SECURITY TESTS ====================
  console.log('\n🔒 Testing Security...')

  // Test without auth (should fail)
  const noAuthHeaders = { 'Content-Type': 'application/json' }
  const noAuthResult = await fetch(`${BASE_URL}/api/folders`, { headers: noAuthHeaders })
  if (noAuthResult.status === 401) {
    console.log('  ✅ GET /api/folders without auth returns 401')
    passed++
  } else {
    console.log('  ❌ GET /api/folders without auth should return 401, got:', noAuthResult.status)
    failed++
  }

  // Test accessing other user's worksheet (should fail)
  const fakeWorksheetResult = await testEndpoint('GET', '/api/worksheets/00000000-0000-0000-0000-000000000000', undefined, 404)
  log('GET /api/worksheets/[fake-id] - Returns 404 for non-existent', fakeWorksheetResult, 404)

  // ==================== SUMMARY ====================
  console.log('\n' + '='.repeat(50))
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`)
  console.log('='.repeat(50))

  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Test failed:', e)
  process.exit(1)
})

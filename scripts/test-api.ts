import 'dotenv/config'

async function testAPI() {
  console.log('Testing API endpoints...\n')

  const baseUrl = 'http://localhost:3000'

  // Test health endpoint
  console.log('1. Testing /api/health...')
  try {
    const response = await fetch(`${baseUrl}/api/health`)
    const data = await response.json()
    console.log('✅ Health check passed:', data)
  } catch (error) {
    console.error('❌ Health check failed:', error instanceof Error ? error.message : String(error))
  }

  console.log('\n2. Testing /api/auth/csrf...')
  try {
    const response = await fetch(`${baseUrl}/api/auth/csrf`)
    const data = await response.json()
    console.log('✅ CSRF endpoint works:', data)
  } catch (error) {
    console.error('❌ CSRF endpoint failed:', error instanceof Error ? error.message : String(error))
  }

  console.log('\n3. Testing /api/auth/session...')
  try {
    const response = await fetch(`${baseUrl}/api/auth/session`)
    const data = await response.json()
    console.log('✅ Session endpoint works:', data)
  } catch (error) {
    console.error('❌ Session endpoint failed:', error instanceof Error ? error.message : String(error))
  }

  console.log('\nAll tests completed!')
}

testAPI()

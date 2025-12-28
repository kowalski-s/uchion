import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { compare } from 'bcryptjs'

interface LoginRequest {
  email: string
  password: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[LOGIN] Request received:', req.method)

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('[LOGIN] Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password } = req.body as LoginRequest
    console.log('[LOGIN] Attempting login for email:', email)

    // Validate input
    if (!email || !password) {
      console.log('[LOGIN] Missing email or password')
      return res.status(400).json({ error: 'Email and password are required' })
    }

    console.log('[LOGIN] Finding user...')
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (!user) {
      console.log('[LOGIN] User not found')
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    // Check if user has password (OAuth users don't have passwords)
    if (!user.passwordHash) {
      console.log('[LOGIN] User has no password (OAuth account)')
      return res.status(401).json({ error: 'Please sign in with the provider you used to create your account' })
    }

    console.log('[LOGIN] Verifying password...')
    // Verify password
    const isPasswordValid = await compare(password, user.passwordHash)

    if (!isPasswordValid) {
      console.log('[LOGIN] Invalid password')
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    console.log('[LOGIN] Login successful for user:', user.id)

    // Return user data (without password hash)
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        generationsLeft: user.generationsLeft,
      },
    })
  } catch (error) {
    console.error('[LOGIN] Login error:', error)
    console.error('[LOGIN] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[LOGIN] Error message:', error instanceof Error ? error.message : String(error))

    // Return more specific error message in development
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      })
    }

    return res.status(500).json({ error: 'Internal server error' })
  }
}

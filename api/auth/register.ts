import type { VercelRequest, VercelResponse } from '@vercel/node'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../_lib/auth/password.js'

interface RegisterRequest {
  email: string
  password: string
  name?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[REGISTER] Request received:', req.method)

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('[REGISTER] Method not allowed:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, password, name } = req.body as RegisterRequest
    console.log('[REGISTER] Attempting registration for email:', email)

    // Validate input
    if (!email || !password) {
      console.log('[REGISTER] Missing email or password')
      return res.status(400).json({ error: 'Email and password are required' })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      console.log('[REGISTER] Invalid email format:', email)
      return res.status(400).json({ error: 'Invalid email format' })
    }

    // Validate password strength
    if (password.length < 8) {
      console.log('[REGISTER] Password too short')
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    console.log('[REGISTER] Checking if user exists...')
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (existingUser) {
      console.log('[REGISTER] User already exists:', email)
      return res.status(409).json({ error: 'User with this email already exists' })
    }

    console.log('[REGISTER] Hashing password...')
    // Hash password
    const passwordHash = await hashPassword(password)

    console.log('[REGISTER] Creating user in database...')
    // Create user
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        role: 'user',
        generationsLeft: 3, // Free tier starts with 3 generations
      })
      .returning()

    console.log('[REGISTER] User created successfully:', newUser.id)

    // Return user without password hash
    return res.status(201).json({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        generationsLeft: newUser.generationsLeft,
      },
    })
  } catch (error) {
    console.error('[REGISTER] Registration error:', error)
    console.error('[REGISTER] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[REGISTER] Error message:', error instanceof Error ? error.message : String(error))

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

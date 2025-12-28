import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface User {
  id: string
  email: string
  name?: string | null
  role: 'user' | 'admin'
}

export interface Session {
  user: User
  expires: string
}

interface AuthContextType {
  session: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  signIn: (email: string, password: string) => Promise<{ error?: string; ok: boolean }>
  signOut: () => Promise<void>
  signInWithProvider: (provider: 'google' | 'yandex') => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  // Load session from localStorage on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('uchion_session')
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession)
        // Check if session is expired
        if (new Date(sessionData.expires) > new Date()) {
          setSession(sessionData)
          setStatus('authenticated')
        } else {
          localStorage.removeItem('uchion_session')
          setStatus('unauthenticated')
        }
      } catch (error) {
        console.error('Failed to parse session:', error)
        localStorage.removeItem('uchion_session')
        setStatus('unauthenticated')
      }
    } else {
      setStatus('unauthenticated')
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error?: string; ok: boolean }> => {
    try {
      console.log('[AUTH] Signing in...', email)

      // Sign in with our simple login endpoint
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      console.log('[AUTH] Login response status:', response.status)

      if (!response.ok) {
        const data = await response.json()
        console.error('[AUTH] Login failed:', data)
        return { error: data.error || 'Authentication failed', ok: false }
      }

      const data = await response.json()
      console.log('[AUTH] Login successful:', data.user.email)

      // Create a simple session object
      const sessionData = {
        user: data.user,
        expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
      }

      // Save to localStorage
      localStorage.setItem('uchion_session', JSON.stringify(sessionData))

      setSession(sessionData)
      setStatus('authenticated')

      return { ok: true }
    } catch (error) {
      console.error('[AUTH] Sign in error:', error)
      return { error: 'An error occurred during sign in', ok: false }
    }
  }

  const signOut = async () => {
    console.log('[AUTH] Signing out...')
    localStorage.removeItem('uchion_session')
    setSession(null)
    setStatus('unauthenticated')
  }

  const signInWithProvider = (provider: 'google' | 'yandex') => {
    // Redirect to OAuth provider
    window.location.href = `/api/auth/signin/${provider}`
  }

  return (
    <AuthContext.Provider value={{ session, status, signIn, signOut, signInWithProvider }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Compatibility hook similar to next-auth's useSession
export function useSession() {
  const { session, status } = useAuth()
  return {
    data: session,
    status,
  }
}

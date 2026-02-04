import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// ==================== TYPES ====================

export interface UserSubscription {
  plan: 'free' | 'basic' | 'premium'
  status: 'active' | 'canceled' | 'expired' | 'trial'
  expiresAt: string | null
}

export interface User {
  id: string
  email: string
  name?: string | null
  role: 'user' | 'admin'
  generationsLeft: number
  subscription?: UserSubscription
}

interface AuthContextType {
  user: User | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  signInWithYandex: () => void
  signInWithTelegram: () => void
  signOut: () => Promise<void>
  refreshAuth: () => Promise<void>
}

// ==================== CONTEXT ====================

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ==================== PROVIDER ====================

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  // Try to refresh token and get user
  const tryRefresh = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        // Retry getting user info after refresh
        const meResponse = await fetch('/api/auth/me', {
          credentials: 'include',
        })

        if (meResponse.ok) {
          const data = await meResponse.json()
          setUser(data.user)
          setStatus('authenticated')
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }, [])

  // Check authentication on mount
  const checkAuth = useCallback(async () => {    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Important: send cookies
      })      if (response.ok) {
        const data = await response.json()        setUser(data.user)
        setStatus('authenticated')      } else if (response.status === 401) {        // Try to refresh token
        const refreshed = await tryRefresh()
        if (!refreshed) {          setUser(null)
          setStatus('unauthenticated')
        }
      } else {        setUser(null)
        setStatus('unauthenticated')
      }
    } catch (error) {
      void error
      setUser(null)
      setStatus('unauthenticated')
    }
  }, [tryRefresh])

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // OAuth redirect handlers
  const signInWithYandex = () => {
    window.location.href = '/api/auth/yandex/redirect'
  }

  const signInWithTelegram = () => {
    window.location.href = '/api/auth/telegram/redirect'
  }

  // Logout
  const signOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      setUser(null)
      setStatus('unauthenticated')
    }
  }

  // Manual refresh
  const refreshAuth = async () => {
    await checkAuth()
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        status,
        signInWithYandex,
        signInWithTelegram,
        signOut,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ==================== HOOKS ====================

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Compatibility hook (similar structure to old useSession)
export function useSession() {
  const { user, status } = useAuth()
  return {
    data: user ? { user } : null,
    status,
  }
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Telegram OAuth Callback Page
 *
 * This page handles the callback from oauth.telegram.org.
 * After user authorizes, Telegram redirects here with tgAuthResult in the URL hash fragment.
 *
 * Flow:
 * 1. Parse tgAuthResult from window.location.hash
 * 2. Decode base64 to get auth data (id, first_name, hash, auth_date, etc.)
 * 3. Send POST to /api/auth/telegram/callback with auth data + state
 * 4. On success, redirect to home; on error, redirect to login with error
 */
export default function TelegramCallbackPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(true)

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Get state from URL query params (set during redirect)
        const state = searchParams.get('state')
        if (!state) {
          throw new Error('Missing state parameter')
        }

        // Get tgAuthResult from hash fragment
        const hash = window.location.hash
        if (!hash || !hash.includes('tgAuthResult=')) {
          throw new Error('Missing authentication data')
        }

        // Clear hash immediately for security (prevent leaking in referrer, history, etc.)
        window.history.replaceState(null, '', window.location.pathname + window.location.search)

        // Extract tgAuthResult value
        const hashParams = new URLSearchParams(hash.substring(1))
        const tgAuthResult = hashParams.get('tgAuthResult')
        if (!tgAuthResult) {
          throw new Error('Missing tgAuthResult')
        }

        // Decode base64 to JSON
        let authData: Record<string, unknown>
        try {
          const decoded = atob(tgAuthResult)
          authData = JSON.parse(decoded)
        } catch {
          throw new Error('Invalid authentication data format')
        }

        // Validate required fields
        if (!authData.id || !authData.hash || !authData.auth_date) {
          throw new Error('Incomplete authentication data')
        }

        // Send to backend for verification
        const response = await fetch('/api/auth/telegram/callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Important: send cookies (including state cookie)
          body: JSON.stringify({
            state,
            id: authData.id,
            first_name: authData.first_name,
            last_name: authData.last_name,
            username: authData.username,
            photo_url: authData.photo_url,
            auth_date: authData.auth_date,
            hash: authData.hash,
          }),
        })

        if (response.ok) {
          // Success - redirect to home
          navigate('/', { replace: true })
        } else {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.error || 'Authentication failed'

          // Map backend errors to user-friendly messages
          const errorMap: Record<string, string> = {
            'Invalid state': 'invalid_state',
            'State expired': 'invalid_state',
            'Invalid signature': 'invalid_signature',
            'Authentication expired': 'authentication_expired',
            'Rate limit exceeded': 'rate_limit_exceeded',
          }

          const errorCode = errorMap[errorMessage] || 'authentication_failed'
          navigate(`/login?error=${errorCode}`, { replace: true })
        }
      } catch (err) {
        console.error('[Telegram Callback] Error:', err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)

        // Redirect to login with error after short delay
        setTimeout(() => {
          navigate('/login?error=authentication_failed', { replace: true })
        }, 2000)
      } finally {
        setIsProcessing(false)
      }
    }

    processCallback()
  }, [navigate, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white flex items-center justify-center">
      <div className="text-center">
        {isProcessing && !error && (
          <>
            <svg
              className="h-12 w-12 animate-spin text-[#8C52FF] mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-lg text-slate-600">Завершаем авторизацию...</p>
          </>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 max-w-md">
            <p className="text-red-700 mb-2">Ошибка авторизации</p>
            <p className="text-sm text-red-600">{error}</p>
            <p className="text-xs text-slate-500 mt-4">Перенаправление на страницу входа...</p>
          </div>
        )}
      </div>
    </div>
  )
}

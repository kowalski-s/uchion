import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import TelegramLoginButton from '../components/TelegramLoginButton'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWithYandex, status } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Check for OAuth errors in URL
  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        oauth_error: 'Ошибка авторизации. Попробуйте ещё раз.',
        invalid_request: 'Неверный запрос авторизации.',
        invalid_state: 'Сессия истекла. Попробуйте ещё раз.',
        configuration_error: 'Ошибка конфигурации. Обратитесь в поддержку.',
        authentication_failed: 'Не удалось войти. Попробуйте ещё раз.',
        authentication_expired: 'Сессия авторизации истекла. Попробуйте ещё раз.',
        invalid_signature: 'Неверная подпись данных. Попробуйте ещё раз.',
        rate_limit_exceeded: 'Слишком много попыток входа. Попробуйте позже.',
      }
      setError(errorMessages[errorParam] || 'Произошла ошибка при входе.')
    }
  }, [searchParams])

  // Redirect if already authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      navigate('/')
    }
  }, [status, navigate])

  const handleYandexSignIn = () => {
    setError(null)
    setIsLoading(true)
    signInWithYandex()
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white font-sans text-slate-900 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-[-20%] left-[50%] w-[1000px] h-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-100/40 to-transparent blur-3xl pointer-events-none" />

      <header className="relative z-10 pt-6 pb-4">
        <div className="mx-auto max-w-6xl px-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            <span className="text-slate-900">Учи</span>
            <span className="text-[#8C52FF] drop-shadow-[0_0_12px_rgba(140,82,255,0.4)]">Он</span>
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-md flex-col items-center px-4 py-8">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-slate-900">
          Вход в аккаунт
        </h1>
        <p className="mb-8 text-slate-500">
          Выберите способ входа
        </p>

        <div className="w-full rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-purple-100">
          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* OAuth buttons */}
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={handleYandexSignIn}
              disabled={isLoading || status === 'loading'}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M11.948 0C5.346 0 0 5.346 0 11.948s5.346 11.948 11.948 11.948 11.948-5.346 11.948-11.948S18.55 0 11.948 0z" fill="#FC3F1D"/>
                <path d="M14.318 19.5h-2.163V8.936h-1.103c-1.612 0-2.442.777-2.442 1.95 0 1.293.607 1.95 1.95 2.442l1.373.607-3.511 5.565H6.169l3.097-4.914c-1.83-.777-2.885-2.163-2.885-4.103 0-2.498 1.612-4.127 4.603-4.127h3.334V19.5z" fill="#fff"/>
              </svg>
              Войти через Яндекс
            </button>

            {/* Telegram Login Widget */}
            {import.meta.env.VITE_TELEGRAM_BOT_USERNAME && (
              <div className="relative">
                <TelegramLoginButton
                  botUsername={import.meta.env.VITE_TELEGRAM_BOT_USERNAME}
                  authCallbackUrl={`${window.location.origin}/api/auth/telegram/callback`}
                  buttonSize="large"
                  onAuthError={(error) => setError(error)}
                />
              </div>
            )}
          </div>

          {/* Loading indicator */}
          {(isLoading || status === 'loading') && (
            <div className="mt-6 flex justify-center">
              <svg className="h-6 w-6 animate-spin text-[#8C52FF]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Продолжая, вы соглашаетесь с условиями использования сервиса
        </p>
      </main>
    </div>
  )
}

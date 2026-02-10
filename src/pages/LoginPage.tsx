import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'

type Step = 'email' | 'code'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { signInWithYandex, status, refreshAuth } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)

  // Email OTP state
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const codeInputRef = useRef<HTMLInputElement>(null)

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

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  // Focus code input when switching to code step
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => codeInputRef.current?.focus(), 100)
    }
  }, [step])

  const handleYandexSignIn = () => {
    if (!consentAccepted) return
    setError(null)
    setIsLoading(true)
    signInWithYandex()
  }

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

  const handleSendCode = async () => {
    if (!consentAccepted || !isValidEmail(email)) return
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      })

      if (res.ok) {
        setStep('code')
        setCode('')
        setResendTimer(60)
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          setError('Слишком много запросов. Попробуйте позже.')
        } else {
          setError(data?.error?.message || 'Не удалось отправить код. Попробуйте позже.')
        }
      }
    } catch {
      setError('Ошибка сети. Проверьте подключение к интернету.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!code || code.length !== 6) return
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/email/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      })

      if (res.ok) {
        await refreshAuth()
        navigate('/')
      } else {
        const data = await res.json().catch(() => ({}))
        if (res.status === 429) {
          setError('Слишком много попыток. Попробуйте позже.')
        } else {
          setError(data?.error?.message || 'Неверный или истёкший код.')
        }
      }
    } catch {
      setError('Ошибка сети. Проверьте подключение к интернету.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendTimer > 0) return
    await handleSendCode()
  }

  const handleBackToEmail = () => {
    setStep('email')
    setCode('')
    setError(null)
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
          {step === 'email' ? 'Выберите способ входа' : `Код отправлен на ${email}`}
        </p>

        <div className="w-full rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-purple-100">
          {/* Error message */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <>
              {/* Legal consent checkbox */}
              <label className="flex items-start gap-3 mb-6 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(e) => setConsentAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#8C52FF] focus:ring-[#8C52FF] accent-[#8C52FF] cursor-pointer shrink-0"
                />
                <span className="text-sm text-slate-600 leading-relaxed">
                  Я принимаю{' '}
                  <span className="text-[#8C52FF] underline underline-offset-2">
                    пользовательское соглашение
                  </span>
                  ,{' '}
                  <span className="text-[#8C52FF] underline underline-offset-2">
                    политику конфиденциальности
                  </span>{' '}
                  и{' '}
                  <span className="text-[#8C52FF] underline underline-offset-2">
                    согласие на обработку персональных данных
                  </span>
                </span>
              </label>

              {/* Email input */}
              <div className="mb-4">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendCode() }}
                  placeholder="Введите email"
                  disabled={!consentAccepted || isLoading}
                  className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-base text-slate-700 placeholder-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-2 focus:ring-[#8C52FF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="button"
                onClick={handleSendCode}
                disabled={!consentAccepted || !isValidEmail(email) || isLoading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#8C52FF] text-base font-semibold text-white transition-all hover:bg-[#7B3FE4] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  <>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                    Получить код
                  </>
                )}
              </button>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400">или</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Yandex OAuth button */}
              <button
                type="button"
                onClick={handleYandexSignIn}
                disabled={!consentAccepted || isLoading || status === 'loading'}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <path d="M11.948 0C5.346 0 0 5.346 0 11.948s5.346 11.948 11.948 11.948 11.948-5.346 11.948-11.948S18.55 0 11.948 0z" fill="#FC3F1D"/>
                  <path d="M14.318 19.5h-2.163V8.936h-1.103c-1.612 0-2.442.777-2.442 1.95 0 1.293.607 1.95 1.95 2.442l1.373.607-3.511 5.565H6.169l3.097-4.914c-1.83-.777-2.885-2.163-2.885-4.103 0-2.498 1.612-4.127 4.603-4.127h3.334V19.5z" fill="#fff"/>
                </svg>
                Войти через Яндекс
              </button>

              {!consentAccepted && (
                <p className="mt-4 text-center text-xs text-slate-400">
                  Для входа необходимо принять условия
                </p>
              )}
            </>
          ) : (
            /* Step 2: Code verification */
            <>
              <div className="mb-4">
                <input
                  ref={codeInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setCode(val)
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) handleVerifyCode() }}
                  placeholder="Введите 6-значный код"
                  disabled={isLoading}
                  className="h-14 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-center text-2xl font-semibold tracking-[0.3em] text-slate-700 placeholder-slate-400 placeholder:text-base placeholder:tracking-normal outline-none transition-all focus:border-[#8C52FF] focus:ring-2 focus:ring-[#8C52FF]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={code.length !== 6 || isLoading}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#8C52FF] text-base font-semibold text-white transition-all hover:bg-[#7B3FE4] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : 'Войти'}
              </button>

              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resendTimer > 0 || isLoading}
                  className="text-sm text-[#8C52FF] hover:underline disabled:text-slate-400 disabled:no-underline disabled:cursor-not-allowed"
                >
                  {resendTimer > 0
                    ? `Отправить повторно (${resendTimer}с)`
                    : 'Отправить код повторно'}
                </button>
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  disabled={isLoading}
                  className="text-sm text-slate-500 hover:text-slate-700 hover:underline disabled:cursor-not-allowed"
                >
                  Изменить email
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

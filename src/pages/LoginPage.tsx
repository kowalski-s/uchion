import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../lib/auth'

// Login form schema
const LoginSchema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль'),
})

// Register form schema
const RegisterSchema = z.object({
  name: z.string().min(2, 'Имя должно содержать минимум 2 символа'),
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Пароль должен содержать минимум 8 символов'),
  confirmPassword: z.string().min(1, 'Подтвердите пароль'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Пароли не совпадают',
  path: ['confirmPassword'],
})

type LoginFormValues = z.infer<typeof LoginSchema>
type RegisterFormValues = z.infer<typeof RegisterSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn, signInWithProvider } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  })

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const handleLogin = async (values: LoginFormValues) => {
    setError(null)
    setIsLoading(true)

    try {
      const result = await signIn(values.email, values.password)

      if (result.error) {
        setError('Неверный email или пароль')
      } else {
        // Redirect to home page after successful login
        navigate('/')
      }
    } catch (err) {
      console.error('[FRONTEND] Login error:', err)

      // Check if it's a network error
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Не удалось подключиться к серверу. Убедитесь, что запущен backend (npm run dev)')
      } else {
        setError('Произошла ошибка при входе')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (values: RegisterFormValues) => {
    setError(null)
    setIsLoading(true)

    try {
      console.log('[FRONTEND] Starting registration for:', values.email)

      // Call registration API
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          email: values.email,
          password: values.password,
        }),
      })

      console.log('[FRONTEND] Registration response status:', response.status)

      const data = await response.json()
      console.log('[FRONTEND] Registration response data:', data)

      if (!response.ok) {
        const errorMsg = data.details || data.error || 'Ошибка при регистрации'
        console.error('[FRONTEND] Registration failed:', errorMsg)
        setError(errorMsg)
        setIsLoading(false)
        return
      }

      console.log('[FRONTEND] Registration successful, attempting sign in...')

      // After successful registration, automatically sign in
      const result = await signIn(values.email, values.password)

      if (result.error) {
        console.error('[FRONTEND] Sign in after registration failed:', result.error)
        setError('Регистрация успешна, но не удалось войти. Попробуйте войти вручную.')
      } else {
        console.log('[FRONTEND] Sign in successful, redirecting...')
        // Redirect to home page
        navigate('/')
      }
    } catch (err) {
      console.error('[FRONTEND] Registration error:', err)

      // Check if it's a network error
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError('Не удалось подключиться к серверу. Убедитесь, что запущен backend (npm run dev)')
      } else {
        setError('Произошла ошибка при регистрации: ' + (err instanceof Error ? err.message : String(err)))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleOAuthSignIn = (provider: 'google' | 'yandex') => {
    setError(null)
    signInWithProvider(provider)
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
        <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-slate-900">
          {mode === 'login' ? 'Вход в аккаунт' : 'Создать аккаунт'}
        </h1>

        <div className="w-full rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-purple-100">
          {/* Tab switcher */}
          <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#8C52FF] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-white text-[#8C52FF] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Регистрация
            </button>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={loginForm.handleSubmit(handleLogin)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="your@email.com"
                  {...loginForm.register('email')}
                />
                {loginForm.formState.errors.email && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Пароль</label>
                <input
                  type="password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="••••••••"
                  {...loginForm.register('password')}
                />
                {loginForm.formState.errors.password && (
                  <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-12 w-full rounded-full bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] text-base font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] hover:shadow-purple-500/40 disabled:opacity-70 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Вход...
                  </span>
                ) : (
                  'Войти'
                )}
              </button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={registerForm.handleSubmit(handleRegister)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Имя</label>
                <input
                  type="text"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="Иван Иванов"
                  {...registerForm.register('name')}
                />
                {registerForm.formState.errors.name && (
                  <p className="text-sm text-red-500">{registerForm.formState.errors.name.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Email</label>
                <input
                  type="email"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="your@email.com"
                  {...registerForm.register('email')}
                />
                {registerForm.formState.errors.email && (
                  <p className="text-sm text-red-500">{registerForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Пароль</label>
                <input
                  type="password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="••••••••"
                  {...registerForm.register('password')}
                />
                {registerForm.formState.errors.password && (
                  <p className="text-sm text-red-500">{registerForm.formState.errors.password.message}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Подтвердите пароль</label>
                <input
                  type="password"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="••••••••"
                  {...registerForm.register('confirmPassword')}
                />
                {registerForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-500">{registerForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-2 h-12 w-full rounded-full bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] text-base font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] hover:shadow-purple-500/40 disabled:opacity-70 disabled:hover:scale-100"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Регистрация...
                  </span>
                ) : (
                  'Зарегистрироваться'
                )}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="text-sm text-slate-400">или</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Войти через Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuthSignIn('yandex')}
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border-2 border-slate-200 bg-white text-base font-semibold text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M11.948 0C5.346 0 0 5.346 0 11.948s5.346 11.948 11.948 11.948 11.948-5.346 11.948-11.948S18.55 0 11.948 0z" fill="#FC3F1D"/>
                <path d="M14.318 19.5h-2.163V8.936h-1.103c-1.612 0-2.442.777-2.442 1.95 0 1.293.607 1.95 1.95 2.442l1.373.607-3.511 5.565H6.169l3.097-4.914c-1.83-.777-2.885-2.163-2.885-4.103 0-2.498 1.612-4.127 4.603-4.127h3.334V19.5z" fill="#fff"/>
              </svg>
              Войти через Яндекс
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-400">
          Продолжая, вы соглашаетесь с условиями использования сервиса
        </p>
      </main>
    </div>
  )
}

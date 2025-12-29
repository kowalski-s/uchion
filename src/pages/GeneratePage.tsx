import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GenerateSchema, GenerateFormValues } from '../lib/schemas'
import { generateWorksheet } from '../lib/api'
import { useSessionStore } from '../store/session'
import CustomSelect from '../components/ui/CustomSelect'
import { useAuth } from '../lib/auth'
import { getGenerationsLeft, incrementGuestUsage, canGenerate, GUEST_LIMIT } from '../lib/limits'
import Header from '../components/Header'

export default function GeneratePage() {
  const navigate = useNavigate()
  const saveSession = useSessionStore(s => s.saveSession)
  const setCurrent = useSessionStore(s => s.setCurrent)
  const { user } = useAuth()
  const [errorText, setErrorText] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [generationsLeft, setGenerationsLeft] = useState(getGenerationsLeft(user))

  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(GenerateSchema),
    defaultValues: { subject: 'math', grade: 3, topic: '' }
  })

  const mutation = useMutation({
    mutationFn: (values: GenerateFormValues) => generateWorksheet(values as unknown as import('../../shared/types').GeneratePayload, (p) => setProgress(p)),
    onSuccess: res => {
      if (res.status === 'error') {
        setErrorText(res.message)
        return
      }
      const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
      const worksheet = res.data.worksheet

      // Save to localStorage for persistence
      try {
        localStorage.setItem('uchion_cached_worksheet', JSON.stringify(worksheet))
      } catch (e) {
        console.error('Failed to save to localStorage', e)
      }

      // Обновить лимит после успешной генерации
      setGenerationsLeft(getGenerationsLeft(user))

      saveSession(sessionId, {
        payload: { subject: form.getValues('subject'), grade: form.getValues('grade'), topic: form.getValues('topic') },
        worksheet,
        pdfBase64: worksheet.pdfBase64
      })
      setCurrent(sessionId)
      navigate('/worksheet/' + sessionId)
    },
    onError: () => {
      setErrorText('Не удалось сгенерировать лист. Попробуйте ещё раз.')
    }
  })

  const onSubmit = (values: GenerateFormValues) => {
    // Проверка лимитов
    if (!canGenerate(user)) {
      setErrorText('Лимит бесплатных генераций исчерпан. Войдите, чтобы продолжить.')
      setTimeout(() => navigate('/login'), 2000)
      return
    }

    setErrorText(null)
    setProgress(0)
    localStorage.removeItem('uchion_cached_worksheet')

    // Если гость - инкрементируем счетчик
    if (!user) {
      incrementGuestUsage()
      setGenerationsLeft(prev => prev - 1)
    }

    mutation.mutate({ subject: values.subject, grade: values.grade, topic: values.topic })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white font-sans text-slate-900 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-[-20%] left-[50%] w-[1000px] h-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-100/40 to-transparent blur-3xl pointer-events-none" />

      <Header />

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-12 text-center">
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Генератор для учителей будущего
        </h1>
        <h2 className="mb-10 text-xl text-slate-500 font-medium">
          Создавайте рабочие листы для уроков за секунды
        </h2>

        {/* Индикатор лимита */}
        <div className="mb-6 text-center">
          {user ? (
            <p className="text-sm text-slate-600">
              Осталось генераций: <span className="font-bold text-[#8C52FF]">{generationsLeft}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              Бесплатно: <span className="font-bold text-[#8C52FF]">{generationsLeft}</span> из {GUEST_LIMIT}
              {generationsLeft === 0 && (
                <span className="block mt-2 text-red-600">
                  Лимит исчерпан. <Link to="/login" className="underline hover:text-red-800">Войдите</Link>, чтобы продолжить
                </span>
              )}
            </p>
          )}
        </div>

        <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-purple-100">
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-left">
              <Controller
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <CustomSelect
                    label="Предмет"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { label: 'Математика', value: 'math' },
                      { label: 'Русский язык', value: 'russian' },
                    ]}
                  />
                )}
              />

              <Controller
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <CustomSelect
                    label="Класс"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { label: '1 класс', value: 1 },
                      { label: '2 класс', value: 2 },
                      { label: '3 класс', value: 3 },
                      { label: '4 класс', value: 4 },
                    ]}
                  />
                )}
              />
            </div>

            <div className="flex flex-col gap-2 text-left">
              <label className="text-sm font-semibold text-slate-700">Тема урока</label>
              <input
                type="text"
                className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-lg text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                placeholder="Например: Сложение двузначных чисел"
                {...form.register('topic')}
              />
              {form.formState.errors.topic && (
                <p className="text-sm text-red-500">{form.formState.errors.topic.message}</p>
              )}
            </div>

            {errorText && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {errorText}
              </div>
            )}

            <div className="mt-2 flex justify-center">
              <button
                type="submit"
                disabled={mutation.isPending}
                className="group relative inline-flex h-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] px-10 text-lg font-bold text-white shadow-lg shadow-purple-500/30 transition-all hover:scale-[1.02] hover:shadow-purple-500/40 disabled:opacity-70 disabled:hover:scale-100"
              >
                {mutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Генерируем...
                  </span>
                ) : (
                  'Создать рабочий лист'
                )}
              </button>
            </div>
          </form>
        </div>

        <p className="mt-8 max-w-md text-center text-sm text-slate-400">
          Этот сервис помогает экономить время учителю. Проверяйте материалы перед печатью.
        </p>
      </main>

      {/* Loading Overlay */}
      {mutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md transition-all">
          <div className="w-full max-w-xl px-6 text-center">
            <h3 className="mb-6 text-2xl font-bold text-slate-800">Создаем материалы...</h3>

            <div className="w-full text-left">
              <div className="mb-2 flex justify-between items-end text-sm font-medium">
                <span className="text-slate-600">Готово: {Math.round(progress)}%</span>
                <span className="text-xs text-slate-400">Генерация занимает 2-3 минуты</span>
              </div>
              <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(140,82,255,0.5)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { GenerateSchema, GenerateFormValues } from '../lib/schemas'
import { generateWorksheet } from '../lib/api'
import { useSessionStore } from '../store/session'

export default function GeneratePage() {
  const navigate = useNavigate()
  const saveSession = useSessionStore(s => s.saveSession)
  const setCurrent = useSessionStore(s => s.setCurrent)
  const [errorText, setErrorText] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)

  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(GenerateSchema),
    defaultValues: { subject: 'math', grade: 3, topic: '' }
  })

  const mutation = useMutation({
    mutationFn: (values: GenerateFormValues) => generateWorksheet(values, (p) => setProgress(p)),
    onSuccess: res => {
      if (res.status === 'error') {
        setErrorText(res.message)
        return
      }
      const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
      const worksheet = res.data.worksheet
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
    setErrorText(null)
    setProgress(0)
    mutation.mutate({ subject: values.subject, grade: values.grade, topic: values.topic })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white font-sans text-slate-900 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-[-20%] left-[50%] w-[1000px] h-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-100/40 to-transparent blur-3xl pointer-events-none" />

      <header className="relative z-10 pt-6 pb-4">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center text-2xl font-bold tracking-tight">
            <span className="text-slate-900">Учи</span>
            <span className="text-[#8C52FF] drop-shadow-[0_0_12px_rgba(140,82,255,0.4)]">Он</span>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-12 text-center">
        <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Генератор для учителей будущего
        </h1>
        <h2 className="mb-10 text-xl text-slate-500 font-medium">
          Создавайте рабочие листы для уроков за секунды
        </h2>

        <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-purple-100">
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-left">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Предмет</label>
                <div className="relative">
                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-base text-slate-900 outline-none transition-all focus:border-[#8C52FF] focus:bg-white focus:ring-2 focus:ring-[#8C52FF]/20"
                    {...form.register('subject')}
                  >
                    <option value="math">Математика</option>
                    <option value="russian">Русский язык</option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-semibold text-slate-700">Класс</label>
                <div className="relative">
                  <select
                    className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-base text-slate-900 outline-none transition-all focus:border-[#8C52FF] focus:bg-white focus:ring-2 focus:ring-[#8C52FF]/20"
                    {...form.register('grade', { valueAsNumber: true })}
                  >
                    <option value={1}>1 класс</option>
                    <option value={2}>2 класс</option>
                    <option value={3}>3 класс</option>
                    <option value={4}>4 класс</option>
                  </select>
                  <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              </div>
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
          <div className="w-full max-w-md px-6 text-center">
            <h3 className="mb-4 text-2xl font-bold text-slate-800">Создаем материалы...</h3>
            <div className="mb-2 flex justify-between text-sm font-medium text-slate-600">
              <span>Готово: {Math.round(progress)}%</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-slate-200 shadow-inner">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-[#8C52FF] to-[#A16BFF] transition-all duration-300 ease-out shadow-[0_0_10px_rgba(140,82,255,0.5)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { generatePresentation } from '../lib/presentation-api'
import CustomSelect from '../components/ui/CustomSelect'
import { useAuth } from '../lib/auth'
import { getGenerationsLeft, canGenerate } from '../lib/limits'
import Header from '../components/Header'
import type { PresentationThemePreset, PresentationStructure } from '../../shared/types'
import SlidePreview from '../components/presentations/SlidePreview'

// =============================================================================
// Types and Constants
// =============================================================================

type Subject = 'math' | 'algebra' | 'geometry' | 'russian'

const SUBJECTS: { value: Subject; label: string; grades: number[] }[] = [
  { value: 'math', label: 'Математика', grades: [1, 2, 3, 4, 5, 6] },
  { value: 'algebra', label: 'Алгебра', grades: [7, 8, 9, 10, 11] },
  { value: 'geometry', label: 'Геометрия', grades: [7, 8, 9, 10, 11] },
  { value: 'russian', label: 'Русский язык', grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
]

const SLIDE_COUNTS: { value: 12 | 18 | 24; label: string; description: string }[] = [
  { value: 12, label: 'Короткая', description: '12 слайдов' },
  { value: 18, label: 'Средняя', description: '18 слайдов' },
  { value: 24, label: 'Детальная', description: '24 слайда' },
]

const THEME_PRESETS: { value: PresentationThemePreset; label: string; description: string; color: string }[] = [
  { value: 'professional', label: 'Профессиональный', description: 'Строгий, деловой', color: 'bg-blue-900' },
  { value: 'educational', label: 'Образовательный', description: 'Яркий, школьный', color: 'bg-purple-600' },
  { value: 'minimal', label: 'Минимализм', description: 'Простой, чистый', color: 'bg-slate-400' },
  { value: 'scientific', label: 'Научный', description: 'Для формул', color: 'bg-green-900' },
]

// =============================================================================
// Form Schema
// =============================================================================

const GeneratePresentationFormSchema = z.object({
  subject: z.enum(['math', 'algebra', 'geometry', 'russian']),
  grade: z.number().int().min(1).max(11),
  topic: z.string().min(3, 'Минимум 3 символа').max(200, 'Максимум 200 символов'),
  themeType: z.enum(['preset', 'custom']),
  themePreset: z.enum(['professional', 'educational', 'minimal', 'scientific']).optional(),
  themeCustom: z.string().max(100, 'Максимум 100 символов').optional(),
  slideCount: z.union([z.literal(12), z.literal(18), z.literal(24)]).optional(),
})

type GeneratePresentationFormValues = z.infer<typeof GeneratePresentationFormSchema>

// =============================================================================
// Component
// =============================================================================

// Get greeting based on time of day
function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 0 && hour < 5) return 'Доброй ночи'
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 18) return 'Добрый день'
  return 'Добрый вечер'
}

// Helper to download a file from base64
const downloadBase64File = (base64: string, filename: string, mimeType: string) => {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function GeneratePresentationPage() {
  const navigate = useNavigate()
  const { user, refreshAuth } = useAuth()
  const [errorText, setErrorText] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const generationsLeft = getGenerationsLeft(user)
  const greeting = getGreeting()

  // Result state
  const [generatedResult, setGeneratedResult] = useState<{
    id: string
    title: string
    pptxBase64: string
    pdfBase64: string
    slideCount: number
    structure: PresentationStructure
  } | null>(null)

  const form = useForm<GeneratePresentationFormValues>({
    resolver: zodResolver(GeneratePresentationFormSchema),
    defaultValues: {
      subject: 'math',
      grade: 3,
      topic: '',
      themeType: 'preset',
      themePreset: 'educational',
      themeCustom: '',
      slideCount: 18,
    }
  })

  const watchSubject = form.watch('subject')
  const watchThemeType = form.watch('themeType')
  const watchThemePreset = form.watch('themePreset')
  const watchSlideCount = form.watch('slideCount')

  // Get available grades for selected subject
  const availableGrades = useMemo(() => {
    const subjectConfig = SUBJECTS.find(s => s.value === watchSubject)
    return subjectConfig?.grades || [1, 2, 3, 4]
  }, [watchSubject])

  // Reset grade if not available for new subject
  const handleSubjectChange = (newSubject: Subject) => {
    form.setValue('subject', newSubject)
    const newGrades = SUBJECTS.find(s => s.value === newSubject)?.grades || [1]
    const currentGrade = form.getValues('grade')
    if (!newGrades.includes(currentGrade)) {
      form.setValue('grade', newGrades[0])
    }
  }

  const mutation = useMutation({
    mutationFn: (values: GeneratePresentationFormValues) => generatePresentation(values as any, (p) => setProgress(p)),
    onSuccess: res => {
      if (res.status === 'error') {
        setErrorCode(res.code ?? null)
        setErrorText(res.message)
        return
      }

      // Refresh user data to get updated generationsLeft from server
      refreshAuth()

      // Store result
      setGeneratedResult(res.data)
    },
    onError: () => {
      setErrorCode('SERVER_ERROR')
      setErrorText('Не удалось сгенерировать презентацию. Попробуйте ещё раз.')
    }
  })

  // After login redirect: restore saved form and auto-generate
  const autoGenerateTriggered = useRef(false)
  useEffect(() => {
    if (!user || autoGenerateTriggered.current) return
    const pending = sessionStorage.getItem('uchion_pending_generate_presentation')
    if (!pending) return

    autoGenerateTriggered.current = true
    sessionStorage.removeItem('uchion_pending_generate_presentation')

    try {
      const savedValues = JSON.parse(pending) as GeneratePresentationFormValues
      // Restore form values
      form.reset(savedValues)
      // Trigger generation after a short delay to let form settle
      setTimeout(() => {
        form.handleSubmit((values) => {
          setErrorText(null)
          setErrorCode(null)
          setProgress(0)
          setGeneratedResult(null)
          mutation.mutate(values)
        })()
      }, 100)
    } catch {
      // Invalid saved data, ignore
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (values: GeneratePresentationFormValues) => {
    // Require authentication -- save form and redirect to login
    if (!user) {
      sessionStorage.setItem('uchion_pending_generate_presentation', JSON.stringify(values))
      navigate('/login')
      return
    }

    // Check limits
    if (!canGenerate(user)) {
      setErrorCode('LIMIT_EXCEEDED')
      setErrorText('Лимит генераций исчерпан. Приобретите дополнительные генерации.')
      return
    }

    setErrorText(null)
    setErrorCode(null)
    setProgress(0)
    setGeneratedResult(null)
    mutation.mutate(values)
  }

  const handleDownloadPptx = () => {
    if (!generatedResult) return
    const filename = `${generatedResult.title.replace(/[^a-zа-яё0-9\s]/gi, '_')}.pptx`
    downloadBase64File(generatedResult.pptxBase64, filename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  }

  const handleDownloadPdf = () => {
    if (!generatedResult?.pdfBase64) return
    const filename = `${generatedResult.title.replace(/[^a-zа-яё0-9\s]/gi, '_')}.pdf`
    downloadBase64File(generatedResult.pdfBase64, filename, 'application/pdf')
  }

  const handleCreateNew = () => {
    setGeneratedResult(null)
    setErrorText(null)
    setErrorCode(null)
    setProgress(0)
    form.reset({
      subject: 'math',
      grade: 3,
      topic: '',
      themeType: 'preset',
      themePreset: 'educational',
      themeCustom: '',
      slideCount: 18,
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-white font-sans text-slate-900 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute top-[-20%] left-[50%] w-[1000px] h-[1000px] -translate-x-1/2 rounded-full bg-gradient-to-b from-purple-100/40 to-transparent blur-3xl pointer-events-none" />

      <Header />

      <main className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 py-12 text-center">
        {/* Greeting header */}
        <div className="w-full mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {greeting}{user?.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-lg text-slate-500">Создайте презентацию для урока</p>
        </div>

        {/* Generations counter -- only for authenticated users */}
        {user && (
          <div className="w-full flex justify-end mb-4">
            <div className="flex items-center gap-2 bg-white rounded-full px-5 py-2.5 shadow-sm border border-purple-100">
              <svg className="w-5 h-5 text-[#8C52FF]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
              </svg>
              <span className="font-semibold text-slate-700">
                {generationsLeft}
              </span>
            </div>
          </div>
        )}

        {/* Success state - preview + download */}
        {generatedResult && (
          <div className="w-full mb-6 space-y-6">
            {/* Header with title + action buttons */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-center sm:text-left">
                  <h2 className="text-xl font-bold text-slate-900">{generatedResult.title}</h2>
                  <p className="text-sm text-slate-500 mt-0.5">{generatedResult.slideCount} слайдов</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDownloadPptx}
                    className="inline-flex h-10 px-5 items-center justify-center rounded-xl bg-[#A855F7]/80 hover:bg-[#A855F7]/90 text-sm font-semibold text-white shadow-md shadow-purple-400/20 transition-all hover:shadow-purple-400/30"
                  >
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Скачать .pptx
                  </button>
                  {generatedResult.pdfBase64 && (
                    <button
                      onClick={handleDownloadPdf}
                      className="inline-flex h-10 px-5 items-center justify-center rounded-xl bg-red-500/80 hover:bg-red-500/90 text-sm font-semibold text-white shadow-md shadow-red-400/20 transition-all hover:shadow-red-400/30"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Скачать PDF
                    </button>
                  )}
                  <button
                    onClick={handleCreateNew}
                    className="h-10 px-5 rounded-xl border-2 border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 transition-all"
                  >
                    Создать новую
                  </button>
                </div>
              </div>
            </div>

            {/* Slide preview grid */}
            {generatedResult.structure && (
              <SlidePreview
                structure={generatedResult.structure}
                themePreset={form.getValues('themeType') === 'preset' ? form.getValues('themePreset') : undefined}
              />
            )}
          </div>
        )}

        {/* Form - hidden when result is shown */}
        {!generatedResult && (
          <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
            {/* Main compact card */}
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-purple-100">
              {/* Subject and Grade row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <Controller
                  control={form.control}
                  name="subject"
                  render={({ field }) => (
                    <CustomSelect
                      label="Предмет"
                      value={field.value}
                      onChange={(v) => handleSubjectChange(v as Subject)}
                      options={SUBJECTS.map(s => ({ label: s.label, value: s.value }))}
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
                      options={availableGrades.map(g => ({ label: `${g} класс`, value: g }))}
                    />
                  )}
                />
              </div>

              {/* Topic input */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 text-left mb-2">Тема презентации</label>
                <input
                  type="text"
                  className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-lg text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                  placeholder="Введите тему презентации"
                  {...form.register('topic')}
                />
                {form.formState.errors.topic && (
                  <p className="text-sm text-red-500 text-left mt-1">{form.formState.errors.topic.message}</p>
                )}
              </div>

              {/* Theme selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 text-left mb-3">Стиль оформления</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {THEME_PRESETS.map(theme => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => {
                        form.setValue('themeType', 'preset')
                        form.setValue('themePreset', theme.value)
                      }}
                      className={`relative flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left ${
                        watchThemeType === 'preset' && watchThemePreset === theme.value
                          ? 'border-[#8C52FF] bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg ${theme.color} flex-shrink-0`} />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{theme.label}</div>
                        <div className="text-xs text-slate-500">{theme.description}</div>
                      </div>
                    </button>
                  ))}

                  {/* Custom theme option */}
                  <button
                    type="button"
                    onClick={() => form.setValue('themeType', 'custom')}
                    className={`relative flex items-center gap-4 px-5 py-4 rounded-xl border-2 transition-all text-left ${
                      watchThemeType === 'custom'
                        ? 'border-[#8C52FF] bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex-shrink-0 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Свой стиль</div>
                      <div className="text-xs text-slate-500">Опишите желаемый дизайн</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Slide count selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 text-left mb-3">Количество слайдов</label>
                <div className="grid grid-cols-3 gap-3">
                  {SLIDE_COUNTS.map(sc => (
                    <button
                      key={sc.value}
                      type="button"
                      onClick={() => form.setValue('slideCount', sc.value)}
                      className={`px-4 py-3 rounded-xl border-2 transition-all text-center ${
                        watchSlideCount === sc.value
                          ? 'border-[#8C52FF] bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="text-sm font-semibold text-slate-900">{sc.label}</div>
                      <div className="text-xs text-slate-500">{sc.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom theme input - shown when custom is selected */}
              {watchThemeType === 'custom' && (
                <div className="mb-6 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-sm font-semibold text-slate-700 text-left mb-2">Описание стиля</label>
                  <input
                    type="text"
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-lg text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                    placeholder="например: в стиле Apple"
                    {...form.register('themeCustom')}
                  />
                  {form.formState.errors.themeCustom && (
                    <p className="text-sm text-red-500 text-left mt-1">{form.formState.errors.themeCustom.message}</p>
                  )}
                </div>
              )}

              {/* Submit button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={mutation.isPending || (!!user && generationsLeft < 1)}
                  className="group relative inline-flex h-12 px-8 items-center justify-center overflow-hidden rounded-xl bg-[#A855F7]/80 hover:bg-[#A855F7]/90 text-base font-semibold text-white shadow-md shadow-purple-400/20 transition-all hover:shadow-purple-400/30 disabled:opacity-60 disabled:hover:bg-[#A855F7]/80"
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
                    <span className="flex items-center gap-2">
                      Сгенерировать презентацию
                      <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-0.5 text-sm">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                        </svg>
                        1
                      </span>
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Error message */}
            {errorText && (
              <div className={`rounded-xl border p-5 text-sm ${
                errorCode === 'LIMIT_EXCEEDED' || errorCode === 'DAILY_LIMIT_EXCEEDED'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {(errorCode === 'LIMIT_EXCEEDED' || errorCode === 'DAILY_LIMIT_EXCEEDED') ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                    </svg>
                    <div>
                      <p className="font-semibold text-base mb-1">
                        {errorCode === 'DAILY_LIMIT_EXCEEDED'
                          ? 'Вы достигли суточного лимита'
                          : 'Лимит генераций исчерпан'}
                      </p>
                      <p className="text-amber-600">
                        {errorCode === 'DAILY_LIMIT_EXCEEDED'
                          ? 'Обновление в 00:00 по МСК'
                          : 'Приобретите дополнительные генерации для продолжения работы'}
                      </p>
                    </div>
                    {errorCode === 'LIMIT_EXCEEDED' && (
                      <button
                        type="button"
                        onClick={() => navigate('/dashboard')}
                        className="mt-1 px-5 py-2 rounded-lg bg-[#8C52FF] text-white text-sm font-medium hover:bg-[#7B3FEE] transition-colors"
                      >
                        Купить генерации
                      </button>
                    )}
                  </div>
                ) : (
                  errorText
                )}
              </div>
            )}
          </form>
        )}

        <p className="mt-6 text-sm text-slate-400">
          Этот сервис помогает экономить время учителю. Проверяйте материалы перед использованием.
        </p>
      </main>

      {/* Loading Overlay */}
      {mutation.isPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/60 backdrop-blur-md transition-all">
          <div className="w-full max-w-xl px-6 text-center">
            <h3 className="mb-6 text-2xl font-bold text-slate-800">Создаем презентацию...</h3>

            <div className="w-full text-left">
              <div className="mb-2 flex justify-between items-end text-sm font-medium">
                <span className="text-slate-600">Готово: {Math.round(progress)}%</span>
                <span className="text-xs text-slate-400">Генерация занимает 1-2 минуты</span>
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

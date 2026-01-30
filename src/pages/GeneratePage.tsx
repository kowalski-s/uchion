import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { generateWorksheet } from '../lib/api'
import { useSessionStore } from '../store/session'
import CustomSelect from '../components/ui/CustomSelect'
import { useAuth } from '../lib/auth'
import { getGenerationsLeft, canGenerate } from '../lib/limits'
import Header from '../components/Header'
import { fetchFolders } from '../lib/dashboard-api'

// =============================================================================
// Types and Constants
// =============================================================================

type Subject = 'math' | 'algebra' | 'geometry' | 'russian'
type DifficultyLevel = 'easy' | 'medium' | 'hard'
type WorksheetFormatId = 'open_only' | 'test_only' | 'test_and_open'
type TaskTypeId = 'single_choice' | 'multiple_choice' | 'open_question' | 'matching' | 'fill_blank'

interface FormatVariant {
  openTasks: number
  testQuestions: number
  generations: number
  label?: string
}

const SUBJECTS: { value: Subject; label: string; grades: number[] }[] = [
  { value: 'math', label: 'Математика', grades: [1, 2, 3, 4, 5, 6] },
  { value: 'algebra', label: 'Алгебра', grades: [7, 8, 9, 10, 11] },
  { value: 'geometry', label: 'Геометрия', grades: [7, 8, 9, 10, 11] },
  { value: 'russian', label: 'Русский язык', grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
]

const DIFFICULTIES: { value: DifficultyLevel; label: string; description: string }[] = [
  { value: 'easy', label: 'Базовый', description: 'Простые задания' },
  { value: 'medium', label: 'Средний', description: 'Стандартный уровень' },
  { value: 'hard', label: 'Повышенный', description: 'Для продвинутых' },
]

const FORMATS: { id: WorksheetFormatId; name: string; variants: FormatVariant[] }[] = [
  {
    id: 'test_and_open',
    name: 'Тест + задания',
    variants: [
      { openTasks: 5, testQuestions: 10, generations: 1 },
      { openTasks: 10, testQuestions: 15, generations: 2 },
      { openTasks: 15, testQuestions: 20, generations: 3 },
    ],
  },
  {
    id: 'test_only',
    name: 'Только тест',
    variants: [
      { openTasks: 0, testQuestions: 10, generations: 1 },
      { openTasks: 0, testQuestions: 15, generations: 2 },
      { openTasks: 0, testQuestions: 20, generations: 3 },
    ],
  },
  {
    id: 'open_only',
    name: 'Только задания',
    variants: [
      { openTasks: 5, testQuestions: 0, generations: 1 },
      { openTasks: 10, testQuestions: 0, generations: 2 },
      { openTasks: 15, testQuestions: 0, generations: 3 },
    ],
  },
]

const TASK_TYPES: { id: TaskTypeId; name: string; description: string; category: 'test' | 'open' }[] = [
  { id: 'single_choice', name: 'Единственный выбор', description: 'Один правильный ответ', category: 'test' },
  { id: 'multiple_choice', name: 'Множественный выбор', description: 'Несколько правильных', category: 'test' },
  { id: 'open_question', name: 'Открытый вопрос', description: 'Ввод ответа', category: 'open' },
  { id: 'matching', name: 'Соотнесение', description: 'Соединить пары', category: 'open' },
  { id: 'fill_blank', name: 'Вставка пропусков', description: 'Заполнить пропуски', category: 'open' },
]

// =============================================================================
// Form Schema
// =============================================================================

const GenerateFormSchema = z.object({
  subject: z.enum(['math', 'algebra', 'geometry', 'russian']),
  grade: z.number().int().min(1).max(11),
  topic: z.string().min(3, 'Минимум 3 символа').max(200, 'Максимум 200 символов'),
  folderId: z.string().uuid().nullable().optional(),
  format: z.enum(['open_only', 'test_only', 'test_and_open']),
  variantIndex: z.number().int().min(0).max(2),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  taskTypes: z.array(z.enum(['single_choice', 'multiple_choice', 'open_question', 'matching', 'fill_blank'])).min(1),
})

type GenerateFormValues = z.infer<typeof GenerateFormSchema>

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

export default function GeneratePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const saveSession = useSessionStore(s => s.saveSession)
  const setCurrent = useSessionStore(s => s.setCurrent)
  const { user } = useAuth()
  const [errorText, setErrorText] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [generationsLeft, setGenerationsLeft] = useState(getGenerationsLeft(user))
  const [showAdvanced, setShowAdvanced] = useState(false)
  const greeting = getGreeting()

  // Fetch folders only for authenticated users
  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: fetchFolders,
    enabled: !!user,
  })

  const folders = foldersData?.folders || []

  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(GenerateFormSchema),
    defaultValues: {
      subject: 'math',
      grade: 3,
      topic: '',
      folderId: null,
      format: 'test_and_open',
      variantIndex: 0,
      difficulty: 'medium',
      taskTypes: ['single_choice', 'open_question'],
    }
  })

  const watchSubject = form.watch('subject')
  const watchFormat = form.watch('format')
  const watchVariantIndex = form.watch('variantIndex')
  const watchTaskTypes = form.watch('taskTypes')

  // Get available grades for selected subject
  const availableGrades = useMemo(() => {
    const subjectConfig = SUBJECTS.find(s => s.value === watchSubject)
    return subjectConfig?.grades || [1, 2, 3, 4]
  }, [watchSubject])

  // Get current format config
  const currentFormat = useMemo(() => {
    return FORMATS.find(f => f.id === watchFormat)
  }, [watchFormat])

  // Get current variant
  const currentVariant = useMemo(() => {
    return currentFormat?.variants[watchVariantIndex]
  }, [currentFormat, watchVariantIndex])

  // Calculate generation cost
  const generationCost = currentVariant?.generations || 1

  // Reset grade if not available for new subject
  const handleSubjectChange = (newSubject: Subject) => {
    form.setValue('subject', newSubject)
    const newGrades = SUBJECTS.find(s => s.value === newSubject)?.grades || [1]
    const currentGrade = form.getValues('grade')
    if (!newGrades.includes(currentGrade)) {
      form.setValue('grade', newGrades[0])
    }
  }

  // Toggle task type
  const toggleTaskType = (typeId: TaskTypeId) => {
    const current = form.getValues('taskTypes')
    if (current.includes(typeId)) {
      if (current.length > 1) {
        form.setValue('taskTypes', current.filter(t => t !== typeId))
      }
    } else {
      form.setValue('taskTypes', [...current, typeId])
    }
  }

  const mutation = useMutation({
    mutationFn: (values: GenerateFormValues) => generateWorksheet(values as any, (p) => setProgress(p)),
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

      // Update limit after successful generation
      setGenerationsLeft(getGenerationsLeft(user))

      saveSession(sessionId, {
        payload: { subject: form.getValues('subject'), grade: form.getValues('grade'), topic: form.getValues('topic') },
        worksheet,
        pdfBase64: worksheet.pdfBase64
      })
      setCurrent(sessionId)

      // Invalidate worksheets queries to trigger refetch in Dashboard
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })

      navigate('/worksheet/' + sessionId)
    },
    onError: () => {
      setErrorText('Не удалось сгенерировать лист. Попробуйте ещё раз.')
    }
  })

  // After login redirect: restore saved form and auto-generate
  const autoGenerateTriggered = useRef(false)
  useEffect(() => {
    if (!user || autoGenerateTriggered.current) return
    const pending = sessionStorage.getItem('uchion_pending_generate')
    if (!pending) return

    autoGenerateTriggered.current = true
    sessionStorage.removeItem('uchion_pending_generate')

    try {
      const savedValues = JSON.parse(pending) as GenerateFormValues
      // Restore form values
      form.reset(savedValues)
      // Trigger generation after a short delay to let form settle
      setTimeout(() => {
        form.handleSubmit((values) => {
          setErrorText(null)
          setProgress(0)
          localStorage.removeItem('uchion_cached_worksheet')
          mutation.mutate(values)
        })()
      }, 100)
    } catch {
      // Invalid saved data, ignore
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (values: GenerateFormValues) => {
    // Require authentication -- save form and redirect to login
    if (!user) {
      sessionStorage.setItem('uchion_pending_generate', JSON.stringify(values))
      navigate('/login')
      return
    }

    // Check limits
    if (!canGenerate(user)) {
      setErrorText('Лимит генераций исчерпан. Приобретите дополнительные генерации.')
      return
    }

    // Check if user has enough generations
    if (generationsLeft < generationCost) {
      setErrorText(`Недостаточно генераций. Требуется: ${generationCost}, доступно: ${generationsLeft}`)
      return
    }

    setErrorText(null)
    setProgress(0)
    localStorage.removeItem('uchion_cached_worksheet')
    mutation.mutate(values)
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
          <p className="text-lg text-slate-500">Какой материал хотите сгенерировать?</p>
        </div>

        {/* Generations counter */}
        <div className="w-full flex justify-end mb-4">
          <div className="flex items-center gap-2 bg-white rounded-full px-5 py-2.5 shadow-sm border border-purple-100">
            <svg className="w-5 h-5 text-[#8C52FF]" fill="currentColor" viewBox="0 0 20 20">
              <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
            </svg>
            <span className="font-semibold text-slate-700">
              {user ? generationsLeft : 0}
            </span>
            {!user && (
              <Link to="/login" className="text-[#8C52FF] text-sm underline ml-2">Войти</Link>
            )}
          </div>
        </div>

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
              <label className="block text-sm font-semibold text-slate-700 text-left mb-2">Тема урока</label>
              <input
                type="text"
                className="h-14 w-full rounded-xl border border-slate-200 bg-white px-5 text-lg text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-[#8C52FF] focus:ring-4 focus:ring-[#8C52FF]/10"
                placeholder="Например: Сложение двузначных чисел"
                {...form.register('topic')}
              />
              {form.formState.errors.topic && (
                <p className="text-sm text-red-500 text-left mt-1">{form.formState.errors.topic.message}</p>
              )}
            </div>

            {/* Folder selector - only for authenticated users */}
            {user && folders.length > 0 && (
              <div className="mb-6">
                <Controller
                  control={form.control}
                  name="folderId"
                  render={({ field }) => (
                    <CustomSelect
                      label="Сохранить в папку"
                      value={field.value ?? ''}
                      onChange={(val) => field.onChange(val === '' ? null : val)}
                      options={[
                        { label: 'Без папки', value: '' },
                        ...folders.map(f => ({ label: f.name, value: f.id }))
                      ]}
                    />
                  )}
                />
              </div>
            )}

            {/* Bottom action row: Advanced settings toggle + Create button */}
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-700 font-medium hover:border-slate-300 transition-all"
              >
                <span>
                  {currentVariant
                    ? `${currentVariant.openTasks + currentVariant.testQuestions} заданий`
                    : '5 заданий'
                  }
                </span>
                <svg
                  className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <button
                type="submit"
                disabled={mutation.isPending || generationsLeft < generationCost}
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
                    Создать
                    <span className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-0.5 text-sm">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" />
                      </svg>
                      {generationCost}
                    </span>
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Advanced settings - collapsible */}
          {showAdvanced && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Format selection card */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-purple-100">
                <h3 className="text-lg font-semibold text-slate-800 text-left mb-5">Формат листа</h3>

                {/* Format tabs */}
                <div className="flex gap-3 mb-6 flex-wrap">
                  {FORMATS.map(format => (
                    <button
                      key={format.id}
                      type="button"
                      onClick={() => {
                        form.setValue('format', format.id)
                        form.setValue('variantIndex', 0)
                      }}
                      className={`px-5 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                        watchFormat === format.id
                          ? 'border-[#8C52FF] bg-purple-50 text-slate-800'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      {format.name}
                    </button>
                  ))}
                </div>

                {/* Variant selection */}
                {currentFormat && (
                  <div className="flex gap-4 flex-wrap">
                    {currentFormat.variants.map((variant, idx) => {
                      const description = variant.openTasks > 0 && variant.testQuestions > 0
                        ? `${variant.openTasks} заданий + ${variant.testQuestions} тестов`
                        : variant.openTasks > 0
                        ? `${variant.openTasks} заданий`
                        : `${variant.testQuestions} тестов`

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => form.setValue('variantIndex', idx)}
                          className={`flex items-center gap-3 px-5 py-4 rounded-xl border-2 transition-all ${
                            watchVariantIndex === idx
                              ? 'border-[#8C52FF] bg-purple-50 text-slate-800'
                              : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                          }`}
                        >
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                            watchVariantIndex === idx ? 'bg-[#8C52FF] text-white' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {variant.generations}
                          </span>
                          <div className="text-left">
                            <div className="text-sm font-medium">{description}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Difficulty selection */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-purple-100">
                <h3 className="text-lg font-semibold text-slate-800 text-left mb-5">Уровень сложности</h3>
                <div className="flex gap-4 flex-wrap">
                  {DIFFICULTIES.map(diff => (
                    <button
                      key={diff.value}
                      type="button"
                      onClick={() => form.setValue('difficulty', diff.value)}
                      className={`flex-1 min-w-[140px] px-5 py-4 rounded-xl border-2 transition-all ${
                        form.watch('difficulty') === diff.value
                          ? 'border-[#8C52FF] bg-purple-50 text-slate-800'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      <div className="text-sm font-semibold">{diff.label}</div>
                      <div className="text-xs text-slate-500 mt-1">{diff.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task types selection */}
              <div className="bg-white rounded-2xl p-8 shadow-sm border border-purple-100">
                <h3 className="text-lg font-semibold text-slate-800 text-left mb-5">Типы заданий</h3>
                <div className="flex gap-3 flex-wrap">
                  {TASK_TYPES.map(type => {
                    const isSelected = watchTaskTypes.includes(type.id)
                    // Show test types only if format includes tests
                    // Show open types only if format includes open tasks
                    const formatAllowsType =
                      (type.category === 'test' && (currentVariant?.testQuestions || 0) > 0) ||
                      (type.category === 'open' && (currentVariant?.openTasks || 0) > 0)

                    if (!formatAllowsType) return null

                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => toggleTaskType(type.id)}
                        className={`px-5 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                          isSelected
                            ? 'border-[#8C52FF] bg-purple-50 text-slate-800'
                            : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                        }`}
                      >
                        {type.name}
                      </button>
                    )
                  })}
                </div>
                {form.formState.errors.taskTypes && (
                  <p className="text-sm text-red-500 text-left mt-2">Выберите хотя бы один тип задания</p>
                )}
              </div>
            </div>
          )}

          {/* Error message */}
          {errorText && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {errorText}
            </div>
          )}
        </form>

        <p className="mt-6 text-sm text-slate-400">
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

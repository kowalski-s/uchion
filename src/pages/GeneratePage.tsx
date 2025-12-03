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

  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(GenerateSchema),
    defaultValues: { subject: 'математика', grade: 3, topic: '' }
  })

  const mutation = useMutation({
    mutationFn: generateWorksheet,
    onSuccess: res => {
      if (res.status === 'error') {
        setErrorText(res.message)
        return
      }
      const sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
      saveSession(sessionId, {
        payload: { subject: form.getValues('subject'), grade: form.getValues('grade'), topic: form.getValues('topic') },
        worksheet: {
          summary: res.data.summary,
          tasks: res.data.tasks,
          questions: res.data.questions
        },
        pdfBase64: res.data.pdfBase64
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
    mutation.mutate({ subject: values.subject, grade: values.grade, topic: values.topic })
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">УчиОн</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Сгенерируйте рабочий лист по теме урока</h1>
          <p className="mt-2 text-gray-600">Подходит для 1–4 классов. Математика и русский язык.</p>
        </div>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm font-medium">Предмет</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                {...form.register('subject')}
              >
                <option value="математика">Математика</option>
                <option value="русский">Русский язык</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Класс</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                {...form.register('grade', { valueAsNumber: true })}
              >
                <option value={1}>1 класс</option>
                <option value={2}>2 класс</option>
                <option value={3}>3 класс</option>
                <option value={4}>4 класс</option>
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="mb-2 block text-sm font-medium">Тема урока</label>
              <input
                type="text"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
                placeholder="Например: Сложение двузначных чисел"
                {...form.register('topic')}
              />
              {form.formState.errors.topic && (
                <p className="mt-2 text-sm text-red-600">{form.formState.errors.topic.message}</p>
              )}
            </div>
          </div>
          {errorText && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{errorText}</div>}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {mutation.isPending ? 'Генерируем…' : 'Сгенерировать рабочий лист'}
          </button>
        </form>
      </main>
      <footer className="mx-auto max-w-4xl px-4 py-12 text-sm text-gray-500">
        <p>Этот сервис генерирует материалы автоматически. Проверяйте задания перед печатью.</p>
      </footer>
    </div>
  )
}

import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSessionStore } from '../store/session'

export default function WorksheetPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const session = useSessionStore(s => (sessionId ? s.getSession(sessionId) : undefined))
  const [pdfError, setPdfError] = useState<string | null>(null)

  const downloadPdf = useMemo(() => {
    return () => {
      if (!session || !session.pdfBase64) {
        setPdfError('PDF ещё не готов. Обновите страницу или сгенерируйте лист заново.')
        return
      }
      try {
        const bytes = Uint8Array.from(atob(session.pdfBase64), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'worksheet.pdf'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch {
        setPdfError('Не удалось подготовить PDF. Попробуйте снова.')
      }
    }
  }, [session])

  if (!session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-4 text-xl font-semibold">Сессия не найдена</div>
        <p className="mb-6 text-gray-600">Вернитесь на главную и попробуйте снова.</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-white hover:bg-blue-700"
        >
          На главную
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="text-xl font-semibold">УчиОн</div>
              <div className="text-gray-700">{session.payload.topic}</div>
              <div className="text-sm text-gray-500">{session.payload.subject}, {session.payload.grade} класс</div>
            </div>
            <button
              onClick={downloadPdf}
              className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 text-white hover:bg-blue-700"
            >
              Скачать PDF
            </button>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-12 gap-6 py-8">
          <aside className="col-span-12 lg:col-span-3">
            <nav className="sticky top-6 space-y-2">
              <a href="#summary" className="block rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200">Чтение и конспект</a>
              <a href="#tasks" className="block rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200">Задания</a>
              <a href="#questions" className="block rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200">Вопросы для закрепления</a>
            </nav>
          </aside>
          <main className="col-span-12 lg:col-span-9">
            <div className="mx-auto max-w-2xl">
              {pdfError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{pdfError}</div>
              )}
              <section id="summary" className="mb-10 rounded-lg bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Краткий конспект</h2>
                <p className="leading-relaxed">{session.worksheet.summary}</p>
              </section>
              <section id="tasks" className="mb-10 rounded-lg bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Задания</h2>
                <ul className="space-y-4">
                  {session.worksheet.tasks.map((t, i) => (
                    <li key={i} className="rounded-md border border-gray-200 p-4">
                      <div className="mb-1 text-sm text-gray-500">{t.type}</div>
                      <div className="leading-relaxed">{t.text}</div>
                    </li>
                  ))}
                </ul>
              </section>
              <section id="questions" className="mb-10 rounded-lg bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Вопросы для закрепления</h2>
                <ul className="list-disc space-y-2 pl-6">
                  {session.worksheet.questions.map((q, i) => (
                    <li key={i} className="leading-relaxed">{q}</li>
                  ))}
                </ul>
              </section>
              <div className="flex items-center gap-3">
                <Link to="/" className="text-blue-700 hover:underline">Сгенерировать новый лист</Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

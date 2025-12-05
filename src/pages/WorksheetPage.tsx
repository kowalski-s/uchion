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
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-indigo-600">УчиОн</Link>
              <div>
                <div className="text-lg font-medium text-gray-900">{session.worksheet.topic}</div>
                <div className="text-sm text-gray-500">{session.worksheet.subject}, {session.worksheet.grade}</div>
              </div>
            </div>
            <button
              onClick={downloadPdf}
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-2.5 font-medium text-white shadow-md transition-all hover:shadow-lg hover:brightness-110 active:scale-95"
            >
              <svg className="h-5 w-5 opacity-80 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Скачать PDF
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-12 gap-8">
          {/* LEFT SIDEBAR */}
          <aside className="col-span-12 lg:col-span-3">
            <nav className="sticky top-6 space-y-1 rounded-xl bg-white p-4 shadow-sm">
              <a href="#conspect" className="block rounded-lg px-4 py-3 font-medium text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                📖 Конспект
              </a>
              <a href="#tasks" className="block rounded-lg px-4 py-3 font-medium text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                ✏️ Задания
              </a>
              <a href="#test" className="block rounded-lg px-4 py-3 font-medium text-gray-600 hover:bg-gray-50 hover:text-indigo-600 transition-colors">
                📝 Мини‑тест
              </a>
            </nav>
          </aside>

          {/* MAIN CONTENT */}
          <main className="col-span-12 lg:col-span-9">
            <div className="mx-auto max-w-[820px]">
              {pdfError && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-sm">{pdfError}</div>
              )}

              {/* CONSPECT & EXAMPLES */}
              <section id="conspect" className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/50">
                <div className="border-b border-gray-100 bg-gray-50/50 px-8 py-6">
                  <h2 className="text-2xl font-bold text-gray-900">Конспект урока</h2>
                  <p className="mt-2 text-lg text-gray-600 leading-relaxed">
                    <span className="font-semibold text-indigo-600">Цель:</span> {session.worksheet.goal}
                  </p>
                </div>
                
                <div className="p-8">
                  <div className="prose prose-lg max-w-none text-gray-800">
                    <div className="whitespace-pre-wrap leading-loose">
                      {session.worksheet.summary}
                    </div>
                  </div>

                  {/* EXAMPLES BLOCK */}
                  <div className="mt-10 rounded-xl bg-indigo-50/60 p-6 ring-1 ring-indigo-100">
                    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-indigo-900">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-200 text-xs">💡</span>
                      Примеры
                    </h3>
                    <ul className="space-y-3">
                      {session.worksheet.examples.map((ex, i) => (
                        <li key={i} className="flex gap-3 text-indigo-900">
                          <span className="font-bold text-indigo-400">•</span>
                          <span className="leading-relaxed">{ex}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* TASKS */}
              <section id="tasks" className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/50">
                <div className="border-b border-gray-100 bg-gray-50/50 px-8 py-6">
                  <h2 className="text-2xl font-bold text-gray-900">Задания</h2>
                </div>
                <div className="p-8">
                  <ul className="space-y-6">
                    {session.worksheet.tasks.map((task, i) => (
                      <li key={i} className="relative pl-4">
                        <div className="absolute left-0 top-2 h-2 w-2 rounded-full bg-indigo-400"></div>
                        <div className="text-lg text-gray-800 leading-relaxed">{task}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              {/* TEST */}
              <section id="test" className="mb-12 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200/50">
                <div className="border-b border-gray-100 bg-gray-50/50 px-8 py-6">
                  <h2 className="text-2xl font-bold text-gray-900">Мини‑тест</h2>
                </div>
                <div className="p-8">
                  <ol className="space-y-8">
                    {session.worksheet.test.map((q, i) => (
                      <li key={i} className="rounded-xl border border-gray-100 bg-gray-50/30 p-6">
                        <div className="mb-4 text-lg font-medium text-gray-900">{i + 1}. {q.question}</div>
                        {q.options && q.options.length > 0 ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {q.options.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-gray-700 transition-colors hover:border-indigo-200 hover:bg-indigo-50/30">
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-xs font-medium text-gray-500">
                                  {String.fromCharCode(65 + idx)}
                                </div>
                                <span>{opt}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 border-b-2 border-gray-200 border-dashed py-2 text-gray-400 italic">
                            Место для ответа...
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
              
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

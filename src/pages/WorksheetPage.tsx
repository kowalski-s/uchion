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
              <div className="text-gray-700">{session.worksheet.topic}</div>
              <div className="text-sm text-gray-500">{session.worksheet.subject}, {session.worksheet.grade}</div>
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
              <a href="#conspect" className="block rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200">Конспект</a>
              <a href="#bloom" className="block rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200">Задания по Блуму</a>
              <a href="#test" className="block rounded-md bg-gray-100 px-3 py-2 hover:bg-gray-200">Мини‑тест</a>
            </nav>
          </aside>
          <main className="col-span-12 lg:col-span-9">
            <div className="mx-auto max-w-2xl">
              {pdfError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">{pdfError}</div>
              )}
              <section id="conspect" className="mb-10 rounded-lg bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Конспект</h2>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-gray-500">Цель урока</div>
                    <p className="leading-relaxed">{session.worksheet.conspect.goal}</p>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Введение</div>
                    <p className="leading-relaxed">{session.worksheet.conspect.introduction}</p>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Шаги объяснения</div>
                    <ul className="list-disc space-y-2 pl-6">
                      {session.worksheet.conspect.steps.map((s, i) => (
                        <li key={i} className="leading-relaxed"><span className="font-medium">{s.title}:</span> {s.text}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Мини‑практика</div>
                    <p className="leading-relaxed">{session.worksheet.conspect.miniPractice}</p>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Пример с ошибкой</div>
                    <p className="leading-relaxed">{session.worksheet.conspect.analysisExample}</p>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Мини‑вывод</div>
                    <p className="leading-relaxed">{session.worksheet.conspect.miniConclusion}</p>
                  </div>
                </div>
              </section>
              <section id="bloom" className="mb-10 rounded-lg bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">5 заданий по методу Блума</h2>
                <ul className="space-y-4">
                  {session.worksheet.bloomTasks.map((t, i) => (
                    <li key={i} className="rounded-md border border-gray-200 p-4">
                      <div className="mb-1 text-sm text-gray-500">Уровень {t.level} — {t.title}</div>
                      <div className="leading-relaxed">{t.task}</div>
                    </li>
                  ))}
                </ul>
              </section>
              <section id="test" className="mb-10 rounded-lg bg-white p-8 shadow-sm">
                <h2 className="mb-4 text-xl font-semibold">Мини‑тест</h2>
                <ol className="space-y-4">
                  {session.worksheet.test.map((q, i) => (
                    <li key={i} className="rounded-md border border-gray-200 p-4">
                      <div className="font-medium">{q.question}</div>
                      {q.type !== 'open' && q.options && q.options.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {q.options.map((opt, idx) => (
                            <li key={idx} className="text-gray-700">{String.fromCharCode(1040 + idx)}. {opt}</li>
                          ))}
                        </ul>
                      )}
                      {q.type === 'open' && (
                        <div className="mt-2 text-gray-500">Ответ: ________</div>
                      )}
                    </li>
                  ))}
                </ol>
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

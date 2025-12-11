import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useSessionStore } from '../store/session'
import { DummyProvider, generateWorksheet } from '../lib/api'
import type { Worksheet, PublicWorksheet, GeneratePayload } from '../../shared/types'
import { buildWorksheetPdf } from '../lib/pdf-client'

const PageContainer = ({ children, id, className = '' }: { children: React.ReactNode, id?: string, className?: string }) => (
  <div id={id} className={`mx-auto max-w-[210mm] bg-white p-[15mm] shadow-lg border border-gray-100 rounded-xl mb-12 last:mb-0 print:max-w-none print:w-full print:shadow-none print:p-[10mm] print:border-0 print:rounded-none print:mb-0 print:mx-0 ${className}`}>
    {children}
  </div>
)

const SidebarNav = ({ activePage }: { activePage: number }) => (
  <nav className="hidden xl:flex flex-col gap-2 fixed left-8 top-32 w-40 text-sm print:hidden">
    <a 
      href="#page1" 
      className={`px-3 py-2 rounded-md transition-colors ${activePage === 1 ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
    >
      Задания
    </a>
    <a 
      href="#page2" 
      className={`px-3 py-2 rounded-md transition-colors ${activePage === 2 ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
    >
      Тест
    </a>
    <a 
      href="#page3" 
      className={`px-3 py-2 rounded-md transition-colors ${activePage === 3 ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
    >
      Заметки
    </a>
    <a 
      href="#page4" 
      className={`px-3 py-2 rounded-md transition-colors ${activePage === 4 ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
    >
      Ответы
    </a>
  </nav>
)

const shouldShowAnswerField = (text: string) => {
  const lower = text.toLowerCase()
  const hiddenKeywords = ['подчеркни', 'обведи', 'зачеркни', 'раскрась', 'соедини']
  return !hiddenKeywords.some(k => lower.includes(k))
}

export default function WorksheetPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const worksheetRef = useRef<HTMLDivElement | null>(null)
  
  const sessionStore = useSessionStore()
  const [worksheet, setWorksheet] = useState<Worksheet | null>(
    sessionId ? sessionStore.getSession(sessionId)?.worksheet ?? null : null
  )
  const [loading, setLoading] = useState(!worksheet)
  const [activePage, setActivePage] = useState(1)
  const [regenProgress, setRegenProgress] = useState(0)

  const regenerateMutation = useMutation({
    mutationFn: (payload: GeneratePayload) => generateWorksheet(payload, (p) => setRegenProgress(p)),
    onSuccess: (res) => {
      if (res.status === 'error') {
        alert(res.message) // Simple alert for now, or use a toast
        return
      }
      const newWorksheet = res.data.worksheet
      setWorksheet(newWorksheet)
      try {
        localStorage.setItem('uchion_cached_worksheet', JSON.stringify(newWorksheet))
      } catch (e) {
        console.error('Failed to update cache', e)
      }
      // Update session store too if we want consistency
      if (sessionId) {
        sessionStore.saveSession(sessionId, {
          payload: { 
            subject: newWorksheet.subject, 
            grade: parseInt(newWorksheet.grade) || 3, 
            topic: newWorksheet.topic 
          },
          worksheet: newWorksheet,
          pdfBase64: newWorksheet.pdfBase64
        })
      }
    },
    onError: () => {
      alert('Не удалось перегенерировать лист. Попробуйте ещё раз.')
    }
  })

  const handleNewGeneration = () => {
    localStorage.removeItem('uchion_cached_worksheet')
    navigate('/')
  }

  // Fetch worksheet if not in store (e.g. on refresh or direct link)
  useEffect(() => {
    if (!sessionId) return
    if (worksheet) {
      setLoading(false)
      return
    }

    const loadWorksheet = async () => {
      setLoading(true)
      try {
        // 1. Try localStorage first
        const cached = localStorage.getItem('uchion_cached_worksheet')
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as Worksheet
            setWorksheet(parsed)
            setLoading(false)
            return 
          } catch (e) {
            console.error('Failed to parse cached worksheet', e)
            localStorage.removeItem('uchion_cached_worksheet')
          }
        }

        // 2. Fallback to DummyProvider (or real API fetch if implemented)
        // In a real app, you would fetch from your API/DB here
        // For now, we use the DummyProvider as requested for dev/testing
        const data = await DummyProvider.getWorksheetById(sessionId)
        if (data) {
          setWorksheet(data)
        }
      } catch (e) {
        console.error('Failed to load worksheet', e)
      } finally {
        setLoading(false)
      }
    }

    loadWorksheet()
  }, [sessionId, worksheet])

  useEffect(() => {
    const handleScroll = () => {
      const p1 = document.getElementById('page1')
      const p2 = document.getElementById('page2')
      const p3 = document.getElementById('page3')
      const p4 = document.getElementById('page4')
      
      const scrollY = window.scrollY + 200 // offset

      if (p4 && scrollY >= p4.offsetTop) setActivePage(4)
      else if (p3 && scrollY >= p3.offsetTop) setActivePage(3)
      else if (p2 && scrollY >= p2.offsetTop) setActivePage(2)
      else setActivePage(1)
    }
    
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleDownloadPdf = async () => {
    if (!worksheet) return
    try {
      const blob = await buildWorksheetPdf(worksheet)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(worksheet.topic || 'worksheet').replace(/\s+/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('PDF download error:', err)
      alert('Не удалось создать PDF. Попробуйте еще раз.')
    }
  }

  // Helper function to format text with bold markers
  const formatText = (text: string) => {
    if (!text) return null
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto"></div>
          <p className="text-gray-600">Загрузка рабочего листа...</p>
        </div>
      </div>
    )
  }

  if (!worksheet) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-4 text-xl font-semibold">Лист не найден</div>
        <p className="mb-6 text-gray-600">Возможно, ссылка устарела или содержит ошибку.</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex h-11 items-center justify-center rounded-md bg-blue-600 px-6 text-white hover:bg-blue-700"
        >
          На главную
        </button>
      </div>
    )
  }

  // In PDF/Print mode, we might want to hide some elements or just rely on @media print
  // Here we can also use isPdfMode to conditionally render if @media print is not enough
  
  return (
    <div className={`min-h-screen bg-gray-50 print:bg-white`}>
      {/* HEADER (Hidden on Print) */}
      <header className={`border-b bg-white shadow-sm sticky top-0 z-50 print:hidden`}>
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-indigo-600">УчиОн</Link>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900">{worksheet.topic}</div>
                <div className="text-xs text-gray-500">{worksheet.subject}, {worksheet.grade}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
               <button
                onClick={handleNewGeneration}
                className="group flex flex-col items-center gap-0.5 pt-4"
                title="Создать новый материал"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white shadow-sm transition-all group-hover:bg-indigo-50 group-active:scale-95">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-indigo-600">Новая генерация</span>
              </button>

               <button
                onClick={handlePrint}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-700 shadow hover:bg-gray-50 hover:text-indigo-600 transition-all"
                title="Распечатать"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
              </button>
              
              <button
                onClick={handleDownloadPdf}
                className="group flex flex-col items-center gap-0.5 pt-4"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white shadow-sm transition-all group-hover:bg-indigo-50 group-active:scale-95">
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
                <span className="text-[10px] font-medium text-gray-500 group-hover:text-indigo-600">Скачать PDF</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <SidebarNav activePage={activePage} />

      <main className="py-12 print:py-0">
        <div id="worksheet-pdf-root" className="worksheet-pdf-root">
          <div ref={worksheetRef}>
          {/* PAGE 1 */}
          <PageContainer id="page1">
          {/* HEADER */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-gray-100 pb-4 gap-4">
            <div className="flex items-center gap-2 text-indigo-600">
               <span className="text-2xl font-bold tracking-tight">УчиОн</span>
            </div>
            {/* Name/Date Header for First Page */}
             <div className="text-sm text-gray-500 w-full sm:w-auto sm:min-w-[320px]">
               <div className="flex flex-col gap-2 w-full max-w-full">
                 <div className="flex items-center gap-2 w-full">
                   <span className="whitespace-nowrap">Имя и фамилия:</span>
                   <div className="border-b border-gray-300 flex-1 min-w-0"></div>
                 </div>

                 <div className="flex items-center gap-2 w-full">
                   <span className="whitespace-nowrap">Дата:</span>
                   <div className="border-b border-gray-300 flex-1 min-w-0"></div>
                 </div>
               </div>
             </div>
          </div>

          <h1 className="mb-6 text-center text-3xl font-bold text-gray-900">{worksheet.topic}</h1>

          {/* ASSIGNMENTS */}
          <section className="flex flex-col">
            <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 print:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">✏️</span>
              Задания
            </h2>
            {/* Print-only simplified header for Assignments */}
            <h2 className="hidden print:flex mb-4 text-lg font-bold text-gray-900 border-b pb-2 items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white text-xs">✏️</span>
              Задания
            </h2>

            <div className="flex flex-col gap-6">
              {worksheet.assignments.map((task, i) => (
                <div key={i} className={`task-block break-inside-avoid ${i === 0 ? 'mt-2' : ''}`}>
                  <div className="mb-3 text-lg font-medium text-gray-900 leading-tight">
                    <span className="mr-2 text-indigo-600 print:text-black">{i + 1}.</span>
                    {task.text}
                  </div>
                  {shouldShowAnswerField(task.text) && (
                    <div className="mt-3 h-48 w-full rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/30 print:border-gray-300 print:h-32"></div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </PageContainer>

        <div className="page-break"></div>

        {/* PAGE 2 */}
        <PageContainer id="page2">
          {/* TEST */}
          <section className="h-full flex flex-col">
            <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 print:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">📝</span>
              Мини-тест
            </h2>
            {/* Print-only simplified header for Test */}
            <h2 className="hidden print:flex mb-4 text-lg font-bold text-gray-900 border-b pb-2 items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-indigo-600 text-white text-xs">📝</span>
              Мини-тест
            </h2>

            <div className="grid gap-6">
              {worksheet.test.map((q, i) => (
                <div key={i} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm break-inside-avoid print:border print:border-gray-300 print:shadow-none print:p-4">
                  <div className="mb-3 font-medium text-gray-900">{i + 1}. {q.question}</div>
                  <div className="space-y-2">
                    {q.options.map((opt, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-xs font-bold text-gray-500">
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-gray-700">{opt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </PageContainer>

        <div className="page-break"></div>

        {/* PAGE 3 */}
        <PageContainer id="page3" className="flex flex-col">
          {/* EVALUATION & NOTES */}
          <section className="mb-8 break-inside-avoid">
            <div className="rounded-xl bg-gray-50 p-6">
              <h3 className="mb-4 font-bold text-gray-900">😊 Оценка урока</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded border border-gray-300 bg-white" />
                  <span>Все понял</span>
                </label>
                <label className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded border border-gray-300 bg-white" />
                  <span>Было немного сложно</span>
                </label>
                <label className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded border border-gray-300 bg-white" />
                  <span>Нужна помощь</span>
                </label>
              </div>
            </div>
          </section>
          
          <section className="break-inside-avoid flex-grow">
            <div className="rounded-xl bg-gray-50 p-6 h-full min-h-[600px] print:min-h-0">
              <h3 className="mb-4 font-bold text-gray-900">📝 Заметки</h3>
              <div className="space-y-8">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div key={i} className="border-b border-gray-300" />
                ))}
              </div>
            </div>
          </section>
        </PageContainer>
          </div>
        
        <div className="page-break"></div>
        
        {/* PAGE 4: ANSWERS (не включаем в PDF) */}
        <PageContainer id="page4">
           <h2 className="mb-8 text-center text-2xl font-bold text-gray-900">🔍 Ответы</h2>
           <div className="grid gap-8 md:grid-cols-2 answers-grid">
             <div className="break-inside-avoid">
               <h3 className="mb-4 text-lg font-bold text-indigo-600">Задания</h3>
               <ul className="space-y-4">
                 {worksheet.answers.assignments.map((ans, i) => (
                   <li key={i} className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800 border border-gray-100 print:border-gray-200">
                     <span className="font-bold text-indigo-500 mr-2">{i + 1}.</span>
                     {ans}
                   </li>
                 ))}
               </ul>
             </div>
             <div className="break-inside-avoid">
               <h3 className="mb-4 text-lg font-bold text-indigo-600">Мини-тест</h3>
               <ul className="space-y-2">
                 {worksheet.answers.test.map((ans, i) => (
                   <li key={i} className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 border border-gray-100 print:border-gray-200">
                     <span className="font-bold text-indigo-500">{i + 1}.</span>
                     <span>{ans}</span>
                   </li>
                 ))}
               </ul>
             </div>
           </div>
        </PageContainer>
        </div>

      </main>

      {/* Loading Overlay for Regeneration */}
      {/* Removed regenerate overlay as we redirect to home now */}
      
      <style>{`
        .worksheet-pdf-root { 
          background: white; 
          padding: 16px 24px; 
          max-width: 800px; 
          margin: 0 auto; 
        }

        @media print {
          @page { margin: 10mm; size: auto; }
          body { 
            background: white; 
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
          }
          
          /* Основной контейнер */
          main {
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Сброс стилей для контейнеров страниц */
          .mx-auto.max-w-\\[210mm\\] {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
          }

          /* Убираем отступы у заголовков на первой странице */
          #page1 {
            padding-top: 0 !important;
          }

          .page-break { page-break-before: always; }
          
          /* Prevent breaks inside tasks and cards */
          .task-block, .card, .exercise, .break-inside-avoid { 
            page-break-inside: avoid !important; 
            break-inside: avoid !important; 
          }

          /* Ensure proper spacing */
          .task-block { 
             margin-bottom: 12px; 
          }

          /* Two columns for answers */
          .answers-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            column-gap: 8mm;
            row-gap: 2mm;
          }

          /* Hide UI elements */
          nav, header, button, .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}

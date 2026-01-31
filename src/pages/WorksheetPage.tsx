import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSessionStore } from '../store/session'
import { DummyProvider, regenerateTask } from '../lib/api'
import type { Worksheet } from '../../shared/types'
import { buildWorksheetPdf } from '../lib/pdf-client'
import { useWorksheetEditor } from '../hooks/useWorksheetEditor'
import EditableWorksheetContent from '../components/EditableWorksheetContent'
import EditModeToolbar from '../components/EditModeToolbar'
import UnsavedChangesDialog, { useBeforeUnload } from '../components/UnsavedChangesDialog'

const SidebarNav = ({ activePage, hasAssignments, hasTest }: { activePage: number, hasAssignments: boolean, hasTest: boolean }) => (
  <nav className="hidden xl:flex flex-col gap-2 fixed left-8 top-32 w-40 text-sm print:hidden">
    {hasAssignments && (
      <a
        href="#page1"
        className={`px-3 py-2 rounded-md transition-colors ${activePage === 1 ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
      >
        Задания
      </a>
    )}
    {hasTest && (
      <a
        href="#page2"
        className={`px-3 py-2 rounded-md transition-colors ${activePage === 2 ? 'text-indigo-600 font-semibold bg-indigo-50' : 'text-gray-500 hover:text-indigo-500 hover:bg-gray-50'}`}
      >
        Тест
      </a>
    )}
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

export default function WorksheetPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const worksheetRef = useRef<HTMLDivElement | null>(null)

  const sessionStore = useSessionStore()
  const [initialWorksheet, setInitialWorksheet] = useState<Worksheet | null>(
    sessionId ? sessionStore.getSession(sessionId)?.worksheet ?? null : null
  )
  const [loading, setLoading] = useState(!initialWorksheet)
  const [activePage, setActivePage] = useState(1)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)
  const [regeneratingIndex, setRegeneratingIndex] = useState<{ index: number; isTest: boolean } | null>(null)

  // Worksheet editor hook
  const editor = useWorksheetEditor({
    initialWorksheet,
    sessionId,
  })

  // Browser beforeunload warning
  useBeforeUnload(editor.isDirty, editor.isEditMode)

  const handleNewGeneration = () => {
    if (editor.isDirty && editor.isEditMode) {
      setPendingNavigation('/')
      setShowUnsavedDialog(true)
    } else {
      localStorage.removeItem('uchion_cached_worksheet')
      navigate('/')
    }
  }

  // Fetch worksheet if not in store (e.g. on refresh or direct link)
  useEffect(() => {
    if (!sessionId) return
    if (initialWorksheet) {
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
            setInitialWorksheet(parsed)
            setLoading(false)
            return
          } catch (e) {
            void e
            localStorage.removeItem('uchion_cached_worksheet')
          }
        }

        // 2. Fallback to DummyProvider (or real API fetch if implemented)
        const data = await DummyProvider.getWorksheetById(sessionId)
        if (data) {
          setInitialWorksheet(data)
        }
      } catch (e) {
        void e
      } finally {
        setLoading(false)
      }
    }

    loadWorksheet()
  }, [sessionId, initialWorksheet])

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
    const currentWorksheet = editor.worksheet
    if (!currentWorksheet) return

    try {
      let blob: Blob

      // If we have server-generated PDF, use it directly
      if (currentWorksheet.pdfBase64 && currentWorksheet.pdfBase64.length > 0) {
        const binaryString = atob(currentWorksheet.pdfBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: 'application/pdf' })
      } else {
        // Fallback to client-side generation (for edited worksheets or if server PDF missing)
        blob = await buildWorksheetPdf(currentWorksheet)
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(currentWorksheet.topic || 'worksheet').replace(/\s+/g, '-')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      void err
      alert('Не удалось создать PDF. Попробуйте еще раз.')
    }
  }

  // Handle cancel with unsaved changes check
  const handleCancel = () => {
    if (editor.isDirty) {
      setPendingNavigation(null)
      setShowUnsavedDialog(true)
    } else {
      editor.exitEditMode()
    }
  }

  // Handle regenerate task
  const handleRegenerateTask = async (index: number, taskType: string, isTest: boolean) => {
    if (!editor.worksheet || regeneratingIndex) return

    setRegeneratingIndex({ index, isTest })

    try {
      const gradeNum = parseInt(editor.worksheet.grade.match(/\d+/)?.[0] || '1')
      const session = sessionId ? sessionStore.getSession(sessionId) : null
      const difficulty = (session?.payload as Record<string, unknown>)?.difficulty as string || 'medium'

      const result = await regenerateTask({
        taskIndex: index,
        taskType,
        isTest,
        context: {
          subject: editor.worksheet.subject,
          grade: gradeNum,
          topic: editor.worksheet.topic,
          difficulty,
        },
      })

      if (result.status === 'ok' && result.data) {
        if (isTest && result.data.testQuestion) {
          editor.replaceTestQuestion(index, result.data.testQuestion, result.data.answer)
        } else if (!isTest && result.data.assignment) {
          editor.replaceAssignment(index, result.data.assignment, result.data.answer)
        }

        // Persist to localStorage
        try {
          const updated = editor.worksheet
          if (updated) {
            localStorage.setItem('uchion_cached_worksheet', JSON.stringify(updated))
          }
        } catch { /* ignore */ }
      } else {
        alert(result.message || 'Не удалось перегенерировать задание.')
      }
    } catch {
      alert('Не удалось перегенерировать задание. Попробуйте ещё раз.')
    } finally {
      setRegeneratingIndex(null)
    }
  }

  // Dialog handlers
  const handleDialogSave = async () => {
    const success = await editor.saveChanges()
    if (success) {
      setShowUnsavedDialog(false)
      if (pendingNavigation) {
        localStorage.removeItem('uchion_cached_worksheet')
        navigate(pendingNavigation)
      }
    }
  }

  const handleDialogDiscard = () => {
    editor.discardChanges()
    setShowUnsavedDialog(false)
    if (pendingNavigation) {
      localStorage.removeItem('uchion_cached_worksheet')
      navigate(pendingNavigation)
    }
  }

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false)
    setPendingNavigation(null)
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

  if (!editor.worksheet) {
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

  return (
    <div className={`min-h-screen bg-gray-50 print:bg-white`}>
      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        isSaving={editor.isSaving}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />

      {/* HEADER (Hidden on Print) */}
      <header className={`border-b bg-white shadow-sm sticky top-0 z-50 print:hidden`}>
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xl font-bold text-indigo-600">УчиОн</Link>
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-gray-900">{editor.worksheet.topic}</div>
                <div className="text-xs text-gray-500">
                  {editor.worksheet.subject}, {editor.worksheet.grade}
                  {editor.isEditMode && <span className="ml-2 text-indigo-500">(редактирование)</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Edit mode toolbar */}
              <EditModeToolbar
                isEditMode={editor.isEditMode}
                isDirty={editor.isDirty}
                isSaving={editor.isSaving}
                error={editor.error}
                onEdit={editor.enterEditMode}
                onSave={editor.saveChanges}
                onCancel={handleCancel}
              />

              {/* Navigation buttons - only show when not in edit mode */}
              {!editor.isEditMode && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <SidebarNav
        activePage={activePage}
        hasAssignments={editor.worksheet.assignments.length > 0}
        hasTest={editor.worksheet.test.length > 0}
      />

      <main className="py-12 print:py-0">
        <div ref={worksheetRef}>
          <EditableWorksheetContent
            worksheet={editor.worksheet}
            isEditMode={editor.isEditMode}
            onUpdateAssignment={editor.updateAssignment}
            onUpdateTestQuestion={editor.updateTestQuestion}
            onUpdateTestOption={editor.updateTestOption}
            onUpdateAssignmentAnswer={editor.updateAssignmentAnswer}
            onUpdateTestAnswer={editor.updateTestAnswer}
            onRegenerateTask={handleRegenerateTask}
            regeneratingIndex={regeneratingIndex}
          />
        </div>
      </main>
    </div>
  )
}

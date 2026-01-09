import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import { fetchWorksheet, formatSubjectName } from '../lib/dashboard-api'
import { buildWorksheetPdf } from '../lib/pdf-client'
import type { Worksheet } from '../../shared/types'
import { useWorksheetEditor } from '../hooks/useWorksheetEditor'
import EditableWorksheetContent from '../components/EditableWorksheetContent'
import EditModeToolbar from '../components/EditModeToolbar'
import UnsavedChangesDialog, { useBeforeUnload } from '../components/UnsavedChangesDialog'

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/50 to-white flex items-center justify-center">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200"></div>
        <div className="absolute inset-0 animate-spin rounded-full h-12 w-12 border-t-2 border-[#8C52FF]"></div>
      </div>
    </div>
  )
}

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

export default function SavedWorksheetPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status } = useAuth()
  const worksheetRef = useRef<HTMLDivElement | null>(null)
  const [activePage, setActivePage] = useState(1)
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login')
    }
  }, [status, navigate])

  // Fetch worksheet from DB
  const { data: worksheetData, isLoading, error } = useQuery({
    queryKey: ['worksheet', id],
    queryFn: async () => {
      const result = await fetchWorksheet(id!)
      return result
    },
    enabled: !!id && status === 'authenticated',
    retry: 1,
  })

  // Extract worksheet content
  const initialWorksheet = worksheetData?.content as Worksheet | null

  // Worksheet editor hook
  const editor = useWorksheetEditor({
    initialWorksheet,
    worksheetId: id,
    onSaveSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheet', id] })
    },
  })

  // Browser beforeunload warning
  useBeforeUnload(editor.isDirty, editor.isEditMode)

  // Handle scroll for sidebar nav
  useEffect(() => {
    const handleScroll = () => {
      const p1 = document.getElementById('page1')
      const p2 = document.getElementById('page2')
      const p3 = document.getElementById('page3')
      const p4 = document.getElementById('page4')

      const scrollY = window.scrollY + 200

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
        console.log('[PDF] Using server-generated PDF, base64 length:', currentWorksheet.pdfBase64.length)
        const binaryString = atob(currentWorksheet.pdfBase64)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }
        blob = new Blob([bytes], { type: 'application/pdf' })
      } else {
        // Fallback to client-side generation (for edited worksheets or if server PDF missing)
        console.log('[PDF] Falling back to client-side PDF generation')
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
      console.error('PDF download error:', err)
      alert('Не удалось создать PDF. Попробуйте еще раз.')
    }
  }

  // Handle navigation with unsaved changes check
  const handleNavigate = (to: string) => {
    if (editor.isDirty && editor.isEditMode) {
      setPendingNavigation(to)
      setShowUnsavedDialog(true)
    } else {
      navigate(to)
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

  // Dialog handlers
  const handleDialogSave = async () => {
    const success = await editor.saveChanges()
    if (success) {
      setShowUnsavedDialog(false)
      if (pendingNavigation) {
        navigate(pendingNavigation)
      }
    }
  }

  const handleDialogDiscard = () => {
    editor.discardChanges()
    setShowUnsavedDialog(false)
    if (pendingNavigation) {
      navigate(pendingNavigation)
    }
  }

  const handleDialogCancel = () => {
    setShowUnsavedDialog(false)
    setPendingNavigation(null)
  }

  if (status === 'loading' || isLoading) {
    return <LoadingSpinner />
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка'
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-4 text-xl font-semibold">Ошибка загрузки</div>
        <p className="mb-2 text-gray-600">Не удалось загрузить рабочий лист.</p>
        <p className="mb-6 text-sm text-gray-400">{errorMessage}</p>
        <div className="flex gap-4">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center justify-center rounded-md border border-[#8C52FF] px-6 text-[#8C52FF] hover:bg-purple-50"
          >
            Попробовать снова
          </button>
          <button
            onClick={() => navigate('/worksheets')}
            className="inline-flex h-11 items-center justify-center rounded-md bg-[#8C52FF] px-6 text-white hover:bg-purple-700"
          >
            К списку листов
          </button>
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
          onClick={() => navigate('/dashboard')}
          className="inline-flex h-11 items-center justify-center rounded-md bg-[#8C52FF] px-6 text-white hover:bg-purple-700"
        >
          В личный кабинет
        </button>
      </div>
    )
  }

  const displayTitle = worksheetData?.title || `${formatSubjectName(worksheetData?.subject || '')} ${worksheetData?.grade} класс`

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Unsaved changes dialog */}
      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        isSaving={editor.isSaving}
        onSave={handleDialogSave}
        onDiscard={handleDialogDiscard}
        onCancel={handleDialogCancel}
      />

      {/* HEADER */}
      <header className="border-b bg-white shadow-sm sticky top-0 z-50 print:hidden">
        <div className="mx-auto max-w-7xl px-6 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Logo + Back button */}
            <div className="flex items-center gap-3">
              <Link to="/" className="text-xl font-bold text-indigo-600">УчиОн</Link>
              <button
                onClick={() => handleNavigate('/worksheets')}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-indigo-100 bg-white shadow-sm transition-all hover:bg-indigo-50 active:scale-95"
                title="К списку листов"
              >
                <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
              </button>
            </div>

            {/* Center: Subject, grade, topic */}
            <div className="hidden sm:block text-center flex-1 px-4">
              <div className="text-sm font-medium text-gray-900">
                {formatSubjectName(worksheetData?.subject || '')}, {worksheetData?.grade} класс
                {editor.isEditMode && <span className="ml-2 text-indigo-500">(редактирование)</span>}
              </div>
              <div className="text-xs text-gray-500 truncate max-w-md mx-auto">{editor.worksheet.topic}</div>
            </div>

            {/* Right: Action buttons */}
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
                    onClick={() => handleNavigate('/')}
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
                    className="group flex flex-col items-center gap-0.5 pt-4"
                    title="Распечатать"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white shadow-sm transition-all group-hover:bg-indigo-50 group-active:scale-95">
                      <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                    </div>
                    <span className="text-[10px] font-medium text-gray-500 group-hover:text-indigo-600">Печать</span>
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

      <SidebarNav activePage={activePage} />

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
          />
        </div>
      </main>
    </div>
  )
}

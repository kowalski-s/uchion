import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchPresentation } from '../lib/presentation-api'
import { formatSubjectName } from '../lib/dashboard-api'
import Header from '../components/Header'
import SlidePreview from '../components/presentations/SlidePreview'
import type { PresentationThemePreset } from '../../shared/types'

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

export default function SavedPresentationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: presentation, isLoading, error } = useQuery({
    queryKey: ['presentation', id],
    queryFn: () => fetchPresentation(id!),
    enabled: !!id,
  })

  const handleDownloadPptx = () => {
    if (!presentation?.pptxBase64) return
    const filename = `${presentation.title.replace(/[^a-zа-яё0-9\s]/gi, '_')}.pptx`
    downloadBase64File(presentation.pptxBase64, filename, 'application/vnd.openxmlformats-officedocument.presentationml.presentation')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
        <Header />
        <div className="flex items-center justify-center py-20">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200"></div>
            <div className="absolute inset-0 animate-spin rounded-full h-12 w-12 border-t-2 border-[#8C52FF]"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !presentation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
        <Header />
        <div className="mx-auto max-w-4xl px-4 py-20 text-center">
          <p className="text-lg text-slate-500 mb-4">
            {error instanceof Error ? error.message : 'Презентация не найдена'}
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2.5 rounded-xl bg-[#8C52FF] text-white text-sm font-medium hover:bg-[#7B3FEE] transition-colors"
          >
            Вернуться в кабинет
          </button>
        </div>
      </div>
    )
  }

  const themePreset: PresentationThemePreset | undefined =
    presentation.themeType === 'preset' && presentation.themePreset
      ? presentation.themePreset
      : undefined

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <Header />

      <main className="mx-auto max-w-5xl px-4 py-10">
        {/* Header with title + action buttons */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{presentation.title}</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {formatSubjectName(presentation.subject)}, {presentation.grade} класс
                <span className="mx-1.5 text-slate-300">|</span>
                {presentation.slideCount} слайдов
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleDownloadPptx}
                disabled={!presentation.pptxBase64}
                className="inline-flex h-10 px-5 items-center justify-center rounded-xl bg-[#A855F7]/80 hover:bg-[#A855F7]/90 text-sm font-semibold text-white shadow-md shadow-purple-400/20 transition-all hover:shadow-purple-400/30 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Скачать .pptx
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="h-10 px-5 rounded-xl border-2 border-slate-200 bg-white text-slate-700 text-sm font-medium hover:border-slate-300 transition-all"
              >
                Назад в кабинет
              </button>
            </div>
          </div>
        </div>

        {/* Slide preview */}
        {presentation.structure && (
          <SlidePreview
            structure={presentation.structure}
            themePreset={themePreset}
          />
        )}
      </main>
    </div>
  )
}

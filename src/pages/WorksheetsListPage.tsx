import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../lib/auth'
import Header from '../components/Header'
import {
  fetchWorksheets,
  deleteWorksheet,
  updateWorksheet,
  fetchFolders,
  createFolder,
  formatSubjectName,
} from '../lib/dashboard-api'
import type { WorksheetListItem, FolderWithCount } from '../../shared/types'

const ITEMS_PER_PAGE = 9

// Icons
function DocumentIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function FolderIcon({ className = "w-5 h-5", color }: { className?: string; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill={color || "none"} viewBox="0 0 24 24" strokeWidth={1.5} stroke={color || "currentColor"} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
    </svg>
  )
}

function FolderMoveIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 0 0-1.883 2.542l.857 6a2.25 2.25 0 0 0 2.227 1.932H19.05a2.25 2.25 0 0 0 2.227-1.932l.857-6a2.25 2.25 0 0 0-1.883-2.542m-16.5 0V6A2.25 2.25 0 0 1 6 3.75h3.879a1.5 1.5 0 0 1 1.06.44l2.122 2.12a1.5 1.5 0 0 0 1.06.44H18A2.25 2.25 0 0 1 20.25 9v.776" />
    </svg>
  )
}

function XMarkIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

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

// Rename Modal Component
function RenameModal({
  isOpen,
  onClose,
  currentTitle,
  onSave,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  currentTitle: string
  onSave: (title: string) => void
  isLoading: boolean
}) {
  const [title, setTitle] = useState(currentTitle)

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle)
    }
  }, [isOpen, currentTitle])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Переименовать</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <XMarkIcon />
          </button>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8C52FF] mb-4"
          placeholder="Название листа"
          autoFocus
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => onSave(title)}
            disabled={isLoading || !title.trim()}
            className="flex-1 px-4 py-2.5 bg-[#8C52FF] hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Move to Folder Modal Component
function MoveToFolderModal({
  isOpen,
  onClose,
  folders,
  currentFolderId,
  onMove,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  folders: FolderWithCount[]
  currentFolderId: string | null | undefined
  onMove: (folderId: string | null) => void
  isLoading: boolean
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Переместить в папку</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <XMarkIcon />
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {/* Root folder option */}
          <button
            onClick={() => onMove(null)}
            disabled={isLoading || currentFolderId === null || currentFolderId === undefined}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
              currentFolderId === null || currentFolderId === undefined
                ? 'bg-purple-50 text-[#8C52FF] cursor-default'
                : 'hover:bg-slate-50'
            }`}
          >
            <DocumentIcon className="w-5 h-5 text-slate-400" />
            <span className="font-medium">Без папки</span>
          </button>
          {/* Folders */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onMove(folder.id)}
              disabled={isLoading || currentFolderId === folder.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                currentFolderId === folder.id
                  ? 'bg-purple-50 text-[#8C52FF] cursor-default'
                  : 'hover:bg-slate-50'
              }`}
            >
              <FolderIcon className="w-5 h-5" color={folder.color} />
              <span className="font-medium">{folder.name}</span>
              <span className="ml-auto text-sm text-slate-400">{folder.worksheetCount}</span>
            </button>
          ))}
        </div>
        {folders.length === 0 && (
          <p className="text-center text-slate-400 py-4">Папок пока нет</p>
        )}
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// Create Folder Modal Component
function CreateFolderModal({
  isOpen,
  onClose,
  onSave,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, color: string) => void
  isLoading: boolean
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#6366f1')
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#22c55e', '#14b8a6', '#3b82f6']

  useEffect(() => {
    if (isOpen) {
      setName('')
      setColor('#6366f1')
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900">Новая папка</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <XMarkIcon />
          </button>
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#8C52FF] mb-4"
          placeholder="Название папки"
          autoFocus
        />
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-2">Цвет</p>
          <div className="flex gap-2 flex-wrap">
            {colors.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-[#8C52FF]' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={() => onSave(name.trim(), color)}
            disabled={isLoading || !name.trim()}
            className="flex-1 px-4 py-2.5 bg-[#8C52FF] hover:bg-purple-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Создание...' : 'Создать'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Pagination Component
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) return null

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeftIcon />
      </button>

      {pages.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`w-10 h-10 rounded-lg font-medium transition-colors ${
            page === currentPage
              ? 'bg-[#8C52FF] text-white'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
        >
          {page}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rotate-180"
      >
        <ChevronLeftIcon />
      </button>
    </div>
  )
}

export default function WorksheetsListPage() {
  const navigate = useNavigate()
  const { user, status } = useAuth()
  const queryClient = useQueryClient()
  const [renameModal, setRenameModal] = useState<{ id: string; title: string } | null>(null)
  const [moveModal, setMoveModal] = useState<{ id: string; currentFolderId: string | null } | null>(null)
  const [createFolderModal, setCreateFolderModal] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null | 'all'>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (status === 'unauthenticated') {
      navigate('/login')
    }
  }, [status, navigate])

  // Reset page when folder changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedFolderId])

  // Fetch folders
  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: fetchFolders,
    enabled: status === 'authenticated',
  })

  // Fetch all worksheets (we'll paginate client-side)
  const { data: allWorksheets, isLoading: isLoadingWorksheets } = useQuery({
    queryKey: ['worksheets', selectedFolderId],
    queryFn: () => {
      if (selectedFolderId === 'all') {
        return fetchWorksheets({ limit: 1000 })
      } else if (selectedFolderId === null) {
        return fetchWorksheets({ folderId: null, limit: 1000 })
      } else {
        return fetchWorksheets({ folderId: selectedFolderId, limit: 1000 })
      }
    },
    enabled: status === 'authenticated',
  })

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: deleteWorksheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string } }) => {
      return updateWorksheet(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      setRenameModal(null)
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Не удалось переименовать лист')
    },
  })

  // Move worksheet to folder mutation
  const moveMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) => {
      return updateWorksheet(id, { folderId })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setMoveModal(null)
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Не удалось переместить лист')
    },
  })

  // Create folder mutation
  const createFolderMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => createFolder({ name, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setCreateFolderModal(false)
    },
    onError: (error) => {
      alert(error instanceof Error ? error.message : 'Не удалось создать папку')
    },
  })

  const handleRename = (title: string) => {
    if (renameModal && title.trim()) {
      updateMutation.mutate({ id: renameModal.id, data: { title: title.trim() } })
    }
  }

  const handleMove = (folderId: string | null) => {
    if (moveModal) {
      moveMutation.mutate({ id: moveModal.id, folderId })
    }
  }

  const handleCreateFolder = (name: string, color: string) => {
    createFolderMutation.mutate({ name, color })
  }

  const getDisplayTitle = (ws: WorksheetListItem) => {
    if (ws.title) return ws.title
    return `${formatSubjectName(ws.subject)}, ${ws.grade} класс`
  }

  const folders = foldersData?.folders || []
  const rootWorksheetCount = foldersData?.rootWorksheetCount || 0

  // Pagination logic
  const totalWorksheets = allWorksheets?.length || 0
  const totalPages = Math.ceil(totalWorksheets / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedWorksheets = allWorksheets?.slice(startIndex, startIndex + ITEMS_PER_PAGE) || []

  if (status === 'loading') {
    return <LoadingSpinner />
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50/30 to-white">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Back button and title */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-slate-500 hover:text-[#8C52FF] transition-colors mb-4"
          >
            <ChevronLeftIcon />
            <span className="font-medium">Назад в кабинет</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">Рабочие листы</h1>
          <p className="text-slate-500 mt-1">Всего: {totalWorksheets}</p>
        </div>

        {/* Folders Filter */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-slate-500">Папки</h2>
            <button
              onClick={() => setCreateFolderModal(true)}
              className="text-sm text-[#8C52FF] hover:text-purple-700 font-medium"
            >
              + Новая папка
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedFolderId('all')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedFolderId === 'all'
                  ? 'bg-[#8C52FF] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedFolderId === null
                  ? 'bg-[#8C52FF] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Без папки ({rootWorksheetCount})
            </button>
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedFolderId === folder.id
                    ? 'bg-[#8C52FF] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
                {folder.name} ({folder.worksheetCount})
              </button>
            ))}
          </div>
        </div>

        {/* Worksheets Grid */}
        {isLoadingWorksheets ? (
          <div className="flex justify-center py-20">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-2 border-purple-200"></div>
              <div className="absolute inset-0 animate-spin rounded-full h-12 w-12 border-t-2 border-[#8C52FF]"></div>
            </div>
          </div>
        ) : totalWorksheets === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-purple-100 rounded-3xl mb-6">
              <DocumentIcon className="w-12 h-12 text-[#8C52FF]" />
            </div>
            <p className="text-slate-500 text-xl mb-2">Рабочих листов пока нет</p>
            <p className="text-sm text-slate-400 mb-6">Создайте свой первый рабочий лист</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#8C52FF] hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Создать лист
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedWorksheets.map((ws) => (
                <div
                  key={ws.id}
                  className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all overflow-hidden group"
                >
                  {/* Card clickable area */}
                  <div
                    className="p-5 cursor-pointer"
                    onClick={() => navigate(`/worksheets/${ws.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shrink-0">
                        <DocumentIcon className="w-6 h-6 text-[#8C52FF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate text-lg mb-1 group-hover:text-[#8C52FF] transition-colors">
                          {getDisplayTitle(ws)}
                        </h3>
                        <p className="text-sm text-slate-500 truncate mb-2">{ws.topic}</p>
                        <p className="text-xs text-slate-400">
                          {new Date(ws.createdAt).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="px-5 pb-4 flex items-center gap-2 border-t border-slate-50 pt-3">
                    <button
                      onClick={() => setRenameModal({ id: ws.id, title: ws.title || getDisplayTitle(ws) })}
                      className="p-2 text-slate-400 hover:text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-all"
                      title="Переименовать"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      onClick={() => setMoveModal({ id: ws.id, currentFolderId: ws.folderId || null })}
                      className="p-2 text-slate-400 hover:text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-all"
                      title="Переместить в папку"
                    >
                      <FolderMoveIcon />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Удалить этот рабочий лист?')) {
                          deleteMutation.mutate(ws.id)
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 ml-auto"
                      title="Удалить"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </>
        )}
      </main>

      {/* Rename Modal */}
      <RenameModal
        isOpen={!!renameModal}
        onClose={() => setRenameModal(null)}
        currentTitle={renameModal?.title || ''}
        onSave={handleRename}
        isLoading={updateMutation.isPending}
      />

      {/* Move to Folder Modal */}
      <MoveToFolderModal
        isOpen={!!moveModal}
        onClose={() => setMoveModal(null)}
        folders={folders}
        currentFolderId={moveModal?.currentFolderId}
        onMove={handleMove}
        isLoading={moveMutation.isPending}
      />

      {/* Create Folder Modal */}
      <CreateFolderModal
        isOpen={createFolderModal}
        onClose={() => setCreateFolderModal(false)}
        onSave={handleCreateFolder}
        isLoading={createFolderMutation.isPending}
      />
    </div>
  )
}

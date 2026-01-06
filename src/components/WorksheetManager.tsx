import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import {
  fetchWorksheets,
  deleteWorksheet,
  updateWorksheet,
  fetchFolders,
  formatSubjectName,
} from '../lib/dashboard-api'
import type { WorksheetListItem, FolderWithCount } from '../../shared/types'

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

function ArrowRightIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
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

// Move to Folder Modal
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

export default function WorksheetManager() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status } = useAuth()
  const [renameModal, setRenameModal] = useState<{ id: string; title: string } | null>(null)
  const [moveModal, setMoveModal] = useState<{ id: string; currentFolderId: string | null } | null>(null)

  // Fetch folders for move modal
  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: fetchFolders,
    enabled: status === 'authenticated',
  })

  // Fetch only 5 recent worksheets for dashboard
  const { data: worksheets, isLoading: isLoadingWorksheets } = useQuery({
    queryKey: ['worksheets', 'recent'],
    queryFn: () => fetchWorksheets({ limit: 5 }),
    enabled: status === 'authenticated',
  })

  // Get total count
  const { data: allWorksheets } = useQuery({
    queryKey: ['worksheets', 'all'],
    queryFn: () => fetchWorksheets({ limit: 1000 }),
    enabled: status === 'authenticated',
  })

  const folders = foldersData?.folders || []
  const totalCount = allWorksheets?.length || 0

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: deleteWorksheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; folderId?: string | null } }) =>
      updateWorksheet(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setRenameModal(null)
      setMoveModal(null)
    },
  })

  const handleRename = (title: string) => {
    if (renameModal && title.trim()) {
      updateMutation.mutate({ id: renameModal.id, data: { title: title.trim() } })
    }
  }

  const handleMove = (folderId: string | null) => {
    if (moveModal) {
      updateMutation.mutate({ id: moveModal.id, data: { folderId } })
    }
  }

  const getDisplayTitle = (ws: WorksheetListItem) => {
    if (ws.title) return ws.title
    return `${formatSubjectName(ws.subject)}, ${ws.grade} класс`
  }

  return (
    <div>
      {/* Header with arrow to full list */}
      <div className="flex items-center gap-3 mb-4">
        <span className="section-badge">{totalCount}</span>
        <Link
          to="/worksheets"
          className="flex items-center gap-2 group"
        >
          <h2 className="text-lg font-bold text-slate-900 group-hover:text-[#8C52FF] transition-colors">Рабочие листы</h2>
          <ArrowRightIcon className="w-5 h-5 text-slate-400 group-hover:text-[#8C52FF] transition-colors" />
        </Link>
      </div>

      {/* Worksheets List - only 5 recent */}
      <div className="glass-container p-4 md:p-6">
        {isLoadingWorksheets ? (
          <div className="flex justify-center py-10">
            <div className="relative">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200"></div>
              <div className="absolute inset-0 animate-spin rounded-full h-10 w-10 border-t-2 border-[#8C52FF]"></div>
            </div>
          </div>
        ) : !worksheets || worksheets.length === 0 ? (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4">
              <DocumentIcon className="w-8 h-8 text-[#8C52FF]" />
            </div>
            <p className="text-slate-500">Рабочих листов пока нет</p>
            <p className="text-sm text-slate-400 mt-1">Нажмите «Создать» в меню сверху</p>
          </div>
        ) : (
          <div className="space-y-3">
            {worksheets.map((ws) => (
              <div
                key={ws.id}
                className="worksheet-card flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => navigate(`/worksheets/${ws.id}`)}
              >
                <div className="p-2 bg-slate-100 rounded-lg">
                  <DocumentIcon className="w-5 h-5 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {getDisplayTitle(ws)}
                  </p>
                  <p className="text-sm text-slate-500 truncate">{ws.topic}</p>
                  <p className="text-xs text-slate-400">
                    {new Date(ws.createdAt).toLocaleDateString('ru-RU')}
                  </p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  {/* Rename */}
                  <button
                    onClick={() => setRenameModal({ id: ws.id, title: ws.title || getDisplayTitle(ws) })}
                    className="p-2 text-slate-300 hover:text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-all"
                    title="Переименовать"
                  >
                    <PencilIcon />
                  </button>
                  {/* Move to folder */}
                  <button
                    onClick={() => setMoveModal({ id: ws.id, currentFolderId: ws.folderId || null })}
                    className="p-2 text-slate-300 hover:text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-all"
                    title="Переместить в папку"
                  >
                    <FolderMoveIcon />
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => {
                      if (confirm('Удалить этот рабочий лист?')) {
                        deleteMutation.mutate(ws.id)
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                    title="Удалить"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <RenameModal
        isOpen={!!renameModal}
        onClose={() => setRenameModal(null)}
        currentTitle={renameModal?.title || ''}
        onSave={handleRename}
        isLoading={updateMutation.isPending}
      />

      <MoveToFolderModal
        isOpen={!!moveModal}
        onClose={() => setMoveModal(null)}
        folders={folders}
        currentFolderId={moveModal?.currentFolderId}
        onMove={handleMove}
        isLoading={updateMutation.isPending}
      />
    </div>
  )
}

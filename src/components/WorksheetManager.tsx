import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  fetchWorksheets,
  fetchFolders,
  deleteWorksheet,
  duplicateWorksheet,
  updateWorksheet,
  createFolder,
  deleteFolder,
  formatSubjectName,
  FOLDER_COLORS,
} from '../lib/dashboard-api'
import type { WorksheetListItem, FolderWithCount } from '../../shared/types'

// Icons
function FolderIcon({ className = "w-5 h-5", color }: { className?: string; color?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill={color || 'currentColor'} viewBox="0 0 24 24" strokeWidth={1.5} stroke="none" className={className}>
      <path d="M19.5 21a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-6.088a1.5 1.5 0 0 1-1.077-.458L10.5 3.707A3 3 0 0 0 8.377 3H4.5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h15Z" />
    </svg>
  )
}

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

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
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

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
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

// Create Folder Modal
function CreateFolderModal({
  isOpen,
  onClose,
  onCreate,
  isLoading,
}: {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, color: string) => void
  isLoading: boolean
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(FOLDER_COLORS[0])

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
          <label className="text-sm font-medium text-slate-600 mb-2 block">Цвет</label>
          <div className="flex gap-2 flex-wrap">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-lg transition-transform ${color === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
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
            onClick={() => onCreate(name, color)}
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

export default function WorksheetManager() {
  const queryClient = useQueryClient()
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
  const [renameModal, setRenameModal] = useState<{ id: string; title: string } | null>(null)
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  // Fetch folders
  const { data: foldersData } = useQuery({
    queryKey: ['folders'],
    queryFn: fetchFolders,
  })

  // Fetch worksheets
  const { data: worksheets, isLoading: isLoadingWorksheets } = useQuery({
    queryKey: ['worksheets', selectedFolderId],
    queryFn: () => fetchWorksheets({ folderId: selectedFolderId }),
  })

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: deleteWorksheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })

  const duplicateMutation = useMutation({
    mutationFn: duplicateWorksheet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      queryClient.invalidateQueries({ queryKey: ['folders'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string } }) => updateWorksheet(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      setRenameModal(null)
    },
  })

  const createFolderMutation = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) => createFolder({ name, color }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      setShowCreateFolder(false)
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folders'] })
      queryClient.invalidateQueries({ queryKey: ['worksheets'] })
      setSelectedFolderId(null)
    },
  })

  const folders = foldersData?.folders || []
  const rootCount = foldersData?.rootWorksheetCount || 0

  const handleRename = (title: string) => {
    if (renameModal) {
      updateMutation.mutate({ id: renameModal.id, data: { title } })
    }
  }

  const getDisplayTitle = (ws: WorksheetListItem) => {
    if (ws.title) return ws.title
    return `${formatSubjectName(ws.subject)}, ${ws.grade} класс`
  }

  return (
    <div>
      {/* Folders Row */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
        {/* Back to root button */}
        {selectedFolderId && (
          <button
            onClick={() => setSelectedFolderId(null)}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors shrink-0"
          >
            <ChevronLeftIcon />
            Назад
          </button>
        )}

        {/* Root folder */}
        {!selectedFolderId && (
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors shrink-0 ${
              selectedFolderId === null ? 'bg-[#8C52FF] text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            <DocumentIcon className="w-4 h-4" />
            Все ({rootCount + folders.reduce((acc, f) => acc + f.worksheetCount, 0)})
          </button>
        )}

        {/* Folder list */}
        {!selectedFolderId && folders.map((folder) => (
          <button
            key={folder.id}
            onClick={() => setSelectedFolderId(folder.id)}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-600 transition-colors shrink-0"
          >
            <FolderIcon className="w-4 h-4" color={folder.color} />
            {folder.name} ({folder.worksheetCount})
          </button>
        ))}

        {/* Add folder button */}
        {!selectedFolderId && (
          <button
            onClick={() => setShowCreateFolder(true)}
            className="flex items-center gap-1 px-3 py-2 border-2 border-dashed border-slate-200 hover:border-[#8C52FF] hover:text-[#8C52FF] rounded-lg text-sm font-medium text-slate-400 transition-colors shrink-0"
          >
            <PlusIcon />
            Папка
          </button>
        )}

        {/* Current folder info & delete */}
        {selectedFolderId && folders.find(f => f.id === selectedFolderId) && (
          <div className="flex items-center gap-2 ml-2">
            <FolderIcon className="w-5 h-5" color={folders.find(f => f.id === selectedFolderId)?.color} />
            <span className="font-semibold text-slate-900">
              {folders.find(f => f.id === selectedFolderId)?.name}
            </span>
            <button
              onClick={() => {
                if (confirm('Удалить эту папку? Листы будут перемещены в корень.')) {
                  deleteFolderMutation.mutate(selectedFolderId)
                }
              }}
              className="p-1 text-slate-300 hover:text-red-500 transition-colors"
              title="Удалить папку"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Worksheets List */}
      <div className="glass-container p-4 md:p-6">
        {isLoadingWorksheets ? (
          <div className="flex justify-center py-10">
            <div className="relative">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-purple-200"></div>
              <div className="absolute inset-0 animate-spin rounded-full h-10 w-10 border-t-2 border-[#8C52FF]"></div>
            </div>
          </div>
        ) : worksheets?.length === 0 ? (
          <div className="text-center py-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-2xl mb-4">
              <DocumentIcon className="w-8 h-8 text-[#8C52FF]" />
            </div>
            <p className="text-slate-500">
              {selectedFolderId ? 'В этой папке пока нет листов' : 'Рабочих листов пока нет'}
            </p>
            <p className="text-sm text-slate-400 mt-1">Нажмите «Создать» в меню сверху</p>
          </div>
        ) : (
          <div className="space-y-3">
            {worksheets?.map((ws) => (
              <div key={ws.id} className="worksheet-card flex items-center gap-4">
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
                <div className="flex items-center gap-1">
                  {/* Rename */}
                  <button
                    onClick={() => setRenameModal({ id: ws.id, title: ws.title || getDisplayTitle(ws) })}
                    className="p-2 text-slate-300 hover:text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-all"
                    title="Переименовать"
                  >
                    <PencilIcon />
                  </button>
                  {/* Duplicate */}
                  <button
                    onClick={() => duplicateMutation.mutate(ws.id)}
                    disabled={duplicateMutation.isPending}
                    className="p-2 text-slate-300 hover:text-[#8C52FF] hover:bg-purple-50 rounded-lg transition-all disabled:opacity-50"
                    title="Создать копию"
                  >
                    <CopyIcon />
                  </button>
                  {/* Create based on this */}
                  <Link
                    to={`/?subject=${ws.subject}&grade=${ws.grade}&topic=${encodeURIComponent(ws.topic)}`}
                    className="p-2 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"
                    title="Создать на основе"
                  >
                    <PlusIcon />
                  </Link>
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

      <CreateFolderModal
        isOpen={showCreateFolder}
        onClose={() => setShowCreateFolder(false)}
        onCreate={(name, color) => createFolderMutation.mutate({ name, color })}
        isLoading={createFolderMutation.isPending}
      />
    </div>
  )
}

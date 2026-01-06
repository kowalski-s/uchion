import React from 'react'

interface EditModeToolbarProps {
  isEditMode: boolean
  isDirty: boolean
  isSaving: boolean
  error: string | null
  onEdit: () => void
  onSave: () => void
  onCancel: () => void
}

// Pencil icon
function PencilIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
    </svg>
  )
}

// Check icon
function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

// X icon
function XMarkIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

// Loading spinner
function LoadingSpinner({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )
}

export default function EditModeToolbar({
  isEditMode,
  isDirty,
  isSaving,
  error,
  onEdit,
  onSave,
  onCancel,
}: EditModeToolbarProps) {
  if (!isEditMode) {
    // View mode - show Edit button
    return (
      <button
        onClick={onEdit}
        className="group flex flex-col items-center gap-0.5 pt-4"
        title="Редактировать"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white shadow-sm transition-all group-hover:bg-indigo-50 group-active:scale-95">
          <PencilIcon className="h-5 w-5 text-indigo-600" />
        </div>
        <span className="text-[10px] font-medium text-gray-500 group-hover:text-indigo-600">Редактировать</span>
      </button>
    )
  }

  // Edit mode - show Save and Cancel buttons
  return (
    <div className="flex items-center gap-3">
      {/* Error message */}
      {error && (
        <span className="text-xs text-red-500 max-w-[150px] truncate" title={error}>
          {error}
        </span>
      )}

      {/* Dirty indicator */}
      {isDirty && !error && (
        <span className="text-xs text-amber-600 font-medium">
          Есть изменения
        </span>
      )}

      {/* Cancel button */}
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="group flex flex-col items-center gap-0.5 pt-4"
        title="Отменить"
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : 'group-hover:bg-gray-50 group-active:scale-95'}`}>
          <XMarkIcon className="h-5 w-5 text-gray-600" />
        </div>
        <span className="text-[10px] font-medium text-gray-500 group-hover:text-gray-700">Отменить</span>
      </button>

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={isSaving || !isDirty}
        className="group flex flex-col items-center gap-0.5 pt-4"
        title={isDirty ? "Сохранить" : "Нет изменений"}
      >
        <div className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition-all ${
          isSaving || !isDirty
            ? 'border-gray-200 bg-gray-100 cursor-not-allowed'
            : 'border-green-200 bg-green-500 group-hover:bg-green-600 group-active:scale-95'
        }`}>
          {isSaving ? (
            <LoadingSpinner className="h-5 w-5 text-gray-400" />
          ) : (
            <CheckIcon className={`h-5 w-5 ${isDirty ? 'text-white' : 'text-gray-400'}`} />
          )}
        </div>
        <span className={`text-[10px] font-medium ${isDirty ? 'text-green-600' : 'text-gray-400'}`}>
          {isSaving ? 'Сохранение...' : 'Сохранить'}
        </span>
      </button>
    </div>
  )
}

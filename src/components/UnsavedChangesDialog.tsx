import React, { useEffect, useCallback } from 'react'

interface UnsavedChangesDialogProps {
  isOpen: boolean
  isSaving: boolean
  onSave: () => void
  onDiscard: () => void
  onCancel: () => void
}

export default function UnsavedChangesDialog({
  isOpen,
  isSaving,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesDialogProps) {
  // Handle Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen && !isSaving) {
      onCancel()
    }
  }, [isOpen, isSaving, onCancel])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={isSaving ? undefined : onCancel}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Warning icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
            <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
          Несохраненные изменения
        </h3>

        {/* Message */}
        <p className="text-gray-600 text-center mb-6">
          У вас есть несохраненные изменения. Что вы хотите сделать?
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          {/* Save button */}
          <button
            onClick={onSave}
            disabled={isSaving}
            className="w-full py-3 px-4 bg-[#8C52FF] hover:bg-purple-700 disabled:bg-purple-300 text-white font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Сохранение...
              </>
            ) : (
              'Сохранить изменения'
            )}
          </button>

          {/* Discard button */}
          <button
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 font-medium rounded-xl transition-colors"
          >
            Не сохранять
          </button>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="w-full py-2 px-4 text-gray-500 hover:text-gray-700 disabled:text-gray-300 font-medium transition-colors"
          >
            Продолжить редактирование
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to add beforeunload warning when there are unsaved changes
 */
export function useBeforeUnload(isDirty: boolean, isEditMode: boolean) {
  useEffect(() => {
    if (!isDirty || !isEditMode) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти?'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isDirty, isEditMode])
}

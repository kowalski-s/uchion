import { useState, useCallback, useMemo } from 'react'
import type { Worksheet } from '../../shared/types'
import { updateWorksheet } from '../lib/dashboard-api'
import { useSessionStore } from '../store/session'

export interface UseWorksheetEditorOptions {
  /** Initial worksheet data */
  initialWorksheet: Worksheet | null
  /** Worksheet ID for DB-backed worksheets (SavedWorksheetPage) */
  worksheetId?: string
  /** Session ID for session-based worksheets (WorksheetPage) */
  sessionId?: string
  /** Callback after successful save */
  onSaveSuccess?: () => void
  /** Callback on save error */
  onSaveError?: (error: Error) => void
}

export interface UseWorksheetEditorReturn {
  /** Current worksheet (edited or original) */
  worksheet: Worksheet | null
  /** Worksheet being edited (null when not in edit mode) */
  editedWorksheet: Worksheet | null
  /** Whether edit mode is active */
  isEditMode: boolean
  /** Whether there are unsaved changes */
  isDirty: boolean
  /** Whether save is in progress */
  isSaving: boolean
  /** Error message if save failed */
  error: string | null
  /** Enter edit mode */
  enterEditMode: () => void
  /** Exit edit mode (without saving) */
  exitEditMode: () => void
  /** Update edited worksheet */
  updateEditedWorksheet: (updated: Worksheet) => void
  /** Save changes */
  saveChanges: () => Promise<boolean>
  /** Discard changes and exit edit mode */
  discardChanges: () => void
  /** Update specific assignment text */
  updateAssignment: (index: number, field: 'title' | 'text', value: string) => void
  /** Update test question */
  updateTestQuestion: (index: number, value: string) => void
  /** Update test option */
  updateTestOption: (questionIndex: number, optionIndex: number, value: string) => void
  /** Update assignment answer */
  updateAssignmentAnswer: (index: number, value: string) => void
  /** Update test answer */
  updateTestAnswer: (index: number, value: string) => void
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

function areWorksheetsEqual(a: Worksheet | null, b: Worksheet | null): boolean {
  if (!a || !b) return a === b
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useWorksheetEditor(options: UseWorksheetEditorOptions): UseWorksheetEditorReturn {
  const {
    initialWorksheet,
    worksheetId,
    sessionId,
    onSaveSuccess,
    onSaveError,
  } = options

  const sessionStore = useSessionStore()

  // Current worksheet state (after edits are saved)
  const [worksheet, setWorksheet] = useState<Worksheet | null>(initialWorksheet)

  // Worksheet being edited
  const [editedWorksheet, setEditedWorksheet] = useState<Worksheet | null>(null)

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)

  // Saving state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if there are unsaved changes
  const isDirty = useMemo(() => {
    if (!isEditMode || !editedWorksheet) return false
    return !areWorksheetsEqual(worksheet, editedWorksheet)
  }, [isEditMode, worksheet, editedWorksheet])

  // Enter edit mode
  const enterEditMode = useCallback(() => {
    if (!worksheet) return
    setEditedWorksheet(deepClone(worksheet))
    setIsEditMode(true)
    setError(null)
  }, [worksheet])

  // Exit edit mode without saving
  const exitEditMode = useCallback(() => {
    setIsEditMode(false)
    setEditedWorksheet(null)
    setError(null)
  }, [])

  // Discard changes and exit
  const discardChanges = useCallback(() => {
    exitEditMode()
  }, [exitEditMode])

  // Update the entire edited worksheet
  const updateEditedWorksheet = useCallback((updated: Worksheet) => {
    setEditedWorksheet(updated)
  }, [])

  // Update specific assignment
  const updateAssignment = useCallback((index: number, field: 'title' | 'text', value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAssignments = [...prev.assignments]
      newAssignments[index] = { ...newAssignments[index], [field]: value }
      return { ...prev, assignments: newAssignments }
    })
  }, [])

  // Update test question
  const updateTestQuestion = useCallback((index: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newTest = [...prev.test]
      newTest[index] = { ...newTest[index], question: value }
      return { ...prev, test: newTest }
    })
  }, [])

  // Update test option
  const updateTestOption = useCallback((questionIndex: number, optionIndex: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newTest = [...prev.test]
      const newOptions = [...newTest[questionIndex].options]
      newOptions[optionIndex] = value
      newTest[questionIndex] = { ...newTest[questionIndex], options: newOptions }
      return { ...prev, test: newTest }
    })
  }, [])

  // Update assignment answer
  const updateAssignmentAnswer = useCallback((index: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAnswers = [...prev.answers.assignments]
      newAnswers[index] = value
      return { ...prev, answers: { ...prev.answers, assignments: newAnswers } }
    })
  }, [])

  // Update test answer
  const updateTestAnswer = useCallback((index: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAnswers = [...prev.answers.test]
      newAnswers[index] = value
      return { ...prev, answers: { ...prev.answers, test: newAnswers } }
    })
  }, [])

  // Save changes
  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!editedWorksheet || !isDirty) {
      exitEditMode()
      return true
    }

    setIsSaving(true)
    setError(null)

    try {
      // For DB-backed worksheets (SavedWorksheetPage)
      if (worksheetId) {
        await updateWorksheet(worksheetId, {
          content: JSON.stringify(editedWorksheet),
        })
      }

      // For session-based worksheets (WorksheetPage)
      if (sessionId) {
        const session = sessionStore.getSession(sessionId)
        if (session) {
          sessionStore.saveSession(sessionId, {
            ...session,
            worksheet: editedWorksheet,
          })
        }

        // Also update localStorage
        try {
          localStorage.setItem('uchion_cached_worksheet', JSON.stringify(editedWorksheet))
        } catch (e) {
          console.error('Failed to update localStorage:', e)
        }

        // Also save to DB if worksheet has a valid UUID (authenticated user)
        // The worksheet.id from generation is the DB record ID for authenticated users
        if (editedWorksheet.id && isValidUUID(editedWorksheet.id)) {
          try {
            await updateWorksheet(editedWorksheet.id, {
              content: JSON.stringify(editedWorksheet),
            })
          } catch (e) {
            // Don't fail if DB update fails - localStorage is updated
            console.error('Failed to update worksheet in DB:', e)
          }
        }
      }

      // Update local state
      setWorksheet(editedWorksheet)
      setIsEditMode(false)
      setEditedWorksheet(null)

      onSaveSuccess?.()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось сохранить изменения'
      setError(errorMessage)
      onSaveError?.(err instanceof Error ? err : new Error(errorMessage))
      return false
    } finally {
      setIsSaving(false)
    }
  }, [editedWorksheet, isDirty, worksheetId, sessionId, sessionStore, exitEditMode, onSaveSuccess, onSaveError])

  return {
    worksheet: isEditMode ? editedWorksheet : worksheet,
    editedWorksheet,
    isEditMode,
    isDirty,
    isSaving,
    error,
    enterEditMode,
    exitEditMode,
    updateEditedWorksheet,
    saveChanges,
    discardChanges,
    updateAssignment,
    updateTestQuestion,
    updateTestOption,
    updateAssignmentAnswer,
    updateTestAnswer,
  }
}

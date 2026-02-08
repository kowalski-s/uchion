import { useState, useCallback, useMemo, useEffect } from 'react'
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
  /** Replace an assignment and its answer (for regeneration, works on base worksheet) */
  replaceAssignment: (index: number, assignment: { title: string; text: string }, answer: string) => void
  /** Replace a test question and its answer (for regeneration, works on base worksheet) */
  replaceTestQuestion: (index: number, question: { question: string; options: string[]; answer: string }, answer: string) => void
  /** Update matching task instruction */
  updateMatchingInstruction: (assignmentIndex: number, value: string) => void
  /** Update matching task left column item */
  updateMatchingLeftItem: (assignmentIndex: number, itemIndex: number, value: string) => void
  /** Update matching task right column item */
  updateMatchingRightItem: (assignmentIndex: number, itemIndex: number, value: string) => void
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

/** Update matching data embedded in assignment text as <!--MATCHING:{...}--> */
function updateMatchingField(
  text: string,
  updater: (data: Record<string, unknown>) => void,
): string {
  const match = text.match(/<!--MATCHING:(.*?)-->/)
  if (!match) return text
  try {
    const data = JSON.parse(match[1])
    updater(data)
    return `<!--MATCHING:${JSON.stringify(data)}-->`
  } catch {
    return text
  }
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

  // Sync when initialWorksheet arrives asynchronously (e.g. from React Query)
  // useState only captures the value on first render; this keeps it in sync
  useEffect(() => {
    if (initialWorksheet) {
      setWorksheet(initialWorksheet)
    }
  }, [initialWorksheet])

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

  // Update matching task instruction
  const updateMatchingInstruction = useCallback((assignmentIndex: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAssignments = [...prev.assignments]
      newAssignments[assignmentIndex] = {
        ...newAssignments[assignmentIndex],
        text: updateMatchingField(newAssignments[assignmentIndex].text, (d) => { d.instruction = value }),
      }
      return { ...prev, assignments: newAssignments }
    })
  }, [])

  // Update matching task left column item
  const updateMatchingLeftItem = useCallback((assignmentIndex: number, itemIndex: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAssignments = [...prev.assignments]
      newAssignments[assignmentIndex] = {
        ...newAssignments[assignmentIndex],
        text: updateMatchingField(newAssignments[assignmentIndex].text, (d) => {
          const col = d.leftColumn as string[]
          col[itemIndex] = value
        }),
      }
      return { ...prev, assignments: newAssignments }
    })
  }, [])

  // Update matching task right column item
  const updateMatchingRightItem = useCallback((assignmentIndex: number, itemIndex: number, value: string) => {
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAssignments = [...prev.assignments]
      newAssignments[assignmentIndex] = {
        ...newAssignments[assignmentIndex],
        text: updateMatchingField(newAssignments[assignmentIndex].text, (d) => {
          const col = d.rightColumn as string[]
          col[itemIndex] = value
        }),
      }
      return { ...prev, assignments: newAssignments }
    })
  }, [])

  // Replace assignment (regeneration - updates base worksheet directly)
  const replaceAssignment = useCallback((index: number, assignment: { title: string; text: string }, answer: string) => {
    setWorksheet(prev => {
      if (!prev) return prev
      const newAssignments = [...prev.assignments]
      newAssignments[index] = assignment
      const newAnswers = [...prev.answers.assignments]
      newAnswers[index] = answer
      // Clear stale server-generated PDF so client-side PDF is used on next download
      return { ...prev, pdfBase64: '', assignments: newAssignments, answers: { ...prev.answers, assignments: newAnswers } }
    })
    // Also update editedWorksheet if in edit mode
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newAssignments = [...prev.assignments]
      newAssignments[index] = assignment
      const newAnswers = [...prev.answers.assignments]
      newAnswers[index] = answer
      return { ...prev, pdfBase64: '', assignments: newAssignments, answers: { ...prev.answers, assignments: newAnswers } }
    })
  }, [])

  // Replace test question (regeneration - updates base worksheet directly)
  const replaceTestQuestion = useCallback((index: number, question: { question: string; options: string[]; answer: string }, answer: string) => {
    setWorksheet(prev => {
      if (!prev) return prev
      const newTest = [...prev.test]
      newTest[index] = question
      const newAnswers = [...prev.answers.test]
      newAnswers[index] = answer
      // Clear stale server-generated PDF so client-side PDF is used on next download
      return { ...prev, pdfBase64: '', test: newTest, answers: { ...prev.answers, test: newAnswers } }
    })
    // Also update editedWorksheet if in edit mode
    setEditedWorksheet(prev => {
      if (!prev) return prev
      const newTest = [...prev.test]
      newTest[index] = question
      const newAnswers = [...prev.answers.test]
      newAnswers[index] = answer
      return { ...prev, pdfBase64: '', test: newTest, answers: { ...prev.answers, test: newAnswers } }
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
      // Clear stale server-generated PDF so client-side PDF reflects edits
      const worksheetToSave = { ...editedWorksheet, pdfBase64: '' }

      // For DB-backed worksheets (SavedWorksheetPage)
      if (worksheetId) {
        await updateWorksheet(worksheetId, {
          content: JSON.stringify(worksheetToSave),
        })
      }

      // For session-based worksheets (WorksheetPage)
      if (sessionId) {
        const session = sessionStore.getSession(sessionId)
        if (session) {
          sessionStore.saveSession(sessionId, {
            ...session,
            worksheet: worksheetToSave,
          })
        }

        // Also update localStorage
        try {
          localStorage.setItem('uchion_cached_worksheet', JSON.stringify(worksheetToSave))
        } catch (e) {
          void e
        }

        // Also save to DB if worksheet has a valid UUID (authenticated user)
        // The worksheet.id from generation is the DB record ID for authenticated users
        if (worksheetToSave.id && isValidUUID(worksheetToSave.id)) {
          try {
            await updateWorksheet(worksheetToSave.id, {
              content: JSON.stringify(worksheetToSave),
            })
          } catch (e) {
            // Don't fail if DB update fails - localStorage is updated
            void e
          }
        }
      }

      // Update local state
      setWorksheet(worksheetToSave)
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
    replaceAssignment,
    replaceTestQuestion,
    updateMatchingInstruction,
    updateMatchingLeftItem,
    updateMatchingRightItem,
  }
}

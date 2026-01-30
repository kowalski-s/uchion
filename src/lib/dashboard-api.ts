import type { WorksheetListItem, Folder, FolderWithCount } from '../../shared/types'

// ==================== WORKSHEETS API ====================

export interface FetchWorksheetsOptions {
  folderId?: string | null
  limit?: number
}

export async function fetchWorksheets(options?: FetchWorksheetsOptions): Promise<WorksheetListItem[]> {
  const params = new URLSearchParams()
  if (options?.folderId !== undefined) {
    params.set('folderId', options.folderId === null ? 'null' : options.folderId)
  }
  if (options?.limit) {
    params.set('limit', String(options.limit))
  }

  const url = `/api/worksheets${params.toString() ? `?${params}` : ''}`  try {
    const res = await fetch(url, {
      credentials: 'include',
    })    if (!res.ok) {
      const errorText = await res.text()
      if (res.status === 401) {
        throw new Error('Unauthorized')
      }
      throw new Error(`Failed to fetch worksheets: ${res.status} ${errorText}`)
    }

    const data = await res.json()    return data.worksheets
  } catch (error) {
    throw error
  }
}

// Legacy function for backwards compatibility
export async function fetchRecentWorksheets(): Promise<WorksheetListItem[]> {
  return fetchWorksheets({ limit: 5 })
}

export async function fetchWorksheet(id: string): Promise<WorksheetListItem & { content: unknown }> {  const res = await fetch(`/api/worksheets/${id}`, {
    credentials: 'include',
  })  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unable to read error body')

    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к этому листу')
    if (res.status === 404) throw new Error('Лист не найден')
    if (res.status === 500) throw new Error('Ошибка сервера: ' + errorBody)
    throw new Error(`Ошибка загрузки: ${res.status}`)
  }

  const data = await res.json()  if (!data.worksheet) {
    throw new Error('Сервер вернул пустой ответ')
  }  return data.worksheet
}

export interface UpdateWorksheetData {
  title?: string
  folderId?: string | null
  content?: string
}

export async function updateWorksheet(id: string, data: UpdateWorksheetData): Promise<void> {  const res = await fetch(`/api/worksheets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unable to read error body')

    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа')
    if (res.status === 404) throw new Error('Лист не найден')
    if (res.status === 400) {
      try {
        const error = JSON.parse(errorBody)
        throw new Error(error.error || 'Ошибка валидации')
      } catch {
        throw new Error('Ошибка валидации')
      }
    }
    throw new Error('Не удалось обновить лист')
  }}

export async function deleteWorksheet(id: string): Promise<void> {
  const res = await fetch(`/api/worksheets/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 403) throw new Error('Access denied')
    if (res.status === 404) throw new Error('Worksheet not found')
    throw new Error('Failed to delete worksheet')
  }
}

export async function duplicateWorksheet(id: string): Promise<WorksheetListItem> {
  const res = await fetch(`/api/worksheets/${id}/duplicate`, {
    method: 'POST',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 403) throw new Error('Access denied')
    if (res.status === 404) throw new Error('Worksheet not found')
    throw new Error('Failed to duplicate worksheet')
  }

  const data = await res.json()
  return data.worksheet
}

// ==================== FOLDERS API ====================

export interface FetchFoldersResponse {
  folders: FolderWithCount[]
  rootWorksheetCount: number
}

export async function fetchFolders(): Promise<FetchFoldersResponse> {
  const res = await fetch('/api/folders', {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    throw new Error('Failed to fetch folders')
  }

  return res.json()
}

export interface CreateFolderData {
  name: string
  color?: string
  parentId?: string | null
}

export async function createFolder(data: CreateFolderData): Promise<FolderWithCount> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 400) {
      const error = await res.json()
      throw new Error(error.error || 'Validation error')
    }
    throw new Error('Failed to create folder')
  }

  const result = await res.json()
  return result.folder
}

export interface UpdateFolderData {
  name?: string
  color?: string
  parentId?: string | null
  sortOrder?: number
}

export async function updateFolder(id: string, data: UpdateFolderData): Promise<void> {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 403) throw new Error('Access denied')
    if (res.status === 404) throw new Error('Folder not found')
    if (res.status === 400) {
      const error = await res.json()
      throw new Error(error.error || 'Validation error')
    }
    throw new Error('Failed to update folder')
  }
}

export async function deleteFolder(id: string): Promise<void> {
  const res = await fetch(`/api/folders/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 403) throw new Error('Access denied')
    if (res.status === 404) throw new Error('Folder not found')
    throw new Error('Failed to delete folder')
  }
}

// ==================== HELPERS ====================

// Helper to format plan name
export function formatPlanName(plan: string): string {
  const names: Record<string, string> = {
    free: 'Бесплатный',
    basic: 'Базовый',
    premium: 'Премиум',
  }
  return names[plan] || plan
}

// Helper to format subject name
export function formatSubjectName(subject: string): string {
  const names: Record<string, string> = {
    math: 'Математика',
    russian: 'Русский язык',
  }
  return names[subject] || subject
}

// Helper to format difficulty
export function formatDifficulty(difficulty: string): string {
  const names: Record<string, string> = {
    easy: 'Лёгкий',
    medium: 'Средний',
    hard: 'Сложный',
  }
  return names[difficulty] || difficulty
}

// Default folder colors
export const FOLDER_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
] as const

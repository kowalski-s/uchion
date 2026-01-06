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

  const url = `/api/worksheets${params.toString() ? `?${params}` : ''}`
  console.log('[Frontend API] ==== fetchWorksheets START ====')
  console.log('[Frontend API] URL:', url)
  console.log('[Frontend API] Options:', options)

  try {
    const res = await fetch(url, {
      credentials: 'include',
    })

    console.log('[Frontend API] Response status:', res.status)
    console.log('[Frontend API] Response headers:', Object.fromEntries(res.headers.entries()))

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[Frontend API] Error response body:', errorText)
      if (res.status === 401) {
        throw new Error('Unauthorized')
      }
      throw new Error(`Failed to fetch worksheets: ${res.status} ${errorText}`)
    }

    const data = await res.json()
    console.log('[Frontend API] Worksheets received:', { count: data.worksheets?.length })
    console.log('[Frontend API] ==== fetchWorksheets END (success) ====')
    return data.worksheets
  } catch (error) {
    console.error('[Frontend API] ==== fetchWorksheets FAILED ====')
    console.error('[Frontend API] Error:', error)
    throw error
  }
}

// Legacy function for backwards compatibility
export async function fetchRecentWorksheets(): Promise<WorksheetListItem[]> {
  return fetchWorksheets({ limit: 5 })
}

export async function fetchWorksheet(id: string): Promise<WorksheetListItem & { content: unknown }> {
  console.log('[Dashboard API] fetchWorksheet called with id:', id)

  const res = await fetch(`/api/worksheets/${id}`, {
    credentials: 'include',
  })

  console.log('[Dashboard API] fetchWorksheet response status:', res.status)
  console.log('[Dashboard API] fetchWorksheet response headers:', Object.fromEntries(res.headers.entries()))

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unable to read error body')
    console.error('[Dashboard API] fetchWorksheet error:', res.status, errorBody)

    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 403) throw new Error('Нет доступа к этому листу')
    if (res.status === 404) throw new Error('Лист не найден')
    if (res.status === 500) throw new Error('Ошибка сервера: ' + errorBody)
    throw new Error(`Ошибка загрузки: ${res.status}`)
  }

  const data = await res.json()
  console.log('[Dashboard API] fetchWorksheet raw data:', JSON.stringify(data).substring(0, 500))

  if (!data.worksheet) {
    console.error('[Dashboard API] fetchWorksheet - worksheet is undefined in response')
    throw new Error('Сервер вернул пустой ответ')
  }

  console.log('[Dashboard API] fetchWorksheet success, content has assignments:', !!(data.worksheet?.content?.assignments))
  return data.worksheet
}

export interface UpdateWorksheetData {
  title?: string
  folderId?: string | null
  content?: string
}

export async function updateWorksheet(id: string, data: UpdateWorksheetData): Promise<void> {
  console.log('[Dashboard API] updateWorksheet called:', { id, data })

  const res = await fetch(`/api/worksheets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  console.log('[Dashboard API] updateWorksheet response status:', res.status)

  if (!res.ok) {
    const errorBody = await res.text().catch(() => 'Unable to read error body')
    console.error('[Dashboard API] updateWorksheet error:', res.status, errorBody)

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
  }

  console.log('[Dashboard API] updateWorksheet success')
}

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

import type {
  GeneratePresentationPayload,
  GeneratePresentationResponse,
  PresentationListItem,
  PresentationStructure,
  PresentationThemePreset,
} from '../../shared/types'

export async function generatePresentation(
  payload: GeneratePresentationPayload,
  onProgress?: (percent: number) => void
): Promise<GeneratePresentationResponse> {
  const res = await fetch('/api/presentations/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important: send auth cookies
    body: JSON.stringify(payload)
  })

  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    const jsonResponse = await res.json()
    return jsonResponse
  }

  if (!res.body) {
    return { status: 'error', code: 'SERVER_ERROR', message: 'No response body' }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: GeneratePresentationResponse | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6)
          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'progress') {
              onProgress?.(event.percent)
            } else if (event.type === 'result') {
              finalResult = { status: 'ok', data: event.data }
            } else if (event.type === 'error') {
              finalResult = { status: 'error', code: event.code, message: event.message }
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }
  } catch {
    return { status: 'error', code: 'SERVER_ERROR', message: 'Connection lost' }
  }

  if (!finalResult) {
    return { status: 'error', code: 'SERVER_ERROR', message: 'Incomplete response' }
  }

  return finalResult
}

// ==================== PRESENTATIONS CRUD ====================

export async function fetchPresentations(options?: { folderId?: string | null; limit?: number }): Promise<PresentationListItem[]> {
  const params = new URLSearchParams()
  if (options?.folderId !== undefined) {
    params.set('folderId', options.folderId === null ? 'null' : options.folderId)
  }
  if (options?.limit) {
    params.set('limit', String(options.limit))
  }

  const query = params.toString()
  const res = await fetch(`/api/presentations${query ? `?${query}` : ''}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    throw new Error('Failed to fetch presentations')
  }

  const data = await res.json()
  return data.presentations
}

export async function updatePresentation(id: string, data: { title?: string; folderId?: string | null }): Promise<void> {
  const res = await fetch(`/api/presentations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 404) throw new Error('Презентация не найдена')
    throw new Error('Не удалось обновить презентацию')
  }
}

export interface PresentationDetail {
  id: string
  title: string
  subject: 'math' | 'algebra' | 'geometry' | 'russian'
  grade: number
  topic: string
  themeType: 'preset' | 'custom'
  themePreset?: PresentationThemePreset | null
  themeCustom?: string | null
  slideCount: number
  structure: PresentationStructure
  pptxBase64: string
  createdAt: string
}

export async function fetchPresentation(id: string): Promise<PresentationDetail> {
  const res = await fetch(`/api/presentations/${id}`, {
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Требуется авторизация')
    if (res.status === 404) throw new Error('Презентация не найдена')
    throw new Error('Ошибка загрузки презентации')
  }

  const data = await res.json()
  return data.presentation
}

export async function deletePresentation(id: string): Promise<void> {
  const res = await fetch(`/api/presentations/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized')
    if (res.status === 404) throw new Error('Presentation not found')
    throw new Error('Failed to delete presentation')
  }
}

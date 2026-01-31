import type { GeneratePresentationPayload, GeneratePresentationResponse } from '../../shared/types'

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

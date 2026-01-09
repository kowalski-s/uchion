import type { GeneratePayload, GenerateResponse } from '../../shared/types'

export async function generateWorksheet(
  payload: GeneratePayload,
  onProgress?: (percent: number) => void
): Promise<GenerateResponse> {
  console.log('[API] generateWorksheet called with payload:', payload)

  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important: send auth cookies to save worksheet
    body: JSON.stringify(payload)
  })

  console.log('[API] Response status:', res.status, res.statusText)
  console.log('[API] Response headers:', Object.fromEntries(res.headers.entries()))

  const contentType = res.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    const jsonResponse = await res.json()
    console.log('[API] JSON Response:', jsonResponse)
    return jsonResponse
  }

  if (!res.body) {
    console.error('[API] No response body')
    return { status: 'error', code: 'SERVER_ERROR', message: 'No response body' }
  }

  console.log('[API] Starting SSE stream reading...')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: GenerateResponse | null = null

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('[API] SSE stream ended')
        break
      }

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6)
          try {
            const event = JSON.parse(jsonStr)
            console.log('[API] SSE Event:', event)

            if (event.type === 'progress') {
              onProgress?.(event.percent)
            } else if (event.type === 'result') {
              console.log('[API] Got result, worksheet topic:', event.data?.worksheet?.topic)
              console.log('[API] PDF base64 length:', event.data?.worksheet?.pdfBase64?.length || 0)
              finalResult = { status: 'ok', data: event.data }
            } else if (event.type === 'error') {
              console.error('[API] Server error:', event.code, event.message)
              finalResult = { status: 'error', code: event.code, message: event.message }
            }
          } catch (e) {
            console.error('[API] SSE Parse error:', e, 'Raw line:', line)
          }
        }
      }
    }
  } catch (e) {
    console.error('[API] Stream reading error:', e)
    return { status: 'error', code: 'SERVER_ERROR', message: 'Connection lost' }
  }

  if (!finalResult) {
    console.error('[API] No final result received')
    return { status: 'error', code: 'SERVER_ERROR', message: 'Incomplete response' }
  }

  console.log('[API] Final result status:', finalResult.status)
  return finalResult
}

// Dummy provider for dev/testing without DB
export const DummyProvider = {
  getWorksheetById: async (id: string): Promise<import('../../shared/types').Worksheet | null> => {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 500))
    
    // Check if we have it in localStorage (simple client-side persistence)
    if (typeof window !== 'undefined') {
       // Try to recover from recent sessions if stored in localStorage by Zustand
       // Note: Zustand persist middleware would be better, but we'll implement a simple fallback
    }

    // Return a mock worksheet if nothing else found (for Puppeteer testing)
    return {
      id,
      topic: 'Тестовая тема (Dummy)',
      subject: 'math',
      grade: '3 класс',
      assignments: [
        { title: 'Задание 1', text: 'Реши пример: 2 + 2 = ?' },
        { title: 'Задание 2', text: 'Сколько будет 5 * 5?' },
        { title: 'Задание 3', text: 'Напиши число сто.' },
      ],
      test: [
        { question: '2 + 2 = ?', options: ['3', '4', '5'], answer: '4' },
        { question: 'Столица Франции?', options: ['Лондон', 'Париж', 'Берлин'], answer: 'Париж' },
      ],
      answers: {
        assignments: ['4', '25', '100'],
        test: ['4', 'Париж']
      },
      pdfBase64: null
    }
  }
}

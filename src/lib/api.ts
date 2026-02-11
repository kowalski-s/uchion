import type { GeneratePayload, GenerateResponse } from '../../shared/types'

export async function generateWorksheet(
  payload: GeneratePayload,
  onProgress?: (percent: number) => void
): Promise<GenerateResponse> {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // Important: send auth cookies to save worksheet
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
  let finalResult: GenerateResponse | null = null

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

// Regenerate a single task in a worksheet
export async function regenerateTask(params: {
  taskIndex: number
  taskType: string
  isTest: boolean
  context: { subject: string; grade: number; topic: string; difficulty: string }
}): Promise<{
  status: 'ok' | 'error'
  code?: string
  message?: string
  data?: {
    testQuestion?: { question: string; options: string[]; answer: string }
    assignment?: { title: string; text: string }
    answer: string
  }
}> {
  const res = await fetch('/api/generate/regenerate-task', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(params),
  })

  return res.json()
}

// Rebuild PDF from edited worksheet content (server-side Puppeteer)
export async function rebuildPdf(worksheet: import('../../shared/types').Worksheet, templateId: string = 'standard'): Promise<string | null> {
  try {
    const res = await fetch('/api/generate/rebuild-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...worksheet, templateId }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.status === 'ok' ? data.pdfBase64 : null
  } catch {
    return null
  }
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

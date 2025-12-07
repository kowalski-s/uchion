// api/generate.ts
import { z } from 'zod'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAIProvider } from './_lib/ai-provider.js'
import { buildPdf } from './_lib/pdf.js'
import type { GeneratePayload, Worksheet } from '../shared/types'

const InputSchema = z.object({
  subject: z.enum(['математика', 'русский']),
  grade: z.number().int().min(1).max(4),
  topic: z.string().min(3).max(200),
})

type Input = z.infer<typeof InputSchema>

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      status: 'error',
      code: 'SERVER_ERROR',
      message: 'Метод не поддерживается.',
    })
  }

  const parse = InputSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Проверьте введённые данные.',
    })
  }

  const input: Input = parse.data

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  
  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const ai = getAIProvider()
    
    // Pass progress callback
    const worksheet = await ai.generateWorksheet(input as GeneratePayload, (percent) => {
      sendEvent({ type: 'progress', percent })
    })

    sendEvent({ type: 'progress', percent: 97 }) // PDF generation start
    
    let pdfBase64: string | null = null
    try {
      pdfBase64 = await buildPdf(worksheet, input as GeneratePayload)
    } catch (e) {
      sendEvent({ type: 'error', code: 'PDF_ERROR', message: 'Ошибка генерации PDF.' })
      res.end()
      return
    }

    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
    const finalWorksheet: Worksheet = {
      ...worksheet,
      id,
      grade: `${input.grade} класс`,
      pdfBase64: pdfBase64 ?? ''
    }

    sendEvent({ type: 'result', data: { worksheet: finalWorksheet } })
    res.end()

  } catch (err: any) {
    console.error('[API] Generate error:', err) // Log full error for Vercel logs

    const code =
      err?.message === 'AI_ERROR'
        ? 'AI_ERROR'
        : err?.message === 'PDF_ERROR'
        ? 'PDF_ERROR'
        : 'SERVER_ERROR'

    sendEvent({ type: 'error', code, message: 'Не удалось сгенерировать лист. Попробуйте ещё раз.' })
    res.end()
  }
}

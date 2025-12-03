import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import type { Worksheet, GenerateResponse } from '../shared/types'
import type { GeneratePayload } from '../shared/types'
import { getAIProvider } from './_lib/ai-provider'
import { generatePrompt } from './_lib/prompt'
import { buildPdf } from './_lib/pdf'

const InputSchema = z.object({
  subject: z.enum(['математика', 'русский']),
  grade: z.number().int().min(1).max(4),
  topic: z.string().min(3).max(200)
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ status: 'error', message: 'Метод не поддерживается', code: 'SERVER_ERROR' })
    return
  }

  try {
    let payload: GeneratePayload
    try {
      payload = InputSchema.parse(req.body) as GeneratePayload
    } catch {
      res.status(400).json({ status: 'error', message: 'Ошибка валидации входных данных', code: 'VALIDATION_ERROR' })
      return
    }
    const prompt = generatePrompt(payload)

    try {
      const provider = getAIProvider()
      const worksheet: Worksheet = await provider.generateWorksheet(payload)
      if (!worksheet || typeof worksheet.summary !== 'string' || !Array.isArray(worksheet.tasks) || !Array.isArray(worksheet.questions)) {
        res.status(500).json({ status: 'error', message: 'Некорректный ответ модели', code: 'AI_ERROR' })
        return
      }

      try {
        const pdfBase64 = await buildPdf(worksheet, payload)
        const ok: GenerateResponse = { status: 'ok', data: { ...worksheet, pdfBase64 } }
        res.status(200).json(ok)
        return
      } catch {
        res.status(500).json({ status: 'error', message: 'Ошибка генерации PDF', code: 'PDF_ERROR' })
        return
      }
    } catch {
      res.status(500).json({ status: 'error', message: 'Ошибка вызова ИИ', code: 'AI_ERROR' })
      return
    }
  } catch {
    res.status(500).json({ status: 'error', message: 'Внутренняя ошибка сервера', code: 'SERVER_ERROR' })
  }
}

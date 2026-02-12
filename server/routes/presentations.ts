import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { users, presentations, subscriptions } from '../../db/schema.js'
import { eq, sql, and, gt, desc, inArray } from 'drizzle-orm'
import { getAIProvider, getClaudeProvider } from '../../api/_lib/ai-provider.js'
import { generatePptx } from '../../api/_lib/presentations/generator.js'
import { generatePresentationPdf } from '../../api/_lib/presentations/pdf-generator.js'
import { sanitizePresentationStructure } from '../../api/_lib/presentations/sanitize.js'
import { withAuth } from '../middleware/auth.js'
import { checkGenerateRateLimit } from '../middleware/rate-limit.js'
import type { AuthenticatedRequest } from '../types.js'

const router = Router()

// SSE event types
type SSEEvent =
  | { type: 'progress'; percent: number }
  | { type: 'result'; data: { id: string; title: string; pptxBase64: string; pdfBase64: string; slideCount: number; structure: import('../../shared/types').PresentationStructure } }
  | { type: 'error'; code: string; message: string }

const InputSchema = z.object({
  subject: z.enum(['math', 'algebra', 'geometry', 'russian']),
  grade: z.number().int().min(1).max(11),
  topic: z.string().min(3).max(200),
  themeType: z.enum(['preset', 'custom']),
  themePreset: z.enum(['professional', 'educational', 'minimal', 'scientific', 'kids']).optional(),
  themeCustom: z.string().max(100).optional(),
  slideCount: z.union([z.literal(12), z.literal(18), z.literal(24)]).optional(),
})

// ==================== POST /api/presentations/generate ====================
router.post('/generate', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  // 1. Validate input
  const parse = InputSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: '\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0432\u0432\u0435\u0434\u0451\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435.',
    })
  }

  const input = parse.data

  // 2. Check themeType consistency
  if (input.themeType === 'preset' && !input.themePreset) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u0442\u0435\u043c\u0443 \u043f\u0440\u0435\u0437\u0435\u043d\u0442\u0430\u0446\u0438\u0438 (themePreset).',
    })
  }

  if (input.themeType === 'custom' && !input.themeCustom) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: '\u041e\u043f\u0438\u0448\u0438\u0442\u0435 \u0436\u0435\u043b\u0430\u0435\u043c\u044b\u0439 \u0441\u0442\u0438\u043b\u044c \u043f\u0440\u0435\u0437\u0435\u043d\u0442\u0430\u0446\u0438\u0438 (themeCustom).',
    })
  }

  const userId = req.user.id

  // 3. Atomically decrement generationsLeft (costs 1 generation)
  const [decremented] = await db
    .update(users)
    .set({
      generationsLeft: sql`${users.generationsLeft} - 1`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(users.id, userId),
      gt(users.generationsLeft, 0)
    ))
    .returning({ generationsLeft: users.generationsLeft })

  if (!decremented) {
    return res.status(403).json({
      status: 'error',
      code: 'LIMIT_EXCEEDED',
      message: '\u041b\u0438\u043c\u0438\u0442 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0439 \u0438\u0441\u0447\u0435\u0440\u043f\u0430\u043d. \u041f\u0440\u0438\u043e\u0431\u0440\u0435\u0442\u0438\u0442\u0435 \u0434\u043e\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0435 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438.',
    })
  }

  // 4. Rate limit: reuse checkGenerateRateLimit
  const rateLimitResult = await checkGenerateRateLimit(req, userId)
  if (!rateLimitResult.success) {
    // Rollback the atomic decrement
    await db
      .update(users)
      .set({
        generationsLeft: sql`${users.generationsLeft} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 ${Math.ceil(retryAfter / 60)} \u043c\u0438\u043d.`,
      retryAfter,
    })
  }

  // 5. Setup SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data: SSEEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    // Try Claude provider first (for presentations), fall back to OpenAI
    const claudeProvider = getClaudeProvider()
    const fallbackProvider = getAIProvider()

    // Determine if user has paid subscription (use better model)
    const [subscription] = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1)

    const isPaid = (subscription && subscription.plan !== 'free' && subscription.status === 'active') || req.user.role === 'admin'

    // 6. Call generatePresentation - prefer Claude for presentations
    const provider = claudeProvider || fallbackProvider
    console.log(`[API] Using ${claudeProvider ? 'Claude' : 'OpenAI'} provider for presentation generation`)

    const structure = await provider.generatePresentation({
      subject: input.subject,
      grade: input.grade,
      topic: input.topic,
      themeType: input.themeType,
      themePreset: input.themePreset,
      themeCustom: input.themeCustom,
      slideCount: input.slideCount as 12 | 18 | 24 | undefined,
      isPaid,
    }, (percent) => {
      sendEvent({ type: 'progress', percent })
    })

    sendEvent({ type: 'progress', percent: 80 })

    // 6b. Sanitize structure (filter empty slides, split practice/answers, etc.)
    const sanitizedStructure = sanitizePresentationStructure(structure)
    console.log(`[API] Sanitized: ${structure.slides.length} -> ${sanitizedStructure.slides.length} slides`)

    // 7. Call generatePptx(structure, themePreset || 'custom', themeCustom)
    let pptxBase64: string
    try {
      const effectiveTheme = input.themeType === 'preset' && input.themePreset
        ? input.themePreset
        : 'custom' as const
      pptxBase64 = await generatePptx(sanitizedStructure, effectiveTheme, input.themeCustom)
    } catch (e) {
      console.error('[API] PPTX generation error:', e)
      sendEvent({ type: 'error', code: 'PDF_ERROR', message: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0433\u0435\u043d\u0435\u0440\u0430\u0446\u0438\u0438 \u043f\u0440\u0435\u0437\u0435\u043d\u0442\u0430\u0446\u0438\u0438.' })
      res.end()
      return
    }

    sendEvent({ type: 'progress', percent: 90 })

    // 7b. Generate PDF from same structure
    let pdfBase64: string
    try {
      const effectiveThemePdf = input.themeType === 'preset' && input.themePreset
        ? input.themePreset
        : 'custom' as const
      pdfBase64 = await generatePresentationPdf(sanitizedStructure, effectiveThemePdf)
    } catch (e) {
      console.error('[API] PDF generation error:', e)
      // Non-fatal: PDF is optional, proceed with empty string
      pdfBase64 = ''
    }

    sendEvent({ type: 'progress', percent: 95 })

    // 8. Save to presentations table
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
    let dbId: string | null = null

    try {
      const [inserted] = await db.insert(presentations).values({
        userId,
        title: sanitizedStructure.title,
        subject: input.subject,
        grade: input.grade,
        topic: input.topic,
        themeType: input.themeType,
        themePreset: input.themeType === 'preset' ? input.themePreset : null,
        themeCustom: input.themeType === 'custom' ? input.themeCustom : null,
        slideCount: sanitizedStructure.slides.length,
        structure: JSON.stringify(sanitizedStructure),
        pptxBase64,
      }).returning({ id: presentations.id })

      dbId = inserted?.id || null

      // Enforce 15-presentation limit per user: auto-delete oldest
      const userPresentations = await db
        .select({ id: presentations.id })
        .from(presentations)
        .where(eq(presentations.userId, userId))
        .orderBy(desc(presentations.createdAt))

      if (userPresentations.length > 15) {
        const toDelete = userPresentations.slice(15).map(p => p.id)
        await db.delete(presentations).where(inArray(presentations.id, toDelete))
      }
    } catch (dbError) {
      console.error('[API] Failed to save presentation to database:', dbError)
    }

    // 9. Send result via SSE
    sendEvent({
      type: 'result',
      data: {
        id: dbId || id,
        title: sanitizedStructure.title,
        pptxBase64,
        pdfBase64,
        slideCount: sanitizedStructure.slides.length,
        structure: sanitizedStructure,
      },
    })
    res.end()

  } catch (err: unknown) {
    console.error('[API] Presentation generate error:', err)

    // 10. On error: rollback generationsLeft
    await db
      .update(users)
      .set({
        generationsLeft: sql`${users.generationsLeft} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .catch((rollbackErr) => console.error('[API] Failed to rollback generationsLeft:', rollbackErr))

    const code =
      err instanceof Error && err.message === 'AI_ERROR'
        ? 'AI_ERROR'
        : 'SERVER_ERROR'

    sendEvent({ type: 'error', code, message: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u043f\u0440\u0435\u0437\u0435\u043d\u0442\u0430\u0446\u0438\u044e. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437.' })
    res.end()
  }
}))

// ==================== GET /api/presentations ====================
// List user's presentations (without heavy pptxBase64 field)
router.get('/', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const items = await db
    .select({
      id: presentations.id,
      title: presentations.title,
      subject: presentations.subject,
      grade: presentations.grade,
      topic: presentations.topic,
      themeType: presentations.themeType,
      themePreset: presentations.themePreset,
      slideCount: presentations.slideCount,
      createdAt: presentations.createdAt,
    })
    .from(presentations)
    .where(eq(presentations.userId, req.user.id))
    .orderBy(desc(presentations.createdAt))
    .limit(15)

  res.json({
    presentations: items.map(p => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
    })),
  })
}))

// ==================== GET /api/presentations/:id ====================
// Single presentation with full data (structure + pptxBase64)
router.get('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const [presentation] = await db
    .select()
    .from(presentations)
    .where(and(
      eq(presentations.id, id),
      eq(presentations.userId, req.user.id)
    ))
    .limit(1)

  if (!presentation) {
    return res.status(404).json({ error: 'Презентация не найдена' })
  }

  let structure = null
  try {
    structure = JSON.parse(presentation.structure)
  } catch {
    // Invalid JSON in DB
  }

  res.json({
    presentation: {
      id: presentation.id,
      title: presentation.title,
      subject: presentation.subject,
      grade: presentation.grade,
      topic: presentation.topic,
      themeType: presentation.themeType,
      themePreset: presentation.themePreset,
      themeCustom: presentation.themeCustom,
      slideCount: presentation.slideCount,
      structure,
      pptxBase64: presentation.pptxBase64 || '',
      createdAt: presentation.createdAt.toISOString(),
    },
  })
}))

// ==================== DELETE /api/presentations/:id ====================
router.delete('/:id', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  const [existing] = await db
    .select({ id: presentations.id })
    .from(presentations)
    .where(and(
      eq(presentations.id, id),
      eq(presentations.userId, req.user.id)
    ))
    .limit(1)

  if (!existing) {
    return res.status(404).json({ error: 'Презентация не найдена' })
  }

  await db.delete(presentations).where(eq(presentations.id, id))

  res.json({ success: true })
}))

export default router

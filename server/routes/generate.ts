import { Router } from 'express'
import type { Response } from 'express'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { users, worksheets, subscriptions } from '../../db/schema.js'
import { eq, sql, and, gt } from 'drizzle-orm'
import { getAIProvider } from '../../api/_lib/ai-provider.js'
import { buildPdf } from '../../api/_lib/pdf.js'
import { withAuth } from '../middleware/auth.js'
import { checkGenerateRateLimit, checkDailyGenerationLimit, checkRateLimit } from '../middleware/rate-limit.js'
import { trackGeneration } from '../../api/_lib/alerts/generation-alerts.js'
import type { AuthenticatedRequest } from '../types.js'
import type { GeneratePayload, Worksheet } from '../../shared/types.js'

const router = Router()

type SSEEvent =
  | { type: 'progress'; percent: number }
  | { type: 'result'; data: { worksheet: Worksheet } }
  | { type: 'error'; code: string; message: string }

// Task type and format enums for validation
const TaskTypeIdSchema = z.enum([
  'single_choice',
  'multiple_choice',
  'open_question',
  'matching',
  'fill_blank',
])

const DifficultyLevelSchema = z.enum(['easy', 'medium', 'hard'])

const WorksheetFormatIdSchema = z.enum(['open_only', 'test_only', 'test_and_open'])

const InputSchema = z.object({
  subject: z.enum(['math', 'algebra', 'geometry', 'russian']),
  grade: z.number().int().min(1).max(11),
  topic: z.string().min(3).max(200),
  folderId: z.string().uuid().nullable().optional(),
  // New fields for extended generation
  taskTypes: z.array(TaskTypeIdSchema).min(1).max(5).optional(),
  difficulty: DifficultyLevelSchema.optional(),
  format: WorksheetFormatIdSchema.optional(),
  variantIndex: z.number().int().min(0).max(2).optional(),
})

type Input = z.infer<typeof InputSchema>

// Map subject to DB enum (algebra/geometry -> math until DB migration)
function mapSubjectForDB(subject: string): 'math' | 'russian' {
  if (subject === 'algebra' || subject === 'geometry' || subject === 'math') {
    return 'math'
  }
  return 'russian'
}

// ==================== POST /api/generate ====================
router.post('/', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const parse = InputSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Проверьте введённые данные.',
    })
  }

  const input: Input = parse.data
  const userId = req.user.id

  // Atomically decrement generationsLeft -- prevents race condition.
  // If generationsLeft <= 0, no rows are updated and the user is rejected.
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
      message: 'Лимит генераций исчерпан. Приобретите дополнительные генерации.',
    })
  }

  // Check daily limit for paid users (20 per day, resets at midnight MSK)
  const [subscription] = await db
    .select({ plan: subscriptions.plan, status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1)

  const isPaidUser = subscription && subscription.plan !== 'free' && subscription.status === 'active'

  if (isPaidUser) {
    const dailyCheck = await checkDailyGenerationLimit(userId, 20)
    if (!dailyCheck.allowed) {
      // Rollback the atomic decrement since we're rejecting the request
      await db
        .update(users)
        .set({
          generationsLeft: sql`${users.generationsLeft} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId))

      return res.status(429).json({
        status: 'error',
        code: 'DAILY_LIMIT_EXCEEDED',
        message: `Суточный лимит генераций исчерпан (${dailyCheck.limit}/день). Лимит обновится после полуночи по МСК.`,
      })
    }
  }

  // Rate limiting (per-hour burst protection)
  const rateLimitResult = await checkGenerateRateLimit(req, userId)
  if (!rateLimitResult.success) {
    // Rollback the atomic decrement since we're rejecting the request
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
      message: `Слишком много запросов. Попробуйте через ${Math.ceil(retryAfter / 60)} мин.`,
      retryAfter,
    })
  }

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const sendEvent = (data: SSEEvent) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    const ai = getAIProvider()

    // Pass progress callback with extended params
    const generateParams = {
      subject: input.subject,
      grade: input.grade,
      topic: input.topic,
      taskTypes: input.taskTypes,
      difficulty: input.difficulty,
      format: input.format,
      variantIndex: input.variantIndex,
    }
    const worksheet = await ai.generateWorksheet(generateParams as GeneratePayload, (percent) => {
      sendEvent({ type: 'progress', percent })
    })

    sendEvent({ type: 'progress', percent: 97 })

    let pdfBase64: string | null = null
    try {
      pdfBase64 = await buildPdf(worksheet, input as GeneratePayload)
    } catch (e) {
      console.error('[API] PDF generation error:', e)
      // Track failed generation for alerts
      trackGeneration(false).catch((err) => console.error('[Alerts] Failed to track generation:', err))
      sendEvent({ type: 'error', code: 'PDF_ERROR', message: 'Ошибка генерации PDF.' })
      res.end()
      return
    }

    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Date.now())
    let dbId: string | null = null

    try {
      const tempWorksheet = {
        ...worksheet,
        id,
        grade: `${input.grade} класс`,
        pdfBase64: pdfBase64 ?? ''
      }

      const [inserted] = await db.insert(worksheets).values({
        userId,
        folderId: input.folderId || null,
        subject: mapSubjectForDB(input.subject),
        grade: input.grade,
        topic: input.topic,
        difficulty: input.difficulty || 'medium',
        content: JSON.stringify(tempWorksheet),
      }).returning({ id: worksheets.id })

      dbId = inserted?.id || null
    } catch (dbError) {
      console.error('[API] Failed to save worksheet to database:', dbError)
    }

    const finalWorksheet: Worksheet = {
      ...worksheet,
      id: dbId || id,
      grade: `${input.grade} класс`,
      pdfBase64: pdfBase64 ?? ''
    }

    // Track successful generation for alerts
    trackGeneration(true).catch((e) => console.error('[Alerts] Failed to track generation:', e))

    sendEvent({ type: 'result', data: { worksheet: finalWorksheet } })
    res.end()

  } catch (err: unknown) {
    console.error('[API] Generate error:', err)

    // Rollback: generation failed, restore the decremented limit
    await db
      .update(users)
      .set({
        generationsLeft: sql`${users.generationsLeft} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .catch((rollbackErr) => console.error('[API] Failed to rollback generationsLeft:', rollbackErr))

    // Track failed generation for alerts
    trackGeneration(false).catch((e) => console.error('[Alerts] Failed to track generation:', e))

    const code =
      err instanceof Error && err.message === 'AI_ERROR'
        ? 'AI_ERROR'
        : err instanceof Error && err.message === 'PDF_ERROR'
        ? 'PDF_ERROR'
        : 'SERVER_ERROR'

    sendEvent({ type: 'error', code, message: 'Не удалось сгенерировать лист. Попробуйте ещё раз.' })
    res.end()
  }
}))

// ==================== POST /api/generate/regenerate-task ====================

const RegenerateInputSchema = z.object({
  taskIndex: z.number().int().min(0),
  taskType: TaskTypeIdSchema,
  isTest: z.boolean(),
  context: z.object({
    subject: z.enum(['math', 'algebra', 'geometry', 'russian']),
    grade: z.number().int().min(1).max(11),
    topic: z.string().min(3).max(200),
    difficulty: DifficultyLevelSchema,
  }),
})

router.post('/regenerate-task', withAuth(async (req: AuthenticatedRequest, res: Response) => {
  const parse = RegenerateInputSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Проверьте введённые данные.',
    })
  }

  const input = parse.data
  const userId = req.user.id

  // Rate limit: 10 per minute
  const rateLimitResult = await checkRateLimit(req, {
    maxRequests: 10,
    windowSeconds: 60,
    identifier: `regen:${userId}`,
  })
  if (!rateLimitResult.success) {
    return res.status(429).json({
      status: 'error',
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Слишком много запросов на перегенерацию. Попробуйте позже.',
    })
  }

  // Atomically decrement generationsLeft (costs 1 generation)
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
      message: 'Лимит генераций исчерпан. Приобретите дополнительные генерации.',
    })
  }

  try {
    const ai = getAIProvider()
    const result = await ai.regenerateTask({
      subject: input.context.subject,
      grade: input.context.grade,
      topic: input.context.topic,
      difficulty: input.context.difficulty,
      taskType: input.taskType,
      isTest: input.isTest,
    })

    return res.json({
      status: 'ok',
      data: result,
    })
  } catch (err) {
    console.error('[API] Regenerate task error:', err)

    // Rollback credit
    await db
      .update(users)
      .set({
        generationsLeft: sql`${users.generationsLeft} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .catch((rollbackErr) => console.error('[API] Failed to rollback generationsLeft:', rollbackErr))

    return res.status(500).json({
      status: 'error',
      code: 'AI_ERROR',
      message: 'Не удалось перегенерировать задание. Попробуйте ещё раз.',
    })
  }
}))

export default router

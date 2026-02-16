import { AsyncLocalStorage } from 'node:async_hooks'
import { db } from '../../db/index.js'
import { aiUsage } from '../../db/schema.js'

// ==================== AI Context (AsyncLocalStorage) ====================

export interface AIContext {
  sessionId: string
  userId: string
  subject?: string
  grade?: number
}

const storage = new AsyncLocalStorage<AIContext>()

export function withAIContext<T>(ctx: AIContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn)
}

export function getAIContext(): AIContext | undefined {
  return storage.getStore()
}

// ==================== Model Pricing (polza.ai, RUB per 1M tokens) ====================

interface ModelPrice {
  inputPer1M: number  // RUB
  outputPer1M: number // RUB
}

const MODEL_PRICING: Record<string, ModelPrice> = {
  'openai/gpt-4.1':                    { inputPer1M: 168.23, outputPer1M: 672.92 },
  'google/gemini-3-flash-preview':     { inputPer1M: 168.23, outputPer1M: 1009.38 },
  'google/gemini-2.5-flash-lite':      { inputPer1M: 8.41,   outputPer1M: 33.65 },
  'deepseek/deepseek-chat':            { inputPer1M: 21.87,  outputPer1M: 31.96 },
  'deepseek/deepseek-v3.2':            { inputPer1M: 21.87,  outputPer1M: 31.96 },
  'anthropic/claude-sonnet-4.5':       { inputPer1M: 252.35, outputPer1M: 1261.73 },
}

// Fallback pricing for unknown models
const DEFAULT_PRICING: ModelPrice = { inputPer1M: 100, outputPer1M: 400 }

export function calculateCostKopecks(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model] || DEFAULT_PRICING
  const inputCostRub = (promptTokens / 1_000_000) * pricing.inputPer1M
  const outputCostRub = (completionTokens / 1_000_000) * pricing.outputPer1M
  return Math.round((inputCostRub + outputCostRub) * 100) // convert to kopecks
}

// ==================== Track AI Usage (fire-and-forget) ====================

interface TrackAIUsageParams {
  sessionId: string
  userId: string
  callType: string
  model: string
  promptTokens: number
  completionTokens: number
  durationMs?: number
  subject?: string
  grade?: number
}

export function trackAIUsage(params: TrackAIUsageParams): void {
  const costKopecks = calculateCostKopecks(params.model, params.promptTokens, params.completionTokens)

  db.insert(aiUsage).values({
    sessionId: params.sessionId,
    userId: params.userId,
    callType: params.callType,
    model: params.model,
    promptTokens: params.promptTokens,
    completionTokens: params.completionTokens,
    costKopecks,
    durationMs: params.durationMs ?? null,
    subject: params.subject ?? null,
    grade: params.grade ?? null,
  }).catch((err) => {
    console.error('[ai-usage] Failed to track:', err)
  })
}

// Convenience: track using current AI context
export function trackFromContext(params: {
  callType: string
  model: string
  promptTokens: number
  completionTokens: number
  durationMs?: number
}): void {
  const ctx = getAIContext()
  if (!ctx) return

  trackAIUsage({
    sessionId: ctx.sessionId,
    userId: ctx.userId,
    subject: ctx.subject,
    grade: ctx.grade,
    ...params,
  })
}

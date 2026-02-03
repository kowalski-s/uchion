import type { Worksheet, Subject, TestQuestion, Assignment, PresentationStructure } from '../../shared/types.js'
import type { TaskTypeId, DifficultyLevel, WorksheetFormatId } from './generation/config/index.js'

import { getGenerationModel, getAgentsModel, getPresentationModel } from './ai-models.js'
import { DummyProvider } from './providers/dummy-provider.js'
import { OpenAIProvider } from './providers/openai-provider.js'
import { ClaudeProvider } from './providers/claude-provider.js'

// Re-export for convenience
export { getGenerationModel, getAgentsModel, getPresentationModel }

// =============================================================================
// Types
// =============================================================================

export type GenerateParams = {
  subject: Subject
  grade: number
  topic: string
  taskTypes?: TaskTypeId[]
  difficulty?: DifficultyLevel
  format?: WorksheetFormatId
  variantIndex?: number
  isPaid?: boolean
}

export type GeneratePresentationParams = {
  subject: Subject
  grade: number
  topic: string
  themeType: 'preset' | 'custom'
  themePreset?: string
  themeCustom?: string
  slideCount?: 12 | 18 | 24
  isPaid?: boolean
}

export type RegenerateTaskParams = {
  subject: Subject
  grade: number
  topic: string
  difficulty: DifficultyLevel
  taskType: TaskTypeId
  isTest: boolean
  isPaid?: boolean
}

export type RegenerateTaskResult = {
  testQuestion?: TestQuestion
  assignment?: Assignment
  answer: string
}

export interface AIProvider {
  generateWorksheet(params: GenerateParams, onProgress?: (percent: number) => void): Promise<Worksheet>
  regenerateTask(params: RegenerateTaskParams): Promise<RegenerateTaskResult>
  generatePresentation(params: GeneratePresentationParams, onProgress?: (percent: number) => void): Promise<PresentationStructure>
}

// Internal task structure from AI (exported for providers and validation)
export interface GeneratedTask {
  type: TaskTypeId
  question?: string
  options?: string[]
  correctIndex?: number
  correctIndices?: number[]
  explanation?: string
  correctAnswer?: string
  acceptableVariants?: string[]
  instruction?: string
  leftColumn?: string[]
  rightColumn?: string[]
  correctPairs?: [number, number][]
  textWithBlanks?: string
  blanks?: { position: number; correctAnswer: string; acceptableVariants?: string[] }[]
}

export interface GeneratedWorksheetJson {
  tasks: GeneratedTask[]
}

// =============================================================================
// Factory
// =============================================================================

export function getAIProvider(): AIProvider {
  const isProd =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production'

  const aiProvider = process.env.AI_PROVIDER
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL

  const useAI =
    (isProd && aiProvider === 'openai' && apiKey) ||
    (aiProvider === 'polza' && apiKey) ||
    (aiProvider === 'neuroapi' && apiKey)

  console.log('[УчиОн] getAIProvider:', {
    isProd,
    AI_PROVIDER: aiProvider,
    AI_BASE_URL: baseURL || 'default',
    useAI: !!useAI,
  })

  if (useAI) {
    return new OpenAIProvider(apiKey as string, baseURL)
  }

  return new DummyProvider()
}

/**
 * Get Claude provider for presentation generation.
 * Returns null if Claude is not configured (falls back to OpenAI in route handler).
 */
export function getClaudeProvider(): ClaudeProvider | null {
  const aiProvider = process.env.AI_PROVIDER
  const apiKey = process.env.OPENAI_API_KEY
  const baseURL = process.env.AI_BASE_URL
  const presentationModel = getPresentationModel()

  // Use Claude for presentations if:
  // 1. AI provider is configured (polza/neuroapi support Claude)
  // 2. Presentation model is Claude
  const useClaude =
    apiKey &&
    (aiProvider === 'polza' || aiProvider === 'neuroapi') &&
    presentationModel.includes('claude')

  console.log('[УчиОн] getClaudeProvider:', {
    AI_PROVIDER: aiProvider,
    presentationModel,
    useClaude: !!useClaude,
  })

  if (useClaude) {
    return new ClaudeProvider(apiKey, baseURL)
  }

  return null
}

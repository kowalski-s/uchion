/**
 * Model selection for generation and agents.
 * Separated to avoid circular dependencies between ai-provider and agent modules.
 */

export function getGenerationModel(isPaid: boolean): string {
  if (isPaid) {
    return process.env.AI_MODEL_PAID || 'openai/gpt-4.1'
  }
  return process.env.AI_MODEL_FREE || 'deepseek/deepseek-chat'
}

export function getAgentsModel(): string {
  return process.env.AI_MODEL_AGENTS || 'openai/gpt-4.1-mini'
}

/**
 * Model for presentation generation.
 * Claude excels at structured content and creative writing.
 */
export function getPresentationModel(): string {
  return process.env.AI_MODEL_PRESENTATION || 'anthropic/claude-sonnet-4.5'
}

/** Subjects that require mathematical reasoning */
const STEM_SUBJECTS = new Set(['math', 'algebra', 'geometry'])

export interface VerifierModelConfig {
  model: string
  reasoning: { effort: 'low' } | { enabled: false }
}

/**
 * Model config for answer-verifier and task-fixer agents.
 * - STEM subjects (math, algebra, geometry): Gemini 3 Flash with reasoning effort=low
 * - Humanities (russian, etc.): Gemini 2.5 Flash Lite with reasoning disabled
 */
export function getVerifierModelConfig(subject: string): VerifierModelConfig {
  if (STEM_SUBJECTS.has(subject)) {
    const model = process.env.AI_MODEL_VERIFIER_STEM || 'google/gemini-3-flash-preview'
    return { model, reasoning: { effort: 'low' } }
  }
  const model = process.env.AI_MODEL_VERIFIER_HUMANITIES || 'google/gemini-2.5-flash-lite'
  return { model, reasoning: { enabled: false } }
}

/**
 * Model selection for generation and agents.
 * Separated to avoid circular dependencies between ai-provider and agent modules.
 */

export function getGenerationModel(isPaid: boolean): string {
  if (isPaid) {
    return process.env.AI_MODEL_PAID || 'openai/gpt-4.1'
  }
  return process.env.AI_MODEL_FREE || 'deepseek/deepseek-v3.2'
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

export function isStemSubject(subject: string): boolean {
  return STEM_SUBJECTS.has(subject)
}

export interface VerifierModelConfig {
  model: string
  reasoning: { effort: 'low' | 'minimal' } | { enabled: false }
}

/**
 * Model config for answer-verifier agent.
 * - STEM subjects (math, algebra, geometry): Gemini 3 Flash with reasoning effort=low, budget=1024
 * - Humanities (russian, etc.): Gemini 2.5 Flash Lite with reasoning disabled
 *
 * Accepts optional grade for tiered verification:
 * - Grades 1-6 math: uses cheaper gpt-4.1-mini (no reasoning needed for arithmetic)
 * - Grades 7-11 STEM: uses Gemini with reasoning
 */
export function getVerifierModelConfig(subject: string, grade?: number): VerifierModelConfig {
  if (STEM_SUBJECTS.has(subject)) {
    // Tiered verification: simple grades use cheaper model
    if (grade && grade <= 6 && subject === 'math') {
      const model = process.env.AI_MODEL_AGENTS || 'openai/gpt-4.1-mini'
      return { model, reasoning: { enabled: false } }
    }
    const model = process.env.AI_MODEL_VERIFIER_STEM || 'google/gemini-3-flash-preview'
    return { model, reasoning: { effort: 'low' } }
  }
  // Russian 1-6: cheaper model
  if (grade && grade <= 6) {
    const model = process.env.AI_MODEL_AGENTS || 'openai/gpt-4.1-mini'
    return { model, reasoning: { enabled: false } }
  }
  const model = process.env.AI_MODEL_VERIFIER_HUMANITIES || 'google/gemini-2.5-flash-lite'
  return { model, reasoning: { enabled: false } }
}

/**
 * Model config for task-fixer agent (cheaper than verifier).
 * - STEM: same model as verifier but reasoning effort=minimal, budget=512
 * - Humanities: same as verifier (flash-lite, no reasoning)
 */
export function getFixerModelConfig(subject: string, grade?: number): VerifierModelConfig {
  if (STEM_SUBJECTS.has(subject)) {
    // Tiered: simple grades use cheaper model
    if (grade && grade <= 6 && subject === 'math') {
      const model = process.env.AI_MODEL_AGENTS || 'openai/gpt-4.1-mini'
      return { model, reasoning: { enabled: false } }
    }
    const model = process.env.AI_MODEL_VERIFIER_STEM || 'google/gemini-3-flash-preview'
    return { model, reasoning: { effort: 'minimal' } }
  }
  if (grade && grade <= 6) {
    const model = process.env.AI_MODEL_AGENTS || 'openai/gpt-4.1-mini'
    return { model, reasoning: { enabled: false } }
  }
  const model = process.env.AI_MODEL_VERIFIER_HUMANITIES || 'google/gemini-2.5-flash-lite'
  return { model, reasoning: { enabled: false } }
}

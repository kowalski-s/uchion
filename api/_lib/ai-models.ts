/**
 * Model selection for generation and agents.
 * Separated to avoid circular dependencies between ai-provider and agent modules.
 */

export function getGenerationModel(isPaid: boolean): string {
  if (isPaid) {
    return process.env.AI_MODEL_PAID || 'openai/gpt-5-mini'
  }
  return process.env.AI_MODEL_FREE || 'deepseek/deepseek-chat'
}

export function getAgentsModel(): string {
  return process.env.AI_MODEL_AGENTS || 'openai/gpt-4.1-mini'
}

import { mathPresentationConfig } from './math.js'
import { algebraPresentationConfig } from './algebra.js'
import { geometryPresentationConfig } from './geometry.js'
import { russianPresentationConfig } from './russian.js'

export { mathPresentationConfig } from './math.js'
export { algebraPresentationConfig } from './algebra.js'
export { geometryPresentationConfig } from './geometry.js'
export { russianPresentationConfig } from './russian.js'

export interface PresentationSubjectConfig {
  id: string
  name: string
  gradeRange: { from: number; to: number }
  systemPrompt: string
}

const configs: Record<string, PresentationSubjectConfig> = {
  math: mathPresentationConfig,
  algebra: algebraPresentationConfig,
  geometry: geometryPresentationConfig,
  russian: russianPresentationConfig,
}

export function getPresentationSubjectConfig(subject: string): PresentationSubjectConfig {
  const config = configs[subject]
  if (!config) {
    throw new Error(`Unknown presentation subject: ${subject}`)
  }
  return config
}

import type { PresentationTemplateConfig, TemplateRegistry } from './types.js'
import { minimalismTemplate } from './minimalism.js'
import { kidsTemplate } from './kids.js'

export { minimalismTemplate } from './minimalism.js'
export { kidsTemplate } from './kids.js'
export type { PresentationTemplateConfig, TemplateRegistry, SlideType } from './types.js'
export { validatePresentation, GeneratedPresentationSchema } from './types.js'

const templateRegistry: TemplateRegistry = {
  minimalism: minimalismTemplate,
  kids: kidsTemplate,
}

export function getTemplate(id: string): PresentationTemplateConfig {
  const template = templateRegistry[id]
  if (!template) {
    throw new Error(`Unknown presentation template: ${id}. Available: ${Object.keys(templateRegistry).join(', ')}`)
  }
  return template
}

export function getAllTemplates(): PresentationTemplateConfig[] {
  return Object.values(templateRegistry)
}

export function getTemplateIds(): string[] {
  return Object.keys(templateRegistry)
}

export function hasTemplate(id: string): boolean {
  return id in templateRegistry
}

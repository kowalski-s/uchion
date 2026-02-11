export {
  mathPresentationConfig,
  algebraPresentationConfig,
  geometryPresentationConfig,
  russianPresentationConfig,
  getPresentationSubjectConfig,
  type PresentationSubjectConfig,
} from './subjects/index.js'

export {
  minimalismTemplate,
  kidsTemplate,
  getTemplate,
  getAllTemplates,
  getTemplateIds,
  hasTemplate,
  validatePresentation,
  GeneratedPresentationSchema,
  type PresentationTemplateConfig,
  type TemplateRegistry,
  type SlideType,
} from './templates/index.js'

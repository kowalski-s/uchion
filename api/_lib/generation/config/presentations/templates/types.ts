import { z } from 'zod'

// =============================================================================
// Presentation Template System - Core Types
// =============================================================================
// Templates define: theme (colors/fonts) + slide layouts (data schemas for AI)
// The renderer (pptxgenjs) uses theme + data to produce PPTX files.

// -----------------------------------------------------------------------------
// Theme
// -----------------------------------------------------------------------------

export interface TemplateColors {
  primary: string    // main dark color (hex without #, e.g. "1A1A1A")
  secondary: string  // light background
  accent: string     // accent color (numbers, labels, borders)
  text: string       // body text
  lightGray: string  // dividers, light backgrounds
  white: string
  muted: string      // secondary text
}

export interface TemplateTypography {
  headingFont: string  // e.g. "Georgia"
  bodyFont: string     // e.g. "Arial"
}

export interface TemplateTheme {
  colors: TemplateColors
  typography: TemplateTypography
}

// -----------------------------------------------------------------------------
// Slide Layouts
// -----------------------------------------------------------------------------

export type SlideType =
  | 'title'
  | 'contents'
  | 'twoColumn'
  | 'formula'
  | 'grid'
  | 'stats'
  | 'practice'
  | 'end'

/** Schema + example + AI instruction for one slide type */
export interface SlideLayoutConfig<T = unknown> {
  type: SlideType
  name: string
  description: string
  schema: z.ZodSchema<T>
  example: T
  aiInstruction: string
}

// -----------------------------------------------------------------------------
// Template Config (main export per template file)
// -----------------------------------------------------------------------------

export interface TemplateMetadata {
  id: string
  name: string
  description: string
  version: string
  tags?: string[]
}

export interface PresentationTemplateConfig {
  metadata: TemplateMetadata
  theme: TemplateTheme
  /** All themes/color variants this template supports */
  themeVariants?: Record<string, TemplateColors>
  slides: SlideLayoutConfig[]
  /** Default slide order for a typical presentation */
  defaultSequence: SlideType[]
  constraints: {
    minSlides: number
    maxSlides: number
    requiredSlides: SlideType[]
  }
}

// -----------------------------------------------------------------------------
// AI Output (what AI returns)
// -----------------------------------------------------------------------------

export const GeneratedSlideSchema = z.object({
  type: z.string(),
  data: z.record(z.unknown()),
})

export const GeneratedPresentationSchema = z.object({
  meta: z.object({
    title: z.string(),
    author: z.string().optional(),
    subject: z.string(),
    class: z.string(),
    year: z.string().optional(),
  }),
  titleSlide: z.record(z.unknown()),
  contentsSlide: z.object({
    title: z.string(),
    items: z.array(z.object({
      num: z.string(),
      title: z.string(),
      description: z.string().optional(),
    })),
  }),
  contentSlides: z.array(GeneratedSlideSchema),
  endSlide: z.object({
    thankYou: z.string(),
    title: z.string(),
    contactInfo: z.string().optional(),
  }),
})

export type GeneratedPresentation = z.infer<typeof GeneratedPresentationSchema>

// -----------------------------------------------------------------------------
// Template Registry
// -----------------------------------------------------------------------------

export type TemplateRegistry = Record<string, PresentationTemplateConfig>

// -----------------------------------------------------------------------------
// Validation
// -----------------------------------------------------------------------------

export function validatePresentation(
  data: unknown,
  template: PresentationTemplateConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  const result = GeneratedPresentationSchema.safeParse(data)
  if (!result.success) {
    errors.push(`Invalid structure: ${result.error.message}`)
    return { valid: false, errors }
  }

  const presentation = result.data

  // Validate content slides against their type schemas
  const slideSchemaMap = new Map(template.slides.map(s => [s.type, s.schema]))

  for (const slide of presentation.contentSlides) {
    const schema = slideSchemaMap.get(slide.type as SlideType)
    if (!schema) {
      errors.push(`Unknown slide type: ${slide.type}`)
      continue
    }
    const slideResult = schema.safeParse(slide.data)
    if (!slideResult.success) {
      errors.push(`Slide "${slide.type}": ${slideResult.error.message}`)
    }
  }

  return { valid: errors.length === 0, errors }
}

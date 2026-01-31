import PptxGenJS from 'pptxgenjs'
import type { PresentationStructure, PresentationThemePreset } from '../../../shared/types.js'

// =============================================================================
// Theme Configuration
// =============================================================================

interface ThemeConfig {
  name: string
  backgroundColor: string
  titleColor: string
  textColor: string
  accentColor: string
  fontFace: string
  titleFontFace: string
}

const THEMES: Record<PresentationThemePreset, ThemeConfig> = {
  professional: {
    name: 'Professional',
    backgroundColor: 'FFFFFF',
    titleColor: '1B2A4A',
    textColor: '333333',
    accentColor: '2E5090',
    fontFace: 'Arial',
    titleFontFace: 'Arial',
  },
  educational: {
    name: 'Educational',
    backgroundColor: 'FFFBF5',
    titleColor: '8C52FF',
    textColor: '2D2D2D',
    accentColor: 'FF6B35',
    fontFace: 'Arial',
    titleFontFace: 'Arial',
  },
  minimal: {
    name: 'Minimal',
    backgroundColor: 'FFFFFF',
    titleColor: '1A1A1A',
    textColor: '444444',
    accentColor: '999999',
    fontFace: 'Arial',
    titleFontFace: 'Arial',
  },
  scientific: {
    name: 'Scientific',
    backgroundColor: 'F8FAF8',
    titleColor: '1A5632',
    textColor: '2C2C2C',
    accentColor: '2A7B4F',
    fontFace: 'Georgia',
    titleFontFace: 'Georgia',
  },
}

// =============================================================================
// Slide Generators
// =============================================================================

function addTitleSlide(
  pres: PptxGenJS,
  title: string,
  content: string[],
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()

  slide.background = { fill: theme.backgroundColor }

  // Accent line at top
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.08,
    fill: { color: theme.accentColor },
  })

  // Big centered title
  slide.addText(title, {
    x: 0.8,
    y: 1.5,
    w: 11.5,
    h: 1.8,
    fontSize: 36,
    fontFace: theme.titleFontFace,
    color: theme.titleColor,
    bold: true,
    align: 'center',
    valign: 'middle',
  })

  // Subtitle from content array
  const subtitle = content.length > 0 ? content.join('\n') : ''
  if (subtitle) {
    slide.addText(subtitle, {
      x: 1.5,
      y: 3.5,
      w: 10,
      h: 1.2,
      fontSize: 20,
      fontFace: theme.fontFace,
      color: theme.textColor,
      align: 'center',
      valign: 'top',
    })
  }

  // Footer
  slide.addText('\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u0432 \u0423\u0447\u0438\u041e\u043d', {
    x: 0.5,
    y: 7.0,
    w: 12,
    h: 0.3,
    fontSize: 9,
    fontFace: theme.fontFace,
    color: theme.accentColor,
    align: 'center',
    valign: 'bottom',
  })
}

function addContentSlide(
  pres: PptxGenJS,
  title: string,
  content: string[],
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()

  slide.background = { fill: theme.backgroundColor }

  // Top accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.06,
    fill: { color: theme.accentColor },
  })

  // Slide title
  slide.addText(title, {
    x: 0.6,
    y: 0.3,
    w: 11.8,
    h: 0.9,
    fontSize: 26,
    fontFace: theme.titleFontFace,
    color: theme.titleColor,
    bold: true,
    valign: 'middle',
  })

  // Separator line
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6,
    y: 1.25,
    w: 3,
    h: 0.03,
    fill: { color: theme.accentColor },
  })

  // Bullet points
  if (content.length > 0) {
    const bulletRows = content.map((text) => ({
      text,
      options: {
        fontSize: 18,
        fontFace: theme.fontFace,
        color: theme.textColor,
        bullet: { code: '2022', color: theme.accentColor },
        paraSpaceAfter: 8,
      },
    }))

    slide.addText(bulletRows, {
      x: 0.8,
      y: 1.5,
      w: 11.4,
      h: 4.8,
      valign: 'top',
      lineSpacingMultiple: 1.2,
    })
  }

  // Slide number
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: 11.5,
    y: 7.0,
    w: 1.2,
    h: 0.3,
    fontSize: 10,
    fontFace: theme.fontFace,
    color: theme.accentColor,
    align: 'right',
    valign: 'bottom',
  })

  // Footer
  slide.addText('\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u0432 \u0423\u0447\u0438\u041e\u043d', {
    x: 0.5,
    y: 7.0,
    w: 5,
    h: 0.3,
    fontSize: 9,
    fontFace: theme.fontFace,
    color: theme.accentColor,
    align: 'left',
    valign: 'bottom',
  })
}

function addConclusionSlide(
  pres: PptxGenJS,
  title: string,
  content: string[],
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()

  // Conclusion slide uses accent-tinted background
  slide.background = { fill: theme.backgroundColor }

  // Accent bar at top
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.12,
    fill: { color: theme.accentColor },
  })

  // Conclusion title
  slide.addText(title, {
    x: 0.8,
    y: 0.8,
    w: 11.5,
    h: 1.0,
    fontSize: 30,
    fontFace: theme.titleFontFace,
    color: theme.titleColor,
    bold: true,
    align: 'center',
    valign: 'middle',
  })

  // Summary text (centered bullet points)
  if (content.length > 0) {
    const summaryRows = content.map((text) => ({
      text,
      options: {
        fontSize: 18,
        fontFace: theme.fontFace,
        color: theme.textColor,
        bullet: { code: '2713', color: theme.accentColor },
        paraSpaceAfter: 10,
      },
    }))

    slide.addText(summaryRows, {
      x: 1.5,
      y: 2.2,
      w: 10,
      h: 4.0,
      valign: 'top',
      lineSpacingMultiple: 1.3,
    })
  }

  // Slide number
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: 11.5,
    y: 7.0,
    w: 1.2,
    h: 0.3,
    fontSize: 10,
    fontFace: theme.fontFace,
    color: theme.accentColor,
    align: 'right',
    valign: 'bottom',
  })

  // Footer
  slide.addText('\u0421\u043e\u0437\u0434\u0430\u043d\u043e \u0432 \u0423\u0447\u0438\u041e\u043d', {
    x: 0.5,
    y: 7.0,
    w: 5,
    h: 0.3,
    fontSize: 9,
    fontFace: theme.fontFace,
    color: theme.accentColor,
    align: 'left',
    valign: 'bottom',
  })
}

// =============================================================================
// Main Generator
// =============================================================================

export async function generatePptx(
  structure: PresentationStructure,
  themePreset: PresentationThemePreset | 'custom',
  customDescription?: string
): Promise<string> {
  const pres = new PptxGenJS()

  // Set layout to widescreen 16:9
  pres.layout = 'LAYOUT_WIDE'
  pres.title = structure.title
  pres.author = '\u0423\u0447\u0438\u041e\u043d'

  // For 'custom' theme, use 'professional' as base (AI already adapts content)
  const effectivePreset: PresentationThemePreset = themePreset === 'custom' ? 'professional' : themePreset
  const theme = THEMES[effectivePreset]

  const totalSlides = structure.slides.length
  let slideNumber = 0

  for (const slide of structure.slides) {
    slideNumber++

    switch (slide.type) {
      case 'title':
        addTitleSlide(pres, slide.title, slide.content, theme)
        break

      case 'content':
        addContentSlide(pres, slide.title, slide.content, slideNumber, totalSlides, theme)
        break

      case 'conclusion':
        addConclusionSlide(pres, slide.title, slide.content, slideNumber, totalSlides, theme)
        break

      default:
        // Fallback: treat unknown types as content slides
        addContentSlide(pres, slide.title, slide.content, slideNumber, totalSlides, theme)
        break
    }
  }

  // Export as base64 string
  const base64 = await pres.write({ outputType: 'base64' }) as string
  return base64
}

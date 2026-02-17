import PptxGenJS from 'pptxgenjs'
import type { PresentationStructure, PresentationSlide, PresentationThemePreset, ContentElement } from '../../../shared/types.js'
import { generateMinimalismPptx } from './minimalism-generator.js'
import { generateKidsPptx } from './kids-generator.js'
import { generateSchoolPptx } from './school-generator.js'
import { normalizeContent, getContentItemText } from './sanitize.js'

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
    titleFontFace: 'Georgia',
  },
  educational: {
    name: 'Educational',
    backgroundColor: 'FFFBF5',
    titleColor: '8C52FF',
    textColor: '2D2D2D',
    accentColor: 'FF6B35',
    fontFace: 'Arial',
    titleFontFace: 'Georgia',
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
  kids: {
    name: 'Kids',
    backgroundColor: 'FDF6E3',
    titleColor: '2D3436',
    textColor: '2D3436',
    accentColor: '4ECDC4',
    fontFace: 'Arial',
    titleFontFace: 'Arial',
  },
  school: {
    name: 'School',
    backgroundColor: 'F5F0EA',
    titleColor: '2D3436',
    textColor: '2D3436',
    accentColor: 'C9A96E',
    fontFace: 'Arial',
    titleFontFace: 'Georgia',
  },
}

// =============================================================================
// Helper: common slide header (accent bar + title + separator)
// =============================================================================

function addSlideHeader(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  title: string,
  theme: ThemeConfig
): void {
  slide.background = { fill: theme.backgroundColor }

  // Top accent bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: theme.accentColor },
  })

  // Vertical accent bar left of title
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 0.35, w: 0.04, h: 0.7,
    fill: { color: theme.accentColor },
  })

  // Slide title
  slide.addText(title, {
    x: 0.75, y: 0.3, w: 11.65, h: 0.9,
    fontSize: 30,
    fontFace: theme.titleFontFace,
    color: theme.titleColor,
    bold: true,
    valign: 'middle',
  })

  // Separator line
  slide.addShape(pres.ShapeType.rect, {
    x: 0.75, y: 1.25, w: 3, h: 0.03,
    fill: { color: theme.accentColor },
  })
}

function addSlideFooter(
  slide: PptxGenJS.Slide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: 11.5, y: 7.0, w: 1.2, h: 0.3,
    fontSize: 10, fontFace: theme.fontFace, color: theme.accentColor,
    align: 'right', valign: 'bottom',
  })
  slide.addText('Создано в УчиОн', {
    x: 0.5, y: 7.0, w: 5, h: 0.3,
    fontSize: 9, fontFace: theme.fontFace, color: theme.accentColor,
    align: 'left', valign: 'bottom',
  })
}

function addWatermark(slide: PptxGenJS.Slide, theme: ThemeConfig): void {
  slide.addText('УчиОн', {
    x: 8.2, y: 0.15, w: 1.8, h: 0.4,
    fontSize: 12,
    fontFace: theme.fontFace,
    color: 'C0C0C0',
    align: 'right',
  })
}

// =============================================================================
// Rich Content → PptxGenJS text rows
// =============================================================================

function contentElementsToRows(
  elements: ContentElement[],
  theme: ThemeConfig
): { text: string; options: Record<string, unknown> }[] {
  return elements.map(el => {
    // breakLine: true forces pptxgenjs to treat each element as a separate paragraph
    switch (el.el) {
      case 'heading':
        return {
          text: el.text,
          options: {
            fontSize: 22, fontFace: theme.titleFontFace, color: theme.titleColor,
            bold: true, align: 'center' as const, breakLine: true,
            paraSpaceBefore: 6, paraSpaceAfter: 8,
          },
        }
      case 'definition':
        return {
          text: `  ${el.text}`,
          options: {
            fontSize: 17, fontFace: theme.fontFace, color: theme.textColor,
            italic: true, paraSpaceAfter: 6, breakLine: true,
            bullet: { code: '258E', color: theme.accentColor },
          },
        }
      case 'text':
        return {
          text: el.text,
          options: {
            fontSize: 16, fontFace: theme.fontFace, color: theme.textColor,
            paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'highlight':
        return {
          text: el.text,
          options: {
            fontSize: 18, fontFace: theme.fontFace, color: theme.accentColor,
            bold: true, paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'task':
        return {
          text: `${el.number ?? ''}. ${el.text}`,
          options: {
            fontSize: 16, fontFace: theme.fontFace, color: theme.textColor,
            paraSpaceAfter: 8, breakLine: true,
          },
        }
      case 'formula':
        return {
          text: el.text,
          options: {
            fontSize: 20, fontFace: theme.titleFontFace, color: theme.accentColor,
            bold: true, align: 'center' as const, breakLine: true,
            paraSpaceBefore: 4, paraSpaceAfter: 8,
          },
        }
      case 'bullet':
      default:
        return {
          text: el.text,
          options: {
            fontSize: 17, fontFace: theme.fontFace, color: theme.textColor,
            bullet: { code: '2022', color: theme.accentColor },
            paraSpaceAfter: 8, breakLine: true,
          },
        }
    }
  })
}

// =============================================================================
// Slide Generators
// =============================================================================

function addTitleSlide(
  pres: PptxGenJS,
  title: string,
  content: (string | ContentElement)[],
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  slide.background = { fill: theme.backgroundColor }

  // Accent line at top
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.08,
    fill: { color: theme.accentColor },
  })

  // Decorative vertical accent bar on the left
  slide.addShape(pres.ShapeType.rect, {
    x: 0.8, y: 1.2, w: 0.05, h: 3.5,
    fill: { color: theme.accentColor },
  })

  // Big centered title
  slide.addText(title, {
    x: 0.8, y: 1.5, w: 11.5, h: 1.8,
    fontSize: 44, fontFace: theme.titleFontFace, color: theme.titleColor,
    bold: true, align: 'center', valign: 'middle',
  })

  // Subtitle
  const subtitle = content.length > 0 ? content.map(getContentItemText).join('\n') : ''
  if (subtitle) {
    slide.addText(subtitle, {
      x: 1.5, y: 3.5, w: 10, h: 1.2,
      fontSize: 22, fontFace: theme.fontFace, color: theme.textColor,
      align: 'center', valign: 'top',
    })
  }

  addWatermark(slide, theme)

  // Footer
  slide.addText('Создано в УчиОн', {
    x: 0.5, y: 7.0, w: 12, h: 0.3,
    fontSize: 9, fontFace: theme.fontFace, color: theme.accentColor,
    align: 'center', valign: 'bottom',
  })
}

function addContentSlide(
  pres: PptxGenJS,
  title: string,
  content: (string | ContentElement)[],
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, title, theme)

  if (content.length > 0) {
    // Light background card
    slide.addShape(pres.ShapeType.roundRect, {
      x: 0.5, y: 1.4, w: 12.3, h: 5.2,
      fill: { color: 'F8F9FA' },
      rectRadius: 0.08,
    })

    const rows = contentElementsToRows(normalizeContent(content), theme)
    slide.addText(rows, {
      x: 0.8, y: 1.5, w: 11.4, h: 4.8,
      valign: 'top', lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addTwoColumnSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  const leftItems = slideData.leftColumn || []
  const rightItems = slideData.rightColumn || []

  // Light background cards for each column
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.4, w: 5.7, h: 5.0,
    fill: { color: 'F8F9FA' },
    rectRadius: 0.08,
  })
  slide.addShape(pres.ShapeType.roundRect, {
    x: 6.5, y: 1.4, w: 5.7, h: 5.0,
    fill: { color: 'F8F9FA' },
    rectRadius: 0.08,
  })

  // Left column
  if (leftItems.length > 0) {
    const leftRows = leftItems.map((text) => ({
      text,
      options: {
        fontSize: 19, fontFace: theme.fontFace, color: theme.textColor,
        bullet: { code: '2022', color: theme.accentColor },
        paraSpaceAfter: 6,
      },
    }))
    slide.addText(leftRows, {
      x: 0.6, y: 1.5, w: 5.6, h: 4.8,
      valign: 'top', lineSpacingMultiple: 1.15,
    })
  }

  // Column divider
  slide.addShape(pres.ShapeType.rect, {
    x: 6.35, y: 1.5, w: 0.02, h: 4.5,
    fill: { color: theme.accentColor },
  })

  // Right column
  if (rightItems.length > 0) {
    const rightRows = rightItems.map((text) => ({
      text,
      options: {
        fontSize: 19, fontFace: theme.fontFace, color: theme.textColor,
        bullet: { code: '2022', color: theme.accentColor },
        paraSpaceAfter: 6,
      },
    }))
    slide.addText(rightRows, {
      x: 6.6, y: 1.5, w: 5.6, h: 4.8,
      valign: 'top', lineSpacingMultiple: 1.15,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addTableSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  const tableData = slideData.tableData
  if (tableData && tableData.headers.length > 0) {
    const headerRow: PptxGenJS.TableCell[] = tableData.headers.map(h => ({
      text: h,
      options: {
        bold: true, fontSize: 16, fontFace: theme.fontFace,
        color: 'FFFFFF', fill: { color: theme.accentColor },
        align: 'center' as const, valign: 'middle' as const,
      },
    }))

    const dataRows: PptxGenJS.TableCell[][] = tableData.rows.map((row, rowIdx) =>
      row.map(cell => ({
        text: cell,
        options: {
          fontSize: 14, fontFace: theme.fontFace, color: theme.textColor,
          fill: { color: rowIdx % 2 === 0 ? 'F8F8F8' : 'FFFFFF' },
          align: 'center' as const, valign: 'middle' as const,
        },
      }))
    )

    slide.addTable([headerRow, ...dataRows], {
      x: 0.6, y: 1.5, w: 11.8,
      border: { type: 'solid', pt: 0.5, color: 'CCCCCC' },
      rowH: 0.5,
      autoPage: false,
    })
  } else if (slideData.content.length > 0) {
    // Fallback to bullet content if no tableData
    const bulletRows = slideData.content.map((item) => ({
      text: getContentItemText(item),
      options: {
        fontSize: 16, fontFace: theme.fontFace, color: theme.textColor,
        bullet: { code: '2022', color: theme.accentColor },
        paraSpaceAfter: 6,
      },
    }))
    slide.addText(bulletRows, {
      x: 0.8, y: 1.5, w: 11.4, h: 4.8,
      valign: 'top', lineSpacingMultiple: 1.2,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addExampleSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  // Example slides use a light accent background box for the solution
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.5, w: 11.8, h: 5.0,
    fill: { color: 'F5F5FF' },
    rectRadius: 0.1,
  })

  // Accent top border on the card
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.5, w: 11.8, h: 0.05,
    fill: { color: theme.accentColor },
  })

  if (slideData.content.length > 0) {
    const elements = normalizeContent(slideData.content)
    const rows = contentElementsToRows(elements, theme)
    slide.addText(rows, {
      x: 1.0, y: 1.7, w: 11.0, h: 4.6,
      valign: 'top', lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addFormulaSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  // First content item as the big formula
  const formula = getContentItemText(slideData.content[0] || '')
  const explanation = slideData.content.slice(1)

  // Large centered formula
  slide.addText(formula, {
    x: 1.0, y: 1.8, w: 11.0, h: 1.5,
    fontSize: 40, fontFace: theme.titleFontFace, color: theme.accentColor,
    bold: true, align: 'center', valign: 'middle',
  })

  // Explanation below
  if (explanation.length > 0) {
    const rows = explanation.map((item) => ({
      text: getContentItemText(item),
      options: {
        fontSize: 18, fontFace: theme.fontFace, color: theme.textColor,
        paraSpaceAfter: 6,
      },
    }))
    slide.addText(rows, {
      x: 1.5, y: 3.5, w: 10, h: 3.0,
      valign: 'top', lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addDiagramSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  // Render each content item as a labeled box with connecting lines
  const items = slideData.content.map(getContentItemText)
  const boxCount = Math.min(items.length, 6)
  const cols = boxCount <= 3 ? boxCount : Math.ceil(boxCount / 2)
  const rows = boxCount <= 3 ? 1 : 2
  const boxW = 3.2
  const boxH = 1.2
  const startX = (13.33 - cols * boxW - (cols - 1) * 0.4) / 2
  const startY = rows === 1 ? 3.0 : 2.0

  for (let i = 0; i < boxCount; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = startX + col * (boxW + 0.4)
    const y = startY + row * (boxH + 0.8)

    // Box
    slide.addShape(pres.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH,
      fill: { color: i === 0 ? theme.accentColor : 'F0F0F0' },
      rectRadius: 0.1,
      line: { color: theme.accentColor, width: 1.5 },
    })

    // Text inside box
    slide.addText(items[i], {
      x, y, w: boxW, h: boxH,
      fontSize: 14, fontFace: theme.fontFace,
      color: i === 0 ? 'FFFFFF' : theme.textColor,
      align: 'center', valign: 'middle',
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addChartSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  const chartData = slideData.chartData
  if (chartData && chartData.labels.length > 0 && chartData.values.length > 0) {
    slide.addChart('bar' as any, [
      {
        name: slideData.title,
        labels: chartData.labels,
        values: chartData.values,
      },
    ], {
      x: 1.0, y: 1.5, w: 11.0, h: 5.0,
      showValue: true,
      chartColors: [theme.accentColor],
      valGridLine: { color: 'EEEEEE', size: 1 },
    })
  } else if (slideData.content.length > 0) {
    // Fallback to bullet content
    const bulletRows = slideData.content.map((item) => ({
      text: getContentItemText(item),
      options: {
        fontSize: 16, fontFace: theme.fontFace, color: theme.textColor,
        bullet: { code: '2022', color: theme.accentColor },
        paraSpaceAfter: 6,
      },
    }))
    slide.addText(bulletRows, {
      x: 0.8, y: 1.5, w: 11.4, h: 4.8,
      valign: 'top', lineSpacingMultiple: 1.2,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addPracticeSlide(
  pres: PptxGenJS,
  slideData: PresentationSlide,
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  addSlideHeader(pres, slide, slideData.title, theme)

  // Light background card
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.4, w: 12.3, h: 5.2,
    fill: { color: 'F8F9FA' },
    rectRadius: 0.08,
  })

  // Vertical accent bar on the left of the card
  slide.addShape(pres.ShapeType.rect, {
    x: 0.5, y: 1.4, w: 0.05, h: 5.2,
    fill: { color: theme.accentColor },
  })

  // Practice separator
  slide.addShape(pres.ShapeType.rect, {
    x: 0.6, y: 1.5, w: 11.8, h: 0.04,
    fill: { color: theme.accentColor },
  })

  if (slideData.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slideData.content), theme)
    slide.addText(rows, {
      x: 0.8, y: 1.8, w: 11.4, h: 4.5,
      valign: 'top', lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

function addConclusionSlide(
  pres: PptxGenJS,
  title: string,
  content: (string | ContentElement)[],
  slideNumber: number,
  totalSlides: number,
  theme: ThemeConfig
): void {
  const slide = pres.addSlide()
  slide.background = { fill: theme.backgroundColor }

  // Accent bar at top
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.12,
    fill: { color: theme.accentColor },
  })

  // Conclusion title
  slide.addText(title, {
    x: 0.8, y: 0.8, w: 11.5, h: 1.0,
    fontSize: 34, fontFace: theme.titleFontFace, color: theme.titleColor,
    bold: true, align: 'center', valign: 'middle',
  })

  // Summary text
  if (content.length > 0) {
    const elements = normalizeContent(content)
    // For conclusion, default bullets get checkmark instead
    const summaryRows = elements.map(el => {
      if (el.el === 'bullet') {
        return {
          text: el.text,
          options: {
            fontSize: 16, fontFace: theme.fontFace, color: theme.textColor,
            bullet: { code: '2713', color: theme.accentColor },
            paraSpaceAfter: 8,
          },
        }
      }
      // Other element types use standard rendering
      return contentElementsToRows([el], theme)[0]
    })
    slide.addText(summaryRows, {
      x: 1.5, y: 2.2, w: 10, h: 4.0,
      valign: 'top', lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(slide, theme)
  addSlideFooter(slide, slideNumber, totalSlides, theme)
}

// =============================================================================
// Main Generator
// =============================================================================

export async function generatePptx(
  structure: PresentationStructure,
  themePreset: PresentationThemePreset | 'custom',
  customDescription?: string
): Promise<string> {
  // Use dedicated renderers for themes with custom styles
  if (themePreset === 'minimal') {
    return generateMinimalismPptx(structure)
  }
  if (themePreset === 'kids') {
    return generateKidsPptx(structure)
  }
  if (themePreset === 'school') {
    return generateSchoolPptx(structure)
  }

  const pres = new PptxGenJS()

  // Set layout to widescreen 16:9
  pres.layout = 'LAYOUT_WIDE'
  pres.title = structure.title
  pres.author = 'УчиОн'

  // For 'custom' theme, use 'professional' as base (AI already adapts content)
  const effectivePreset: PresentationThemePreset = themePreset === 'custom' ? 'professional' : themePreset
  const theme = THEMES[effectivePreset]

  const totalSlides = structure.slides.length
  let slideNumber = 0

  for (const slideData of structure.slides) {
    slideNumber++

    switch (slideData.type) {
      case 'title':
        addTitleSlide(pres, slideData.title, slideData.content, theme)
        break

      case 'content':
        addContentSlide(pres, slideData.title, slideData.content, slideNumber, totalSlides, theme)
        break

      case 'twoColumn':
        addTwoColumnSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'table':
        addTableSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'example':
        addExampleSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'formula':
        addFormulaSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'diagram':
        addDiagramSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'chart':
        addChartSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'practice':
        addPracticeSlide(pres, slideData, slideNumber, totalSlides, theme)
        break

      case 'conclusion':
        addConclusionSlide(pres, slideData.title, slideData.content, slideNumber, totalSlides, theme)
        break

      default:
        // Fallback: treat unknown types as content slides
        addContentSlide(pres, slideData.title, slideData.content, slideNumber, totalSlides, theme)
        break
    }
  }

  // Export as base64 string
  const base64 = await pres.write({ outputType: 'base64' }) as string
  return base64
}

import PptxGenJS from 'pptxgenjs'
import type { PresentationStructure, PresentationSlide, ContentElement } from '../../../shared/types.js'
import { normalizeContent, getContentItemText } from './sanitize.js'

// =============================================================================
// School Theme -- Classic warm style with gold accents
// =============================================================================

const COLORS = {
  cream: 'F5F0EA',
  slate: '8B9DAE',
  sage: 'B8C4B8',
  gold: 'C9A96E',
  dustyRose: 'C4909A',
  navy: '5C6878',
  khaki: 'D4C5A9',
  text: '2D3436',
  white: 'FFFFFF',
  muted: '6B7B8D',
  lightGold: 'F0E8D8',
  lightSage: 'E5EBE5',
}

const HEADING_FONT = 'Georgia'
const BODY_FONT = 'Arial'

// Accent colors for cards (gold, dustyRose, navy, sage)
const CARD_ACCENTS = [COLORS.gold, COLORS.dustyRose, COLORS.navy, COLORS.sage]

// =============================================================================
// Decorative helpers
// =============================================================================

/** Add scattered school-supply decoration shapes (rotated rectangles, circles, ruler strips) */
function addSchoolDecorations(pres: PptxGenJS, slide: PptxGenJS.Slide, variant: 'cream' | 'slate' | 'sage'): void {
  const opacity = variant === 'slate' ? 0.08 : 0.1

  // Pencil-like rectangle (rotated by using a thin tall shape)
  slide.addShape(pres.ShapeType.roundRect, {
    x: -0.2, y: 0.5, w: 0.15, h: 1.2,
    fill: { color: COLORS.gold, transparency: (1 - opacity) * 100 },
    rectRadius: 0.05,
    rotate: 25,
  })

  // Ruler-like strip top-right
  slide.addShape(pres.ShapeType.roundRect, {
    x: 8.8, y: -0.1, w: 1.5, h: 0.12,
    fill: { color: COLORS.khaki, transparency: (1 - opacity * 1.2) * 100 },
    rectRadius: 0.03,
    rotate: -15,
  })

  // Small circle (eraser)
  slide.addShape(pres.ShapeType.ellipse, {
    x: 9.3, y: 6.5, w: 0.5, h: 0.5,
    fill: { color: COLORS.dustyRose, transparency: (1 - opacity) * 100 },
  })

  // Small rectangle (book)
  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.1, y: 6.2, w: 0.6, h: 0.45,
    fill: { color: COLORS.navy, transparency: (1 - opacity * 0.8) * 100 },
    rectRadius: 0.05,
    rotate: 10,
  })

  // Triangle-like shape (compass) using a small rotated rect
  slide.addShape(pres.ShapeType.roundRect, {
    x: 5.0, y: -0.15, w: 0.1, h: 0.6,
    fill: { color: COLORS.sage, transparency: (1 - opacity) * 100 },
    rectRadius: 0.03,
    rotate: 45,
  })
}

function addSchoolFooter(
  slide: PptxGenJS.Slide,
  slideNumber: number,
  totalSlides: number,
): void {
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: 8.5, y: 6.9, w: 1.5, h: 0.3,
    fontSize: 9, fontFace: BODY_FONT, color: COLORS.muted,
    align: 'right',
  })
}

function addWatermark(slide: PptxGenJS.Slide, bgType: 'cream' | 'slate' | 'sage'): void {
  const colorMap = { cream: 'C8C3BD', slate: 'A0AEC0', sage: 'CDD5CD' }
  slide.addText('УчиОн', {
    x: 8.5, y: 0.15, w: 1.5, h: 0.3,
    fontSize: 9,
    fontFace: BODY_FONT,
    color: colorMap[bgType],
    align: 'right',
  })
}

/** Add a gold double-border frame around a region */
function addGoldFrame(
  pres: PptxGenJS,
  slide: PptxGenJS.Slide,
  x: number, y: number, w: number, h: number,
): void {
  // Outer frame
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    fill: { color: COLORS.white },
    rectRadius: 0.15,
    line: { color: COLORS.gold, width: 2 },
    shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.06 },
  })
  // Inner frame (inset by 0.12)
  slide.addShape(pres.ShapeType.roundRect, {
    x: x + 0.12, y: y + 0.12, w: w - 0.24, h: h - 0.24,
    fill: { type: 'none' as any },
    rectRadius: 0.1,
    line: { color: COLORS.gold, width: 0.75, dashType: 'solid' },
  })
}

// =============================================================================
// Rich Content -> PptxGenJS text rows
// =============================================================================

function contentElementsToRows(
  elements: ContentElement[]
): { text: string; options: Record<string, unknown> }[] {
  return elements.map(el => {
    switch (el.el) {
      case 'heading':
        return {
          text: el.text,
          options: {
            fontSize: 18, fontFace: HEADING_FONT, color: COLORS.text,
            bold: true, align: 'center' as const, breakLine: true,
            paraSpaceBefore: 6, paraSpaceAfter: 6,
          },
        }
      case 'definition':
        return {
          text: `  ${el.text}`,
          options: {
            fontSize: 14, fontFace: BODY_FONT, color: COLORS.text,
            italic: true, paraSpaceAfter: 6, breakLine: true,
            bullet: { code: '258E', color: COLORS.gold },
          },
        }
      case 'text':
        return {
          text: el.text,
          options: {
            fontSize: 13, fontFace: BODY_FONT, color: COLORS.text,
            paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'highlight':
        return {
          text: el.text,
          options: {
            fontSize: 15, fontFace: BODY_FONT, color: COLORS.gold,
            bold: true, paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'task':
        return {
          text: `${el.number ?? ''}. ${el.text}`,
          options: {
            fontSize: 13, fontFace: BODY_FONT, color: COLORS.text,
            paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'formula':
        return {
          text: el.text,
          options: {
            fontSize: 17, fontFace: HEADING_FONT, color: COLORS.gold,
            bold: true, align: 'center' as const, breakLine: true,
            paraSpaceBefore: 4, paraSpaceAfter: 6,
          },
        }
      case 'bullet':
      default:
        return {
          text: el.text,
          options: {
            fontSize: 13, fontFace: BODY_FONT, color: COLORS.text,
            bullet: { code: '2022' as const, color: COLORS.gold },
            paraSpaceAfter: 6, breakLine: true,
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
  slide: PresentationSlide,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addSchoolDecorations(pres, s, 'cream')

  // Gold double-border frame card
  addGoldFrame(pres, s, 0.8, 0.9, 8.4, 5.0)

  // Category label
  const category = getContentItemText(slide.content[0] || '')
  if (category) {
    s.addText(category.toUpperCase(), {
      x: 1.3, y: 1.5, w: 7.4, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.gold,
      bold: true, charSpacing: 3,
    })
  }

  // Main title
  s.addText(slide.title, {
    x: 1.3, y: 2.1, w: 7.4, h: 1.8,
    fontSize: 34, fontFace: HEADING_FONT, color: COLORS.text,
    bold: true, lineSpacing: 40,
  })

  // Subtitle
  const subtitle = getContentItemText(slide.content[1] || '')
  if (subtitle) {
    s.addText(subtitle, {
      x: 1.3, y: 3.9, w: 7.4, h: 0.6,
      fontSize: 15, fontFace: BODY_FONT, color: COLORS.muted,
    })
  }

  // Footer
  const footer = getContentItemText(slide.content[2] || '')
  if (footer) {
    s.addText(footer, {
      x: 1.3, y: 4.9, w: 7.4, h: 0.4,
      fontSize: 10, fontFace: BODY_FONT, color: COLORS.muted,
    })
  }

  // Small decorative gold dot
  s.addShape(pres.ShapeType.ellipse, {
    x: 8.0, y: 5.0, w: 0.25, h: 0.25,
    fill: { color: COLORS.gold },
  })

  addWatermark(s, 'cream')
}

function addContentSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.slate }
  addSchoolDecorations(pres, s, 'slate')

  // Title bar area
  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.white, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.white,
    bold: true,
  })

  // Gold underline
  s.addShape(pres.ShapeType.rect, {
    x: 0.7, y: sectionNum ? 1.4 : 1.1, w: 2.5, h: 0.04,
    fill: { color: COLORS.gold },
  })

  // White content card
  const cardY = sectionNum ? 1.65 : 1.35
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: cardY, w: 9, h: 6.9 - cardY - 0.5,
    fill: { color: COLORS.white },
    rectRadius: 0.12,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.06 },
  })

  // Content
  if (slide.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slide.content))
    s.addText(rows, {
      x: 0.9, y: cardY + 0.3, w: 8.2, h: 6.9 - cardY - 1.0,
      valign: 'top' as const, lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(s, 'slate')
  addSchoolFooter(s, slideNum, total)
}

function addTwoColumnSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.slate }
  addSchoolDecorations(pres, s, 'slate')

  // Left panel (darker shade)
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.3, y: 0.3, w: 4.2, h: 6.9,
    fill: { color: COLORS.navy },
    rectRadius: 0.15,
  })

  // Gold accent stripe on left panel
  s.addShape(pres.ShapeType.rect, {
    x: 0.3, y: 0.3, w: 0.06, h: 6.9,
    fill: { color: COLORS.gold },
  })

  // Section number
  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.6, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.gold,
      bold: true,
    })
  }

  // Title on left panel
  s.addText(slide.title, {
    x: 0.7, y: 1.3, w: 3.5, h: 2.2,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.white,
    bold: true, lineSpacing: 30,
  })

  // Right side: content cards on white
  const leftItems = slide.leftColumn || []
  const rightItems = slide.rightColumn || []
  const allItems = [...leftItems, ...rightItems]

  if (allItems.length > 0) {
    let cardY = 0.5
    allItems.slice(0, 5).forEach((item, i) => {
      const accentColor = CARD_ACCENTS[i % CARD_ACCENTS.length]
      // White card
      s.addShape(pres.ShapeType.roundRect, {
        x: 4.8, y: cardY, w: 5, h: 0.95,
        fill: { color: COLORS.white },
        rectRadius: 0.08,
        shadow: { type: 'outer', blur: 3, offset: 1, color: '000000', opacity: 0.04 },
      })
      // Colored left accent
      s.addShape(pres.ShapeType.roundRect, {
        x: 4.8, y: cardY, w: 0.06, h: 0.95,
        fill: { color: accentColor },
        rectRadius: 0.03,
      })
      s.addText(item, {
        x: 5.05, y: cardY + 0.12, w: 4.55, h: 0.7,
        fontSize: 13, fontFace: BODY_FONT, color: COLORS.text,
        valign: 'middle' as const,
      })
      cardY += 1.1
    })
  } else if (slide.content.length > 0) {
    const rows = slide.content.map((item) => ({
      text: getContentItemText(item),
      options: {
        fontSize: 13, fontFace: BODY_FONT, color: COLORS.white,
        bullet: { code: '2022' as const, color: COLORS.gold },
        paraSpaceAfter: 6,
      },
    }))
    s.addText(rows, {
      x: 4.8, y: 0.5, w: 5, h: 6,
      valign: 'top' as const, lineSpacingMultiple: 1.2,
    })
  }

  addWatermark(s, 'slate')
  addSchoolFooter(s, slideNum, total)
}

function addTableSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.slate }
  addSchoolDecorations(pres, s, 'slate')

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.white, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.white, bold: true,
  })

  const td = slide.tableData
  if (td && td.headers.length > 0) {
    const headerRow: PptxGenJS.TableCell[] = td.headers.map(h => ({
      text: h,
      options: {
        bold: true, fontSize: 13, fontFace: BODY_FONT,
        color: COLORS.white, fill: { color: COLORS.navy },
        align: 'center' as const, valign: 'middle' as const,
      },
    }))

    const dataRows: PptxGenJS.TableCell[][] = td.rows.map((row, ri) =>
      row.map(cell => ({
        text: cell,
        options: {
          fontSize: 12, fontFace: BODY_FONT, color: COLORS.text,
          fill: { color: ri % 2 === 0 ? COLORS.lightGold : COLORS.white },
          align: 'center' as const, valign: 'middle' as const,
        },
      }))
    )

    s.addTable([headerRow, ...dataRows], {
      x: 0.7, y: sectionNum ? 1.5 : 1.2, w: 8.6,
      border: { type: 'solid', pt: 0.5, color: COLORS.khaki },
      rowH: 0.55,
      autoPage: false,
    })
  } else {
    // Fallback to content slide
    addContentSlide(pres, slide, slideNum, total, sectionNum)
    return
  }

  addWatermark(s, 'slate')
  addSchoolFooter(s, slideNum, total)
}

function addFormulaSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.sage }
  addSchoolDecorations(pres, s, 'sage')

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.text, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.text, bold: true,
  })

  // Big formula card with gold border
  const formula = getContentItemText(slide.content[0] || '')
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.7, y: 1.7, w: 8.6, h: 2.0,
    fill: { color: COLORS.white },
    rectRadius: 0.12,
    line: { color: COLORS.gold, width: 1.5 },
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.05 },
  })

  // Gold top accent bar on card
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.7, y: 1.7, w: 8.6, h: 0.06,
    fill: { color: COLORS.gold },
    rectRadius: 0.03,
  })

  s.addText(formula, {
    x: 0.7, y: 1.9, w: 8.6, h: 1.2,
    fontSize: 36, fontFace: HEADING_FONT, color: COLORS.gold,
    bold: true, align: 'center',
  })

  // Description
  const description = getContentItemText(slide.content[1] || '')
  if (description) {
    s.addText(description, {
      x: 0.7, y: 3.1, w: 8.6, h: 0.5,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.muted,
      align: 'center',
    })
  }

  // Legend items
  const legendItems = slide.content.slice(2).map(getContentItemText)
  if (legendItems.length > 0) {
    const itemW = 8.6 / Math.max(legendItems.length, 1)
    let fx = 0.7
    legendItems.forEach((item, i) => {
      const color = CARD_ACCENTS[i % CARD_ACCENTS.length]
      s.addShape(pres.ShapeType.roundRect, {
        x: fx + 0.1, y: 4.1, w: itemW - 0.2, h: 0.85,
        fill: { color },
        rectRadius: 0.08,
      })
      s.addText(item, {
        x: fx + 0.25, y: 4.2, w: itemW - 0.5, h: 0.65,
        fontSize: 11, fontFace: BODY_FONT, color: COLORS.white,
        valign: 'middle' as const,
      })
      fx += itemW
    })
  }

  addWatermark(s, 'sage')
  addSchoolFooter(s, slideNum, total)
}

function addExampleSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.sage }
  addSchoolDecorations(pres, s, 'sage')

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.text, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.text, bold: true,
  })

  // White card with gold top accent
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.5, w: 9, h: 5.1,
    fill: { color: COLORS.white },
    rectRadius: 0.12,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.05 },
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.5, w: 9, h: 0.06,
    fill: { color: COLORS.gold },
    rectRadius: 0.03,
  })

  if (slide.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slide.content))
    s.addText(rows, {
      x: 0.9, y: 1.8, w: 8.2, h: 4.5,
      valign: 'top' as const, lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(s, 'sage')
  addSchoolFooter(s, slideNum, total)
}

function addPracticeSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.sage }
  addSchoolDecorations(pres, s, 'sage')

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.text, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.text, bold: true,
  })

  // Gold underline
  s.addShape(pres.ShapeType.rect, {
    x: 0.7, y: sectionNum ? 1.4 : 1.1, w: 8.6, h: 0.04,
    fill: { color: COLORS.gold },
  })

  // White card with dusty rose left accent
  const cardY = sectionNum ? 1.6 : 1.3
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: cardY, w: 9, h: 6.7 - cardY - 0.5,
    fill: { color: COLORS.white },
    rectRadius: 0.12,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.05 },
  })

  // Dusty rose left accent strip
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: cardY, w: 0.07, h: 6.7 - cardY - 0.5,
    fill: { color: COLORS.dustyRose },
    rectRadius: 0.03,
  })

  if (slide.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slide.content))
    s.addText(rows, {
      x: 0.9, y: cardY + 0.3, w: 8.2, h: 6.7 - cardY - 1.1,
      valign: 'top' as const, lineSpacingMultiple: 1.1,
    })
  }

  addWatermark(s, 'sage')
  addSchoolFooter(s, slideNum, total)
}

function addDiagramSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.sage }
  addSchoolDecorations(pres, s, 'sage')

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.text, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.text, bold: true,
  })

  // Diagram items as colored rounded boxes
  const items = slide.content.slice(0, 6).map(getContentItemText)
  const cols = items.length <= 3 ? items.length : Math.ceil(items.length / 2)
  const rowCount = items.length <= 3 ? 1 : 2
  const boxW = 2.8
  const boxH = 1.0
  const gap = 0.4
  const startX = (10 - cols * boxW - (cols - 1) * gap) / 2
  const startY = rowCount === 1 ? 3.0 : 2.0

  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = startX + col * (boxW + gap)
    const y = startY + row * (boxH + 0.8)
    const bgColor = CARD_ACCENTS[i % CARD_ACCENTS.length]

    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH,
      fill: { color: bgColor },
      rectRadius: 0.1,
    })
    s.addText(items[i], {
      x: x + 0.15, y, w: boxW - 0.3, h: boxH,
      fontSize: 13, fontFace: BODY_FONT, color: COLORS.white,
      align: 'center', valign: 'middle' as const,
      bold: true,
    })
  }

  addWatermark(s, 'sage')
  addSchoolFooter(s, slideNum, total)
}

function addChartSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.slate }
  addSchoolDecorations(pres, s, 'slate')

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.3, w: 1, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.white, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.7 : 0.4, w: 8.6, h: 0.6,
    fontSize: 24, fontFace: HEADING_FONT, color: COLORS.white, bold: true,
  })

  const cd = slide.chartData
  if (cd && cd.labels.length > 0 && cd.values.length > 0) {
    s.addChart('bar' as any, [{
      name: slide.title,
      labels: cd.labels,
      values: cd.values,
    }], {
      x: 0.7, y: 1.5, w: 8.6, h: 5.0,
      showValue: true,
      chartColors: [COLORS.gold, COLORS.dustyRose, COLORS.navy, COLORS.sage],
      valGridLine: { color: 'C5C5C5', size: 1 },
    })
  } else {
    addContentSlide(pres, slide, slideNum, total, sectionNum)
    return
  }

  addWatermark(s, 'slate')
  addSchoolFooter(s, slideNum, total)
}

function addEndSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addSchoolDecorations(pres, s, 'cream')

  // Gold double-border frame
  addGoldFrame(pres, s, 1.0, 0.8, 8.0, 5.8)

  // Thank-you label
  s.addText('СПАСИБО ЗА ВНИМАНИЕ!', {
    x: 1.5, y: 1.5, w: 7, h: 0.5,
    fontSize: 12, fontFace: BODY_FONT, color: COLORS.gold,
    bold: true, charSpacing: 4, align: 'center',
  })

  // Big title
  s.addText(slide.title || 'Вопросы?', {
    x: 1.5, y: 2.3, w: 7, h: 1.4,
    fontSize: 40, fontFace: HEADING_FONT, color: COLORS.text,
    bold: true, align: 'center',
  })

  // Contact info
  if (slide.content.length > 0) {
    s.addText(slide.content.map(getContentItemText).join('\n'), {
      x: 2, y: 4.0, w: 6, h: 1.2,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.muted,
      align: 'center',
    })
  }

  // Small gold accent dot
  s.addShape(pres.ShapeType.ellipse, {
    x: 4.75, y: 5.6, w: 0.5, h: 0.5,
    fill: { color: COLORS.gold },
  })

  addWatermark(s, 'cream')
}

// =============================================================================
// Section number tracker
// =============================================================================

function getSectionNumber(slides: PresentationSlide[], currentIndex: number): string | undefined {
  let sectionCount = 0
  for (let i = 0; i < slides.length; i++) {
    const type = slides[i].type
    if (type !== 'title' && type !== 'conclusion') {
      sectionCount++
      if (i === currentIndex) {
        return String(sectionCount).padStart(2, '0')
      }
    }
  }
  return undefined
}

// =============================================================================
// Main Generator
// =============================================================================

export async function generateSchoolPptx(
  structure: PresentationStructure,
): Promise<string> {
  const pres = new PptxGenJS()
  pres.layout = 'LAYOUT_WIDE'
  pres.title = structure.title
  pres.author = 'УчиОн'

  const total = structure.slides.length

  for (let i = 0; i < structure.slides.length; i++) {
    const slide = structure.slides[i]
    const slideNum = i + 1
    const sectionNum = getSectionNumber(structure.slides, i)

    switch (slide.type) {
      case 'title':
        addTitleSlide(pres, slide)
        break
      case 'content':
        addContentSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'twoColumn':
        addTwoColumnSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'table':
        addTableSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'example':
        addExampleSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'formula':
        addFormulaSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'diagram':
        addDiagramSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'chart':
        addChartSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'practice':
        addPracticeSlide(pres, slide, slideNum, total, sectionNum)
        break
      case 'conclusion':
        addEndSlide(pres, slide)
        break
      default:
        addContentSlide(pres, slide, slideNum, total, sectionNum)
        break
    }
  }

  const base64 = await pres.write({ outputType: 'base64' }) as string
  return base64
}

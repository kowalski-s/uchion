import PptxGenJS from 'pptxgenjs'
import type { PresentationStructure, PresentationSlide, ContentElement } from '../../../shared/types.js'
import { normalizeContent, getContentItemText } from './sanitize.js'

// =============================================================================
// Kids Theme -- Colorful playful style for elementary school
// =============================================================================

const COLORS = {
  cream: 'FDF6E3',
  teal: '4ECDC4',
  coral: 'FF6B8A',
  purple: 'A78BFA',
  yellow: 'FBBF24',
  text: '2D3436',
  white: 'FFFFFF',
  muted: '94A3B8',
  lightTeal: 'E0F7F5',
  lightCoral: 'FFE0E8',
  lightPurple: 'EDE5FF',
  lightYellow: 'FFF7DB',
}

const BODY_FONT = 'Arial'
const CARD_COLORS = [COLORS.teal, COLORS.coral, COLORS.purple, COLORS.yellow]

// =============================================================================
// Decorative helpers
// =============================================================================

function addDecoCircles(pres: PptxGenJS, slide: PptxGenJS.Slide): void {
  // Colorful floating circles as decorative elements
  const circles = [
    { x: -0.3, y: -0.2, w: 0.8, h: 0.8, color: COLORS.teal, opacity: 0.15 },
    { x: 9.2, y: 0.1, w: 0.6, h: 0.6, color: COLORS.coral, opacity: 0.15 },
    { x: 8.5, y: 6.2, w: 0.9, h: 0.9, color: COLORS.purple, opacity: 0.12 },
    { x: 0.2, y: 5.8, w: 0.5, h: 0.5, color: COLORS.yellow, opacity: 0.2 },
    { x: 5.0, y: -0.3, w: 0.4, h: 0.4, color: COLORS.coral, opacity: 0.1 },
    { x: 9.6, y: 3.5, w: 0.7, h: 0.7, color: COLORS.yellow, opacity: 0.15 },
  ]
  for (const c of circles) {
    slide.addShape(pres.ShapeType.ellipse, {
      x: c.x, y: c.y, w: c.w, h: c.h,
      fill: { color: c.color, transparency: (1 - c.opacity) * 100 },
    })
  }
}

function addKidsFooter(
  slide: PptxGenJS.Slide,
  slideNumber: number,
  totalSlides: number,
): void {
  slide.addText(`${slideNumber} / ${totalSlides}`, {
    x: 8.8, y: 6.8, w: 1.5, h: 0.3,
    fontSize: 9, fontFace: BODY_FONT, color: COLORS.muted,
    align: 'right',
  })
}

// =============================================================================
// Rich Content → PptxGenJS text rows (kids sizing)
// =============================================================================

function contentElementsToRows(
  elements: ContentElement[]
): { text: string; options: Record<string, unknown> }[] {
  return elements.map(el => {
    // breakLine: true forces pptxgenjs to treat each element as a separate paragraph
    switch (el.el) {
      case 'heading':
        return {
          text: el.text,
          options: {
            fontSize: 24, fontFace: BODY_FONT, color: COLORS.text,
            bold: true, align: 'center' as const, breakLine: true,
            paraSpaceBefore: 6, paraSpaceAfter: 8,
          },
        }
      case 'definition':
        return {
          text: `  ${el.text}`,
          options: {
            fontSize: 18, fontFace: BODY_FONT, color: COLORS.text,
            italic: true, paraSpaceAfter: 6, breakLine: true,
            bullet: { code: '258E', color: COLORS.teal },
          },
        }
      case 'text':
        return {
          text: el.text,
          options: {
            fontSize: 16, fontFace: BODY_FONT, color: COLORS.text,
            paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'highlight':
        return {
          text: el.text,
          options: {
            fontSize: 18, fontFace: BODY_FONT, color: COLORS.teal,
            bold: true, paraSpaceAfter: 6, breakLine: true,
          },
        }
      case 'task':
        return {
          text: `${el.number ?? ''}. ${el.text}`,
          options: {
            fontSize: 16, fontFace: BODY_FONT, color: COLORS.text,
            paraSpaceAfter: 8, breakLine: true,
          },
        }
      case 'formula':
        return {
          text: el.text,
          options: {
            fontSize: 22, fontFace: BODY_FONT, color: COLORS.teal,
            bold: true, align: 'center' as const, breakLine: true,
            paraSpaceBefore: 4, paraSpaceAfter: 8,
          },
        }
      case 'bullet':
      default:
        return {
          text: el.text,
          options: {
            fontSize: 17, fontFace: BODY_FONT, color: COLORS.text,
            bullet: { code: '2022' as const, color: COLORS.teal },
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
  slide: PresentationSlide,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  // White card area
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.8, y: 1.0, w: 8.4, h: 4.5,
    fill: { color: COLORS.white },
    rectRadius: 0.2,
    shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.08 },
  })

  // Teal top bar on card
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.8, y: 1.0, w: 8.4, h: 0.15,
    fill: { color: COLORS.teal },
    rectRadius: 0.08,
  })

  // Category label
  const category = getContentItemText(slide.content[0] || '')
  if (category) {
    s.addText(category.toUpperCase(), {
      x: 1.2, y: 1.5, w: 7.6, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal,
      bold: true, charSpacing: 3,
    })
  }

  // Main title
  s.addText(slide.title, {
    x: 1.2, y: 2.0, w: 7.6, h: 1.8,
    fontSize: 38, fontFace: BODY_FONT, color: COLORS.text,
    bold: true, lineSpacing: 44,
  })

  // Subtitle
  const subtitle = getContentItemText(slide.content[1] || '')
  if (subtitle) {
    s.addText(subtitle, {
      x: 1.2, y: 3.8, w: 7.6, h: 0.6,
      fontSize: 16, fontFace: BODY_FONT, color: COLORS.muted,
    })
  }

  // Footer
  const footer = getContentItemText(slide.content[2] || '')
  if (footer) {
    s.addText(footer, {
      x: 1.2, y: 4.7, w: 7.6, h: 0.4,
      fontSize: 11, fontFace: BODY_FONT, color: COLORS.muted,
    })
  }

  // Small decorative colored squares at bottom-right of card
  s.addShape(pres.ShapeType.roundRect, {
    x: 7.8, y: 4.2, w: 0.5, h: 0.5,
    fill: { color: COLORS.coral },
    rectRadius: 0.08,
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 8.4, y: 4.0, w: 0.4, h: 0.4,
    fill: { color: COLORS.yellow },
    rectRadius: 0.08,
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 8.1, y: 4.8, w: 0.35, h: 0.35,
    fill: { color: COLORS.purple },
    rectRadius: 0.08,
  })
}

function addContentSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  // Title area
  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.7,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text,
    bold: true,
  })

  // Teal underline
  s.addShape(pres.ShapeType.rect, {
    x: 0.7, y: sectionNum ? 1.55 : 1.25, w: 2, h: 0.05,
    fill: { color: COLORS.teal },
  })

  // White card for content
  const cardY = sectionNum ? 1.8 : 1.5
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: cardY, w: 9, h: 5.2 - (cardY - 1.5),
    fill: { color: COLORS.white },
    rectRadius: 0.15,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.06 },
  })

  // Content items
  if (slide.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slide.content))
    s.addText(rows, {
      x: 0.9, y: cardY + 0.3, w: 8.2, h: 4.5 - (cardY - 1.5),
      valign: 'top' as const, lineSpacingMultiple: 1.3,
    })
  }

  addKidsFooter(s, slideNum, total)
}

function addTwoColumnSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  // Left teal panel
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.3, y: 0.3, w: 4.2, h: 6.9,
    fill: { color: COLORS.teal },
    rectRadius: 0.2,
  })

  // Section number on teal panel
  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.6, y: 0.5, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.white,
      bold: true,
    })
  }

  // Title on teal panel
  s.addText(slide.title, {
    x: 0.6, y: 1.2, w: 3.6, h: 2,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.white,
    bold: true, lineSpacing: 32,
  })

  // Right side: content cards
  const leftItems = slide.leftColumn || []
  const rightItems = slide.rightColumn || []
  const allItems = [...leftItems, ...rightItems]

  if (allItems.length > 0) {
    let cardY = 0.5
    allItems.slice(0, 5).forEach((item, i) => {
      const cardColor = CARD_COLORS[i % CARD_COLORS.length]
      // White card
      s.addShape(pres.ShapeType.roundRect, {
        x: 4.8, y: cardY, w: 5, h: 0.95,
        fill: { color: COLORS.white },
        rectRadius: 0.1,
        shadow: { type: 'outer', blur: 3, offset: 1, color: '000000', opacity: 0.05 },
      })
      // Colored left accent
      s.addShape(pres.ShapeType.roundRect, {
        x: 4.8, y: cardY, w: 0.08, h: 0.95,
        fill: { color: cardColor },
        rectRadius: 0.04,
      })
      // Text
      s.addText(item, {
        x: 5.05, y: cardY + 0.15, w: 4.55, h: 0.65,
        fontSize: 14, fontFace: BODY_FONT, color: COLORS.text,
        valign: 'middle' as const,
      })
      cardY += 1.1
    })
  } else if (slide.content.length > 0) {
    const rows = slide.content.map((item) => ({
      text: getContentItemText(item),
      options: {
        fontSize: 14, fontFace: BODY_FONT, color: COLORS.text,
        bullet: { code: '2022' as const, color: COLORS.teal },
        paraSpaceAfter: 6,
      },
    }))
    s.addText(rows, {
      x: 4.8, y: 0.5, w: 5, h: 6,
      valign: 'top' as const, lineSpacingMultiple: 1.2,
    })
  }

  addKidsFooter(s, slideNum, total)
}

function addTableSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.6,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text, bold: true,
  })

  const td = slide.tableData
  if (td && td.headers.length > 0) {
    const headerRow: PptxGenJS.TableCell[] = td.headers.map(h => ({
      text: h,
      options: {
        bold: true, fontSize: 14, fontFace: BODY_FONT,
        color: COLORS.white, fill: { color: COLORS.teal },
        align: 'center' as const, valign: 'middle' as const,
      },
    }))

    const dataRows: PptxGenJS.TableCell[][] = td.rows.map((row, ri) =>
      row.map(cell => ({
        text: cell,
        options: {
          fontSize: 13, fontFace: BODY_FONT, color: COLORS.text,
          fill: { color: ri % 2 === 0 ? COLORS.lightTeal : COLORS.white },
          align: 'center' as const, valign: 'middle' as const,
        },
      }))
    )

    s.addTable([headerRow, ...dataRows], {
      x: 0.7, y: sectionNum ? 1.6 : 1.3, w: 8.6,
      border: { type: 'solid', pt: 0.5, color: COLORS.lightTeal },
      rowH: 0.55,
      autoPage: false,
    })
  } else {
    addContentSlide(pres, slide, slideNum, total, sectionNum)
    return
  }

  addKidsFooter(s, slideNum, total)
}

function addFormulaSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.6,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text, bold: true,
  })

  // Big formula card
  const formula = getContentItemText(slide.content[0] || '')
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.7, y: 1.8, w: 8.6, h: 2,
    fill: { color: COLORS.white },
    rectRadius: 0.15,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.06 },
  })

  // Teal top bar on card
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.7, y: 1.8, w: 8.6, h: 0.08,
    fill: { color: COLORS.teal },
    rectRadius: 0.04,
  })

  s.addText(formula, {
    x: 0.7, y: 2.0, w: 8.6, h: 1.2,
    fontSize: 40, fontFace: BODY_FONT, color: COLORS.teal,
    bold: true, align: 'center',
  })

  // Description
  const description = getContentItemText(slide.content[1] || '')
  if (description) {
    s.addText(description, {
      x: 0.7, y: 3.2, w: 8.6, h: 0.5,
      fontSize: 13, fontFace: BODY_FONT, color: COLORS.muted,
      align: 'center',
    })
  }

  // Legend items in colored cards
  const legendItems = slide.content.slice(2).map(getContentItemText)
  if (legendItems.length > 0) {
    const itemW = 8.6 / Math.max(legendItems.length, 1)
    let fx = 0.7
    legendItems.forEach((item, i) => {
      const color = CARD_COLORS[i % CARD_COLORS.length]
      s.addShape(pres.ShapeType.roundRect, {
        x: fx + 0.1, y: 4.2, w: itemW - 0.2, h: 0.9,
        fill: { color },
        rectRadius: 0.1,
      })
      s.addText(item, {
        x: fx + 0.25, y: 4.3, w: itemW - 0.5, h: 0.7,
        fontSize: 11, fontFace: BODY_FONT, color: COLORS.white,
        valign: 'middle' as const,
      })
      fx += itemW
    })
  }

  addKidsFooter(s, slideNum, total)
}

function addExampleSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.6,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text, bold: true,
  })

  // White card with coral top accent
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.6, w: 9, h: 5,
    fill: { color: COLORS.white },
    rectRadius: 0.15,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.06 },
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: 1.6, w: 9, h: 0.08,
    fill: { color: COLORS.coral },
    rectRadius: 0.04,
  })

  if (slide.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slide.content))
    s.addText(rows, {
      x: 0.9, y: 1.9, w: 8.2, h: 4.4,
      valign: 'top' as const, lineSpacingMultiple: 1.3,
    })
  }

  addKidsFooter(s, slideNum, total)
}

function addPracticeSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.6,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text, bold: true,
  })

  // Teal underline
  s.addShape(pres.ShapeType.rect, {
    x: 0.7, y: sectionNum ? 1.5 : 1.2, w: 8.6, h: 0.05,
    fill: { color: COLORS.teal },
  })

  // White card for task
  const cardY = sectionNum ? 1.7 : 1.4
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: cardY, w: 9, h: 5.3 - (cardY - 1.4),
    fill: { color: COLORS.white },
    rectRadius: 0.15,
    shadow: { type: 'outer', blur: 4, offset: 1, color: '000000', opacity: 0.06 },
  })

  // Purple left accent
  s.addShape(pres.ShapeType.roundRect, {
    x: 0.5, y: cardY, w: 0.08, h: 5.3 - (cardY - 1.4),
    fill: { color: COLORS.purple },
    rectRadius: 0.04,
  })

  if (slide.content.length > 0) {
    const rows = contentElementsToRows(normalizeContent(slide.content))
    s.addText(rows, {
      x: 0.9, y: cardY + 0.3, w: 8.2, h: 4.5 - (cardY - 1.4),
      valign: 'top' as const, lineSpacingMultiple: 1.3,
    })
  }

  addKidsFooter(s, slideNum, total)
}

function addDiagramSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.6,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text, bold: true,
  })

  // Render items as colored rounded boxes
  const items = slide.content.slice(0, 6).map(getContentItemText)
  const cols = items.length <= 3 ? items.length : Math.ceil(items.length / 2)
  const rows = items.length <= 3 ? 1 : 2
  const boxW = 2.8
  const boxH = 1.0
  const gap = 0.4
  const startX = (10 - cols * boxW - (cols - 1) * gap) / 2
  const startY = rows === 1 ? 3.0 : 2.0

  for (let i = 0; i < items.length; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = startX + col * (boxW + gap)
    const y = startY + row * (boxH + 0.8)
    const bgColor = CARD_COLORS[i % CARD_COLORS.length]

    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: boxW, h: boxH,
      fill: { color: bgColor },
      rectRadius: 0.12,
    })
    s.addText(items[i], {
      x: x + 0.15, y, w: boxW - 0.3, h: boxH,
      fontSize: 13, fontFace: BODY_FONT, color: COLORS.white,
      align: 'center', valign: 'middle' as const,
      bold: true,
    })
  }

  addKidsFooter(s, slideNum, total)
}

function addChartSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
  slideNum: number,
  total: number,
  sectionNum?: string,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  if (sectionNum) {
    s.addText(sectionNum, {
      x: 0.7, y: 0.4, w: 1, h: 0.4,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.teal, bold: true,
    })
  }

  s.addText(slide.title, {
    x: 0.7, y: sectionNum ? 0.8 : 0.5, w: 8.6, h: 0.6,
    fontSize: 26, fontFace: BODY_FONT, color: COLORS.text, bold: true,
  })

  const cd = slide.chartData
  if (cd && cd.labels.length > 0 && cd.values.length > 0) {
    s.addChart('bar' as any, [{
      name: slide.title,
      labels: cd.labels,
      values: cd.values,
    }], {
      x: 0.7, y: 1.6, w: 8.6, h: 4.8,
      showValue: true,
      chartColors: [COLORS.teal, COLORS.coral, COLORS.purple, COLORS.yellow],
      valGridLine: { color: 'E8E4DF', size: 1 },
    })
  } else {
    addContentSlide(pres, slide, slideNum, total, sectionNum)
    return
  }

  addKidsFooter(s, slideNum, total)
}

function addEndSlide(
  pres: PptxGenJS,
  slide: PresentationSlide,
): void {
  const s = pres.addSlide()
  s.background = { fill: COLORS.cream }
  addDecoCircles(pres, s)

  // Large centered white card
  s.addShape(pres.ShapeType.roundRect, {
    x: 1, y: 1, w: 8, h: 5.5,
    fill: { color: COLORS.white },
    rectRadius: 0.25,
    shadow: { type: 'outer', blur: 6, offset: 2, color: '000000', opacity: 0.08 },
  })

  // Teal top bar
  s.addShape(pres.ShapeType.roundRect, {
    x: 1, y: 1, w: 8, h: 0.15,
    fill: { color: COLORS.teal },
    rectRadius: 0.08,
  })

  // Thank you label
  s.addText('МОЛОДЦЫ!', {
    x: 1.5, y: 1.6, w: 7, h: 0.5,
    fontSize: 14, fontFace: BODY_FONT, color: COLORS.teal,
    bold: true, charSpacing: 5, align: 'center',
  })

  // Big title
  s.addText(slide.title || 'Вопросы?', {
    x: 1.5, y: 2.3, w: 7, h: 1.2,
    fontSize: 44, fontFace: BODY_FONT, color: COLORS.text,
    bold: true, align: 'center',
  })

  // Contact info
  if (slide.content.length > 0) {
    s.addText(slide.content.map(getContentItemText).join('\n'), {
      x: 2, y: 3.8, w: 6, h: 1.2,
      fontSize: 12, fontFace: BODY_FONT, color: COLORS.muted,
      align: 'center',
    })
  }

  // Decorative colored dots at bottom
  const dotColors = [COLORS.teal, COLORS.coral, COLORS.purple, COLORS.yellow, COLORS.teal]
  dotColors.forEach((color, i) => {
    s.addShape(pres.ShapeType.ellipse, {
      x: 3.0 + i * 0.9, y: 5.5, w: 0.35, h: 0.35,
      fill: { color },
    })
  })
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

export async function generateKidsPptx(
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

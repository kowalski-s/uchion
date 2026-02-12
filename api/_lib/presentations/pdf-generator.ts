import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import type { PresentationStructure, PresentationSlide, PresentationThemePreset, ContentElement } from '../../../shared/types.js'
import { normalizeContent, getContentItemText } from './sanitize.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// =============================================================================
// Theme colors (matches PPTX generator)
// =============================================================================

interface PdfTheme {
  bg: [number, number, number]
  title: [number, number, number]
  text: [number, number, number]
  accent: [number, number, number]
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16)
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255]
}

const THEMES: Record<PresentationThemePreset, PdfTheme> = {
  professional: {
    bg: [1, 1, 1],
    title: hexToRgb('1B2A4A'),
    text: hexToRgb('333333'),
    accent: hexToRgb('2E5090'),
  },
  educational: {
    bg: hexToRgb('FFFBF5'),
    title: hexToRgb('8C52FF'),
    text: hexToRgb('2D2D2D'),
    accent: hexToRgb('FF6B35'),
  },
  minimal: {
    bg: hexToRgb('F5F3F0'),
    title: hexToRgb('1A1A1A'),
    text: hexToRgb('2D2D2D'),
    accent: hexToRgb('8B7355'),
  },
  scientific: {
    bg: hexToRgb('F8FAF8'),
    title: hexToRgb('1A5632'),
    text: hexToRgb('2C2C2C'),
    accent: hexToRgb('2A7B4F'),
  },
  kids: {
    bg: hexToRgb('FDF6E3'),
    title: hexToRgb('2D3436'),
    text: hexToRgb('2D3436'),
    accent: hexToRgb('4ECDC4'),
  },
}

// A4 landscape dimensions in points
const W = 841.89 // 297mm
const H = 595.28 // 210mm
const MARGIN = 50
const CONTENT_W = W - 2 * MARGIN

// =============================================================================
// Text helpers
// =============================================================================

/** Wrap text to fit within maxWidth, returns array of lines */
function wrapText(text: string, font: any, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const test = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(test, fontSize)
    if (width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/** Draw wrapped text, returns Y position after last line */
function drawWrappedText(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  fontSize: number,
  color: [number, number, number],
  maxWidth: number,
  lineHeight: number
): number {
  const lines = wrapText(text, font, fontSize, maxWidth)
  let curY = y
  for (const line of lines) {
    if (curY < MARGIN) break
    page.drawText(line, { x, y: curY, size: fontSize, font, color: rgb(...color) })
    curY -= lineHeight
  }
  return curY
}

// =============================================================================
// Slide renderers
// =============================================================================

function drawAccentBar(page: any, theme: PdfTheme) {
  page.drawRectangle({
    x: 0, y: H - 6, width: W, height: 6,
    color: rgb(...theme.accent),
  })
}

function drawSlideNumber(page: any, num: number, total: number, font: any, theme: PdfTheme) {
  const text = `${num} / ${total}`
  page.drawText(text, {
    x: W - MARGIN - 40, y: 20, size: 9, font, color: rgb(...theme.accent),
  })
  page.drawText('УчиОн', {
    x: MARGIN, y: 20, size: 9, font, color: rgb(...theme.accent),
  })
}

function drawSlideHeader(page: any, title: string, font: any, boldFont: any, theme: PdfTheme): number {
  drawAccentBar(page, theme)

  // Vertical accent bar left of title
  page.drawRectangle({
    x: MARGIN, y: H - 55, width: 3, height: 25,
    color: rgb(...theme.accent),
  })

  // Title
  const titleLines = wrapText(title, boldFont, 26, CONTENT_W - 16)
  let y = H - 45
  for (const line of titleLines) {
    page.drawText(line, { x: MARGIN + 12, y, size: 26, font: boldFont, color: rgb(...theme.title) })
    y -= 32
  }

  // Separator line
  y -= 4
  page.drawRectangle({
    x: MARGIN, y, width: 180, height: 2.5,
    color: rgb(...theme.accent),
  })

  return y - 20
}

/** Draw rich content elements, returns Y position after all elements */
function drawContentElements(
  page: any,
  elements: ContentElement[],
  startY: number,
  font: any,
  boldFont: any,
  theme: PdfTheme,
  contentW: number = CONTENT_W,
  marginLeft: number = MARGIN
): number {
  let y = startY
  for (const el of elements) {
    if (y < MARGIN + 30) break
    switch (el.el) {
      case 'heading': {
        const lines = wrapText(el.text, boldFont, 22, contentW - 40)
        for (const line of lines) {
          if (y < MARGIN + 30) break
          const tw = boldFont.widthOfTextAtSize(line, 22)
          page.drawText(line, { x: (W - tw) / 2, y, size: 22, font: boldFont, color: rgb(...theme.title) })
          y -= 28
        }
        y -= 4
        break
      }
      case 'definition': {
        // Draw accent bar left
        page.drawRectangle({
          x: marginLeft + 4, y: y - 2, width: 3, height: 18,
          color: rgb(...theme.accent),
        })
        y = drawWrappedText(page, el.text, marginLeft + 14, y, font, 17, theme.text, contentW - 18, 22)
        y -= 6
        break
      }
      case 'text': {
        y = drawWrappedText(page, el.text, marginLeft + 4, y, font, 16, theme.text, contentW - 8, 21)
        y -= 5
        break
      }
      case 'highlight': {
        y = drawWrappedText(page, el.text, marginLeft + 4, y, boldFont, 17, theme.accent, contentW - 8, 22)
        y -= 6
        break
      }
      case 'task': {
        const prefix = `${el.number ?? ''}.`
        page.drawText(prefix, { x: marginLeft + 4, y, size: 16, font: boldFont, color: rgb(...theme.text) })
        const prefixW = boldFont.widthOfTextAtSize(prefix, 16) + 6
        y = drawWrappedText(page, el.text, marginLeft + 4 + prefixW, y, font, 16, theme.text, contentW - 8 - prefixW, 21)
        y -= 7
        break
      }
      case 'formula': {
        const fLines = wrapText(el.text, boldFont, 22, contentW - 60)
        for (const line of fLines) {
          if (y < MARGIN + 30) break
          const tw = boldFont.widthOfTextAtSize(line, 22)
          page.drawText(line, { x: (W - tw) / 2, y, size: 22, font: boldFont, color: rgb(...theme.accent) })
          y -= 28
        }
        y -= 4
        break
      }
      case 'bullet':
      default: {
        page.drawText('\u2022', { x: marginLeft + 4, y: y + 1, size: 17, font, color: rgb(...theme.accent) })
        y = drawWrappedText(page, el.text, marginLeft + 22, y, font, 17, theme.text, contentW - 22, 23)
        y -= 6
        break
      }
    }
  }
  return y
}

async function renderTitleSlide(
  page: any, slide: PresentationSlide,
  font: any, boldFont: any, theme: PdfTheme
) {
  // Background
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  drawAccentBar(page, theme)

  // Centered title
  const titleLines = wrapText(slide.title, boldFont, 34, CONTENT_W - 60)
  let y = H / 2 + 40
  for (const line of titleLines) {
    const tw = boldFont.widthOfTextAtSize(line, 34)
    page.drawText(line, { x: (W - tw) / 2, y, size: 34, font: boldFont, color: rgb(...theme.title) })
    y -= 42
  }

  // Subtitle
  if (slide.content.length > 0) {
    y -= 10
    const subtitle = slide.content.map(getContentItemText).join(' ')
    const subLines = wrapText(subtitle, font, 18, CONTENT_W - 100)
    for (const line of subLines) {
      const tw = font.widthOfTextAtSize(line, 18)
      page.drawText(line, { x: (W - tw) / 2, y, size: 18, font, color: rgb(...theme.text) })
      y -= 24
    }
  }

  page.drawText('УчиОн', {
    x: (W - font.widthOfTextAtSize('УчиОн', 9)) / 2, y: 20,
    size: 9, font, color: rgb(...theme.accent),
  })
}

async function renderContentSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let y = drawSlideHeader(page, slide.title, font, boldFont, theme)

  // Light background card
  page.drawRectangle({
    x: MARGIN - 5, y: MARGIN + 25, width: CONTENT_W + 10, height: y - MARGIN - 20,
    color: rgb(0.973, 0.976, 0.98),
  })

  const elements = normalizeContent(slide.content)
  drawContentElements(page, elements, y, font, boldFont, theme)

  drawSlideNumber(page, num, total, font, theme)
}

async function renderTwoColumnSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  const colW = (CONTENT_W - 20) / 2
  const leftItems = slide.leftColumn || []
  const rightItems = slide.rightColumn || []

  // Divider
  page.drawRectangle({
    x: MARGIN + colW + 8, y: MARGIN + 30, width: 1.5, height: startY - MARGIN - 30,
    color: rgb(...theme.accent),
  })

  // Left
  let y = startY
  for (const item of leftItems) {
    if (y < MARGIN + 30) break
    page.drawText('\u2022', { x: MARGIN + 4, y: y + 1, size: 14, font, color: rgb(...theme.accent) })
    y = drawWrappedText(page, item, MARGIN + 18, y, font, 14, theme.text, colW - 18, 19)
    y -= 5
  }

  // Right
  y = startY
  const rightX = MARGIN + colW + 20
  for (const item of rightItems) {
    if (y < MARGIN + 30) break
    page.drawText('\u2022', { x: rightX, y: y + 1, size: 14, font, color: rgb(...theme.accent) })
    y = drawWrappedText(page, item, rightX + 14, y, font, 14, theme.text, colW - 14, 19)
    y -= 5
  }

  drawSlideNumber(page, num, total, font, theme)
}

async function renderTableSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  const td = slide.tableData
  if (td && td.headers.length > 0) {
    const cols = td.headers.length
    const colWidth = CONTENT_W / cols
    const rowH = 28
    let y = startY

    // Header row
    page.drawRectangle({
      x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH,
      color: rgb(...theme.accent),
    })
    for (let c = 0; c < cols; c++) {
      const text = td.headers[c] || ''
      const truncated = text.length > 30 ? text.slice(0, 27) + '...' : text
      page.drawText(truncated, {
        x: MARGIN + c * colWidth + 6, y: y - rowH + 8,
        size: 13, font: boldFont, color: rgb(1, 1, 1),
      })
    }
    y -= rowH

    // Data rows
    for (let r = 0; r < td.rows.length; r++) {
      if (y - rowH < MARGIN + 30) break
      const fillColor = r % 2 === 0 ? rgb(0.97, 0.97, 0.97) : rgb(1, 1, 1)
      page.drawRectangle({
        x: MARGIN, y: y - rowH, width: CONTENT_W, height: rowH, color: fillColor,
      })
      // Grid lines
      page.drawRectangle({
        x: MARGIN, y: y - rowH, width: CONTENT_W, height: 0.5, color: rgb(0.8, 0.8, 0.8),
      })
      for (let c = 0; c < cols; c++) {
        const text = td.rows[r]?.[c] || ''
        const truncated = text.length > 35 ? text.slice(0, 32) + '...' : text
        page.drawText(truncated, {
          x: MARGIN + c * colWidth + 6, y: y - rowH + 8,
          size: 12, font, color: rgb(...theme.text),
        })
      }
      y -= rowH
    }
  } else {
    // Fallback to bullet content
    let y = startY
    for (const item of slide.content) {
      if (y < MARGIN + 30) break
      const text = getContentItemText(item)
      page.drawText('\u2022', { x: MARGIN + 4, y: y + 1, size: 12, font, color: rgb(...theme.accent) })
      y = drawWrappedText(page, text, MARGIN + 18, y, font, 12, theme.text, CONTENT_W - 18, 17)
      y -= 5
    }
  }

  drawSlideNumber(page, num, total, font, theme)
}

async function renderExampleSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  // Light background box
  page.drawRectangle({
    x: MARGIN, y: MARGIN + 30, width: CONTENT_W, height: startY - MARGIN - 30,
    color: rgb(0.96, 0.96, 1),
  })

  // Accent top border
  page.drawRectangle({
    x: MARGIN, y: startY + 8, width: CONTENT_W, height: 3,
    color: rgb(...theme.accent),
  })

  let y = startY - 10
  const elements = normalizeContent(slide.content)
  y = drawContentElements(page, elements, y, font, boldFont, theme, CONTENT_W - 28, MARGIN + 10)

  drawSlideNumber(page, num, total, font, theme)
}

async function renderFormulaSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  // Large centered formula
  const formula = getContentItemText(slide.content[0] || '')
  const fLines = wrapText(formula, boldFont, 30, CONTENT_W - 60)
  let y = startY - 20
  for (const line of fLines) {
    const tw = boldFont.widthOfTextAtSize(line, 30)
    page.drawText(line, { x: (W - tw) / 2, y, size: 30, font: boldFont, color: rgb(...theme.accent) })
    y -= 38
  }

  // Explanation
  y -= 10
  for (let i = 1; i < slide.content.length; i++) {
    if (y < MARGIN + 30) break
    y = drawWrappedText(page, getContentItemText(slide.content[i]), MARGIN + 40, y, font, 15, theme.text, CONTENT_W - 80, 20)
    y -= 5
  }

  drawSlideNumber(page, num, total, font, theme)
}

async function renderDiagramSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  const items = slide.content.map(getContentItemText)
  const count = Math.min(items.length, 6)
  const boxW = 180
  const boxH = 50
  const cols = count <= 3 ? count : Math.ceil(count / 2)
  const rows = count <= 3 ? 1 : 2
  const gap = 30
  const totalW = cols * boxW + (cols - 1) * gap
  const startX = (W - totalW) / 2
  const totalH = rows * boxH + (rows - 1) * 40
  const baseY = startY - (startY - MARGIN - 30 - totalH) / 2

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols)
    const col = i % cols
    const x = startX + col * (boxW + gap)
    const y = baseY - row * (boxH + 40)

    const isFirst = i === 0
    const fill = isFirst ? rgb(...theme.accent) : rgb(0.94, 0.94, 0.94)
    const textClr = isFirst ? rgb(1, 1, 1) : rgb(...theme.text)

    // Box
    page.drawRectangle({ x, y, width: boxW, height: boxH, color: fill })
    page.drawRectangle({ x, y, width: boxW, height: boxH, borderColor: rgb(...theme.accent), borderWidth: 1.5 })

    // Text
    const label = items[i].length > 28 ? items[i].slice(0, 25) + '...' : items[i]
    const tw = font.widthOfTextAtSize(label, 11)
    page.drawText(label, {
      x: x + (boxW - tw) / 2, y: y + (boxH - 11) / 2,
      size: 11, font, color: textClr,
    })
  }

  drawSlideNumber(page, num, total, font, theme)
}

async function renderChartSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  const cd = slide.chartData
  if (cd && cd.labels.length > 0 && cd.values.length > 0) {
    const maxVal = Math.max(...cd.values, 1)
    const barH = 22
    const gap = 10
    const maxBarW = CONTENT_W - 150
    let y = startY - 10

    for (let i = 0; i < cd.labels.length; i++) {
      if (y - barH < MARGIN + 30) break
      // Label
      const label = cd.labels[i].length > 20 ? cd.labels[i].slice(0, 17) + '...' : cd.labels[i]
      page.drawText(label, {
        x: MARGIN, y: y - barH + 6, size: 10, font, color: rgb(...theme.text),
      })
      // Bar
      const barW = Math.max(4, (cd.values[i] / maxVal) * maxBarW)
      page.drawRectangle({
        x: MARGIN + 130, y: y - barH + 2, width: barW, height: barH - 4,
        color: rgb(...theme.accent),
      })
      // Value
      page.drawText(String(cd.values[i]), {
        x: MARGIN + 130 + barW + 6, y: y - barH + 6, size: 10, font: boldFont, color: rgb(...theme.accent),
      })
      y -= barH + gap
    }
  } else {
    // Fallback bullets
    let y = startY
    for (const item of slide.content) {
      if (y < MARGIN + 30) break
      const text = getContentItemText(item)
      page.drawText('\u2022', { x: MARGIN + 4, y: y + 1, size: 12, font, color: rgb(...theme.accent) })
      y = drawWrappedText(page, text, MARGIN + 18, y, font, 12, theme.text, CONTENT_W - 18, 17)
      y -= 5
    }
  }

  drawSlideNumber(page, num, total, font, theme)
}

async function renderPracticeSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })
  let startY = drawSlideHeader(page, slide.title, font, boldFont, theme)

  // Background card
  page.drawRectangle({
    x: MARGIN - 5, y: MARGIN + 25, width: CONTENT_W + 10, height: startY - MARGIN - 10,
    color: rgb(0.973, 0.976, 0.98),
  })

  // Vertical accent bar left
  page.drawRectangle({
    x: MARGIN - 5, y: MARGIN + 25, width: 3, height: startY - MARGIN - 10,
    color: rgb(...theme.accent),
  })

  // Separator line
  page.drawRectangle({
    x: MARGIN, y: startY + 10, width: CONTENT_W, height: 2,
    color: rgb(...theme.accent),
  })

  let y = startY - 5
  const elements = normalizeContent(slide.content)
  drawContentElements(page, elements, y, font, boldFont, theme, CONTENT_W - 20, MARGIN + 5)

  drawSlideNumber(page, num, total, font, theme)
}

async function renderConclusionSlide(
  page: any, slide: PresentationSlide,
  num: number, total: number,
  font: any, boldFont: any, theme: PdfTheme
) {
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: rgb(...theme.bg) })

  // Thicker accent bar
  page.drawRectangle({ x: 0, y: H - 10, width: W, height: 10, color: rgb(...theme.accent) })

  // Centered title
  const titleLines = wrapText(slide.title, boldFont, 28, CONTENT_W - 40)
  let y = H - 60
  for (const line of titleLines) {
    const tw = boldFont.widthOfTextAtSize(line, 28)
    page.drawText(line, { x: (W - tw) / 2, y, size: 28, font: boldFont, color: rgb(...theme.title) })
    y -= 36
  }

  y -= 10
  const elements = normalizeContent(slide.content)
  for (const el of elements) {
    if (y < MARGIN + 30) break
    const text = el.text
    // Checkmark for bullet items, standard rendering for others
    if (el.el === 'bullet') {
      page.drawText('\u2713', { x: MARGIN + 30, y: y + 1, size: 16, font, color: rgb(...theme.accent) })
      y = drawWrappedText(page, text, MARGIN + 50, y, font, 16, theme.text, CONTENT_W - 80, 22)
      y -= 8
    } else {
      // Use rich rendering for non-bullet elements
      y = drawContentElements(page, [el], y, font, boldFont, theme, CONTENT_W - 60, MARGIN + 30)
    }
  }

  drawSlideNumber(page, num, total, font, theme)
}

// =============================================================================
// Main export
// =============================================================================

export async function generatePresentationPdf(
  structure: PresentationStructure,
  themePreset: PresentationThemePreset | 'custom' = 'professional'
): Promise<string> {
  const effectivePreset: PresentationThemePreset = themePreset === 'custom' ? 'professional' : themePreset
  const theme = THEMES[effectivePreset]

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  // Load Inter fonts with Cyrillic support
  // Production (Docker): /app/api/_assets/fonts/ or /app/dist/fonts/
  // Development: public/fonts/ (via process.cwd())
  const cwd = process.cwd()
  const fontPaths = [
    {
      regular: path.join(cwd, 'api/_assets/fonts/Inter-Regular.ttf'),
      bold: path.join(cwd, 'api/_assets/fonts/Inter-Bold.ttf'),
    },
    {
      regular: path.join(cwd, 'public/fonts/Inter-Regular.ttf'),
      bold: path.join(cwd, 'public/fonts/Inter-Bold.ttf'),
    },
    {
      regular: path.join(cwd, 'dist/fonts/Inter-Regular.ttf'),
      bold: path.join(cwd, 'dist/fonts/Inter-Bold.ttf'),
    },
  ]

  let regularBytes: Buffer | undefined
  let boldBytes: Buffer | undefined
  for (const p of fontPaths) {
    try {
      regularBytes = fs.readFileSync(p.regular)
      boldBytes = fs.readFileSync(p.bold)
      break
    } catch { /* try next path */ }
  }
  if (!regularBytes || !boldBytes) {
    throw new Error('Inter font files not found for PDF generation')
  }

  const font = await doc.embedFont(regularBytes, { subset: true })
  const boldFont = await doc.embedFont(boldBytes, { subset: true })

  const total = structure.slides.length

  for (let i = 0; i < structure.slides.length; i++) {
    const slide = structure.slides[i]
    const page = doc.addPage([W, H])
    const num = i + 1

    switch (slide.type) {
      case 'title':
        await renderTitleSlide(page, slide, font, boldFont, theme)
        break
      case 'content':
        await renderContentSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'twoColumn':
        await renderTwoColumnSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'table':
        await renderTableSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'example':
        await renderExampleSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'formula':
        await renderFormulaSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'diagram':
        await renderDiagramSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'chart':
        await renderChartSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'practice':
        await renderPracticeSlide(page, slide, num, total, font, boldFont, theme)
        break
      case 'conclusion':
        await renderConclusionSlide(page, slide, num, total, font, boldFont, theme)
        break
      default:
        await renderContentSlide(page, slide, num, total, font, boldFont, theme)
        break
    }
  }

  const pdfBytes = await doc.save()
  // Convert to base64
  const base64 = Buffer.from(pdfBytes).toString('base64')
  return base64
}

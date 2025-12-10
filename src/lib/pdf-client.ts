import { PDFDocument, PageSizes, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { Worksheet } from '../../shared/types'

const fetchFont = async (url: string) => {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Failed to fetch font from ${url}: ${res.statusText}`)
    const buf = await res.arrayBuffer()
    return new Uint8Array(buf)
  } catch (e) {
    console.error(`Error loading font ${url}:`, e)
    throw e
  }
}

const wrapText = (font: any, text: string, size: number, maxWidth: number) => {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    const width = font.widthOfTextAtSize(test, size)
    if (width <= maxWidth) line = test
    else {
      if (line) lines.push(line)
      line = w
    }
  }
  if (line) lines.push(line)
  return lines
}

export async function buildWorksheetPdf(worksheet: Worksheet) {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)
  const [w, h] = PageSizes.A4
  const margin = 40
  const contentWidth = w - margin * 2
  const regularBytes = await fetchFont('/fonts/Inter-Regular.ttf')
  const boldBytes = await fetchFont('/fonts/Inter-Bold.ttf')
  const regular = await pdfDoc.embedFont(regularBytes)
  const bold = await pdfDoc.embedFont(boldBytes)
  const addPage = () => pdfDoc.addPage([w, h])
  let page = addPage()
  let cursorY = h - margin

  const drawText = (txt: string, size = 12, font = regular, x = margin, y = cursorY, color = rgb(0, 0, 0)) => {
    page.drawText(txt, { x, y: y - size, size, font, color })
    cursorY = y - size - 6
  }

  const ensure = (needed: number) => {
    if (cursorY - needed < margin) {
      page = addPage()
      cursorY = h - margin
    }
  }

  const drawHeader = () => {
    ensure(120) // Increased header space reservation

    // Name and Date at the very top right (first to avoid overlap)
    const nameLabel = 'Имя и фамилия: '
    const dateLabel = 'Дата: '
    const nameWidth = regular.widthOfTextAtSize(nameLabel, 11)
    const dateWidth = regular.widthOfTextAtSize(dateLabel, 11)
    const lineLength = 150
    const rightMargin = margin
    
    // Date
    const dateY = h - margin - 20
    page.drawText(dateLabel, { x: w - rightMargin - lineLength - dateWidth, y: dateY, size: 11, font: regular })
    page.drawLine({ start: { x: w - rightMargin - lineLength, y: dateY - 2 }, end: { x: w - rightMargin, y: dateY - 2 }, thickness: 0.5, color: rgb(0, 0, 0) })
    
    // Name
    const nameY = h - margin - 45
    page.drawText(nameLabel, { x: w - rightMargin - lineLength - nameWidth, y: nameY, size: 11, font: regular })
    page.drawLine({ start: { x: w - rightMargin - lineLength, y: nameY - 2 }, end: { x: w - rightMargin, y: nameY - 2 }, thickness: 0.5, color: rgb(0, 0, 0) })

    // Reset cursor for Title below header area
    cursorY = h - margin - 70

    // Title centered
    const titleSize = 24
    const title = worksheet.topic
    const titleWidth = bold.widthOfTextAtSize(title, titleSize)
    const centerX = margin + (contentWidth - titleWidth) / 2
    page.drawText(title, { x: centerX, y: cursorY - titleSize, size: titleSize, font: bold })
    cursorY -= titleSize + 16
  }

  const drawSectionTitle = (text: string, type: 'assignment' | 'test' | 'other') => {
    // Draw icon background
    const iconSize = 28
    const iconX = margin
    const iconY = cursorY - iconSize + 6 // Adjust alignment
    const color = rgb(0.35, 0.2, 0.85) // Purple

    if (type !== 'other') {
      page.drawRectangle({
        x: iconX,
        y: iconY,
        width: iconSize,
        height: iconSize,
        color: color,
        borderColor: color,
        borderWidth: 0,
      })

      // Draw simple white icon inside
      if (type === 'assignment') {
        // Pencil icon (diagonal line with thickness)
        page.drawLine({
          start: { x: iconX + 6, y: iconY + 6 },
          end: { x: iconX + 22, y: iconY + 22 },
          color: rgb(1, 1, 1),
          thickness: 3
        })
      } else if (type === 'test') {
        // Document icon (lines)
        const lineX = iconX + 6
        page.drawLine({ start: { x: lineX, y: iconY + 20 }, end: { x: lineX + 16, y: iconY + 20 }, color: rgb(1, 1, 1), thickness: 2 })
        page.drawLine({ start: { x: lineX, y: iconY + 14 }, end: { x: lineX + 16, y: iconY + 14 }, color: rgb(1, 1, 1), thickness: 2 })
        page.drawLine({ start: { x: lineX, y: iconY + 8 }, end: { x: lineX + 12, y: iconY + 8 }, color: rgb(1, 1, 1), thickness: 2 })
      }
    }

    const textX = type === 'other' ? margin : margin + iconSize + 12
    page.drawText(text, { x: textX, y: cursorY - 16, size: 16, font: bold, color: rgb(0, 0, 0) })
    cursorY -= 32
  }

  const drawAssignments = () => {
    // Page 1: Header + Assignments 1-4
    // We assume drawHeader() has already run and cursorY is set.
    
    drawSectionTitle('Задания', 'assignment')
    
    const fieldHeight = 80 // Reduced for compactness
    const itemsPerPage1 = 4
    
    // Draw first 4 items
    worksheet.assignments.slice(0, itemsPerPage1).forEach((a, i) => {
      const maxWidth = contentWidth
      const lines = wrapText(regular, `${i + 1}. ${a.text}`, 12, maxWidth)
      // Check if text is too long, if so, limit it or just let it flow (but might overflow page)
      // Since we force 4 items, we hope they fit. 
      // Typically 4 items * (fieldHeight + textHeight) ~ 4 * 120 = 480pt.
      // Page height 842 - 120 (header) - 80 (margin) = 640pt. Should fit.
      
      let y = cursorY
      lines.forEach(line => {
        page.drawText(line, { x: margin, y: y - 12, size: 12, font: regular })
        y -= 18
      })
      cursorY = y - 6
      page.drawRectangle({ x: margin, y: cursorY - fieldHeight, width: contentWidth, height: fieldHeight, borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 1, color: rgb(0.97, 0.97, 0.98) })
      cursorY -= fieldHeight + 16
    })

    // Force Page Break for next 4 items
    page = addPage()
    cursorY = h - margin
    
    // Draw next 4 items (5-8)
    worksheet.assignments.slice(itemsPerPage1).forEach((a, i) => {
      const idx = itemsPerPage1 + i
      const maxWidth = contentWidth
      const lines = wrapText(regular, `${idx + 1}. ${a.text}`, 12, maxWidth)
      
      let y = cursorY
      lines.forEach(line => {
        page.drawText(line, { x: margin, y: y - 12, size: 12, font: regular })
        y -= 18
      })
      cursorY = y - 6
      page.drawRectangle({ x: margin, y: cursorY - fieldHeight, width: contentWidth, height: fieldHeight, borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 1, color: rgb(0.97, 0.97, 0.98) })
      cursorY -= fieldHeight + 16
    })
  }

  const drawTest = () => {
    // Force new page for Test
    page = addPage()
    cursorY = h - margin
    
    drawSectionTitle('Мини-тест', 'test')
    
    // Calculate if we can fit all 10 on one page
    // Approx height per question: 3 lines text (50pt) + 3 options (66pt) + gap (12pt) ~ 130pt.
    // 10 questions = 1300pt > 842pt. So likely need 2 pages.
    // User wants: if impossible to fit on 1, split evenly (5 and 5).
    
    const itemsPerPage = 5
    
    worksheet.test.forEach((q, i) => {
      if (i === itemsPerPage) {
        page = addPage()
        cursorY = h - margin
      }

      const maxWidth = contentWidth
      const lines = wrapText(regular, `${i + 1}. ${q.question}`, 12, maxWidth)
      const textHeight = lines.length * (12 + 6)
      ensure(textHeight + 22 * q.options.length + 12)
      let y = cursorY
      lines.forEach(line => {
        page.drawText(line, { x: margin, y: y - 12, size: 12, font: regular })
        y -= 18
      })
      q.options.forEach((opt, idx) => {
        const circleX = margin
        const circleY = y - 10
        page.drawCircle({ x: circleX + 8, y: circleY, size: 7, borderColor: rgb(0.75, 0.75, 0.8), borderWidth: 1 })
        page.drawText(String.fromCharCode(65 + idx), { x: circleX + 5, y: circleY - 4, size: 10, font: bold, color: rgb(0.45, 0.45, 0.5) })
        page.drawText(opt, { x: circleX + 24, y: circleY - 4, size: 12, font: regular })
        y -= 22
      })
      cursorY = y - 12
    })
  }

  const drawEvaluationNotes = () => {
    // Force new page for Evaluation + Notes
    page = addPage()
    cursorY = h - margin
    
    drawSectionTitle('Оценка урока', 'other')
    const items = ['Все понял', 'Было немного сложно', 'Нужна помощь']
    let y = cursorY
    items.forEach(t => {
      page.drawRectangle({ x: margin, y: y - 14, width: 14, height: 14, borderColor: rgb(0.7, 0.7, 0.75), borderWidth: 1, color: rgb(1, 1, 1) })
      page.drawText(t, { x: margin + 22, y: y - 12, size: 12, font: regular })
      y -= 22
    })
    cursorY = y - 20
    
    drawSectionTitle('Заметки', 'other')
    const lines = 20 // More lines since it's a separate page
    let ly = cursorY - 10
    for (let i = 0; i < lines; i++) {
      page.drawLine({ start: { x: margin, y: ly }, end: { x: margin + contentWidth, y: ly }, color: rgb(0.85, 0.85, 0.9), thickness: 1 })
      ly -= 24
    }
    cursorY = ly - 10
  }

  const drawAnswersTwoColumns = () => {
    page = addPage()
    cursorY = h - margin
    drawSectionTitle('Ответы', 'other')
    const gap = 20
    const colWidth = (contentWidth - gap) / 2
    const leftX = margin
    const rightX = margin + colWidth + gap
    let yLeft = cursorY
    let yRight = cursorY
    const assign = worksheet.answers.assignments
    const test = worksheet.answers.test
    page.drawText('Задания', { x: leftX, y: yLeft - 14, size: 14, font: bold })
    yLeft -= 22
    page.drawText('Мини-тест', { x: rightX, y: yRight - 14, size: 14, font: bold })
    yRight -= 22
    assign.forEach((ans, i) => {
      const text = `${i + 1}. ${ans}`
      const lines = wrapText(regular, text, 12, colWidth)
      lines.forEach(line => {
        page.drawText(line, { x: leftX, y: yLeft - 12, size: 12, font: regular })
        yLeft -= 16
      })
    })
    test.forEach((ans, i) => {
      const text = `${i + 1}. ${ans}`
      const lines = wrapText(regular, text, 12, colWidth)
      lines.forEach(line => {
        page.drawText(line, { x: rightX, y: yRight - 12, size: 12, font: regular })
        yRight -= 16
      })
    })
  }

  drawHeader()
  drawAssignments()
  drawTest()
  drawEvaluationNotes()
  drawAnswersTwoColumns()

  const pdfBytes = await pdfDoc.save()
  return new Blob([pdfBytes as any], { type: 'application/pdf' })
}

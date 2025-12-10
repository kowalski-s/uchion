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

  const drawAssignments = () => {
    ensure(24)
    drawText('Задания', 16, bold)
    const fieldHeight = 100 // Reduced from 120 to fit 8 assignments on 2 pages
    worksheet.assignments.forEach((a, i) => {
      const maxWidth = contentWidth
      const lines = wrapText(regular, `${i + 1}. ${a.text}`, 12, maxWidth)
      const textHeight = lines.length * (12 + 6)
      ensure(textHeight + fieldHeight + 10) // Reduced buffer
      let y = cursorY
      lines.forEach(line => {
        page.drawText(line, { x: margin, y: y - 12, size: 12, font: regular })
        y -= 18
      })
      cursorY = y - 6
      page.drawRectangle({ x: margin, y: cursorY - fieldHeight, width: contentWidth, height: fieldHeight, borderColor: rgb(0.8, 0.8, 0.85), borderWidth: 1, color: rgb(0.97, 0.97, 0.98) })
      cursorY -= fieldHeight + 16 // Reduced gap between assignments
    })
  }

  const drawTest = () => {
    // Force new page for Test
    page = addPage()
    cursorY = h - margin
    
    drawText('Мини-тест', 16, bold)
    worksheet.test.forEach((q, i) => {
      // Split 5 questions per page if requested
      if (i === 5) {
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
    
    drawText('Оценка урока', 16, bold)
    const items = ['Все понял', 'Было немного сложно', 'Нужна помощь']
    let y = cursorY
    items.forEach(t => {
      page.drawRectangle({ x: margin, y: y - 14, width: 14, height: 14, borderColor: rgb(0.7, 0.7, 0.75), borderWidth: 1, color: rgb(1, 1, 1) })
      page.drawText(t, { x: margin + 22, y: y - 12, size: 12, font: regular })
      y -= 22
    })
    cursorY = y - 20
    
    drawText('Заметки', 16, bold)
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
    drawText('Ответы', 16, bold)
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

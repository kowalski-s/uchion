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

    // Title centered with auto-scaling
    let titleSize = 24
    const title = worksheet.topic
    let titleWidth = bold.widthOfTextAtSize(title, titleSize)
    
    // Scale down if title is too wide
    while (titleWidth > contentWidth && titleSize > 14) {
      titleSize -= 1
      titleWidth = bold.widthOfTextAtSize(title, titleSize)
    }

    const centerX = margin + (contentWidth - titleWidth) / 2
    page.drawText(title, { x: centerX, y: cursorY - titleSize, size: titleSize, font: bold })
    cursorY -= titleSize + 16
  }

  const drawSectionTitle = (text: string, type: 'assignment' | 'test' | 'other') => {
    // Revert to simple text title without icons for PDF download as requested
    // "in pdf (downloading) you can remove these icons"
    
    // We still keep the spacing
    page.drawText(text, { x: margin, y: cursorY - 16, size: 16, font: bold, color: rgb(0, 0, 0) })
    cursorY -= 32
  }

  const calculateBlockHeight = (type: 'assignment' | 'test' | 'note' | 'answer', data: any, font: any) => {
    if (type === 'assignment') {
      // data is assignment object
      const lines = wrapText(font, `${data.index + 1}. ${data.text}`, 12, contentWidth)
      const textHeight = lines.length * (12 + 6)
      const fieldHeight = data.fieldHeight || 80
      return textHeight + fieldHeight + 16 // text + field + margin
    } else if (type === 'test') {
      // data is test question object
      const lines = wrapText(font, `${data.index + 1}. ${data.question}`, 12, contentWidth)
      const textHeight = lines.length * (12 + 6)
      const optionsHeight = data.options.length * 22
      return textHeight + optionsHeight + 20 // text + options + margin
    } else if (type === 'note') {
      return 300 + 40 // fixed block height
    } else if (type === 'answer') {
        return 20 // simplified
    }
    return 0
  }

  const checkPageBreak = (needed: number) => {
    if (cursorY - needed < margin) {
      page = addPage()
      cursorY = h - margin
      return true
    }
    return false
  }

  // Debug flag to visualize block boundaries
  const DEBUG_LAYOUT = false

  const drawDebugRect = (height: number) => {
    if (!DEBUG_LAYOUT) return
    page.drawRectangle({
      x: margin - 2,
      y: cursorY - height,
      width: contentWidth + 4,
      height: height,
      borderColor: rgb(0.8, 0.8, 0.8), // light grey
      borderWidth: 1,
      color: undefined,
    })
  }

  const drawAssignments = () => {
    // Header is already drawn.
    drawSectionTitle('Задания', 'assignment')
    
    const standardFieldHeight = 80
    const MIN_FIELD_HEIGHT = 40

    worksheet.assignments.forEach((a, i) => {
      // Calculate standard height
      let fieldHeight = standardFieldHeight
      let height = calculateBlockHeight('assignment', { ...a, index: i, fieldHeight }, regular)
      
      // Flexible Last Assignment Logic
      // If this is the last assignment in the list, and it doesn't fit...
      if (i === worksheet.assignments.length - 1) {
         if (cursorY - height < margin) {
             // It doesn't fit. Can we shrink the field?
             const remainingSpace = cursorY - margin
             const textOnlyHeight = calculateBlockHeight('assignment', { ...a, index: i, fieldHeight: 0 }, regular)
             // height = textHeight + fieldHeight + 16
             // textOnlyHeight = textHeight + 0 + 16
             
             // We need: textOnlyHeight + adjustedFieldHeight <= remainingSpace
             const maxPossibleField = remainingSpace - textOnlyHeight
             
             if (maxPossibleField >= MIN_FIELD_HEIGHT) {
                 // We can fit it by shrinking!
                 fieldHeight = maxPossibleField
                 height = calculateBlockHeight('assignment', { ...a, index: i, fieldHeight }, regular)
             }
         }
      }

      checkPageBreak(height)
      drawDebugRect(height)
      
      const maxWidth = contentWidth
      const lines = wrapText(regular, `${i + 1}. ${a.text}`, 12, maxWidth)

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
    // Force new page for Test if requested, or just flow it?
    // User requested "Unit height check". 
    // Let's first check if we need a new page for the Title itself
    
    if (checkPageBreak(50)) {
        // Title on new page
    } else {
        // Maybe force new page for test start as per previous design?
        // User said "All 8 tasks, mini-test ... should be processed equally".
        // But previously we had "Force new page for Test". 
        // Let's keep "Force new page" for the *section start* to keep it clean, then flow questions.
        page = addPage()
        cursorY = h - margin
    }

    drawSectionTitle('Мини-тест', 'test')
    
    worksheet.test.forEach((q, i) => {
      const height = calculateBlockHeight('test', { ...q, index: i }, regular)
      checkPageBreak(height)
      drawDebugRect(height)

      const maxWidth = contentWidth
      const lines = wrapText(regular, `${i + 1}. ${q.question}`, 12, maxWidth)
      
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
    // Evaluation block height ~ 100
    // Notes block height ~ 300
    // Total ~ 400
    
    // Force new page if it doesn't fit heavily, but usually we put it on new page
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
    
    // Notes block
    // Check if fits
    const notesHeight = 300
    checkPageBreak(notesHeight + 40)
    drawDebugRect(notesHeight + 40)

    drawSectionTitle('Заметки', 'other')
    const lines = 20 
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

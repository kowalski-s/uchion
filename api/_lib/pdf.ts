import PDFDocument from 'pdfkit'
import type { Worksheet, GeneratePayload } from '../../shared/types'
import path from 'path'
import { fileURLToPath } from 'url'

export async function buildPdf(worksheet: Worksheet, meta: GeneratePayload): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []
    doc.on('data', d => chunks.push(Buffer.from(d)))
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve(buffer.toString('base64'))
    })
    doc.on('error', reject)

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    
    const possiblePaths = [
      path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf'),
      path.join(__dirname, '../_assets/fonts/Inter-Regular.ttf'),
      path.join(process.cwd(), 'api/_assets/fonts/Inter-Regular.ttf'),
      path.join(process.cwd(), '_assets/fonts/Inter-Regular.ttf'),
    ]

    let fontName = 'Helvetica'
    for (const p of possiblePaths) {
      try {
        doc.registerFont('CustomBody', p)
        fontName = 'CustomBody'
        break
      } catch (e) {
        // Ignore
      }
    }

    if (fontName === 'Helvetica') {
      console.warn('[PDF] Custom font not found, using Helvetica. Cyrillic may be broken.')
    }

    // --- PAGE 1: CONTENT ---

    // Topic
    doc.font(fontName).fontSize(20).text(worksheet.topic, { align: 'center' })
    doc.moveDown(0.5)

    // Name/Date
    doc.font(fontName).fontSize(10).text('Имя: ___________________________________   Дата: ________________', { align: 'right' })
    doc.moveDown(1)

    // Assignments
    doc.font(fontName).fontSize(14).text('Задания')
    doc.moveDown(0.5)
    worksheet.assignments.forEach((task, i) => {
      doc.font(fontName).fontSize(11).text(`✏️ ${i + 1}. ${task.text}`, { lineGap: 5 })
      doc.moveDown(0.5)
      // Space for answer
      doc.fillColor('#9ca3af').font(fontName).fontSize(10).text('__________________________________________________________________________')
      doc.fillColor('#000000').moveDown(1)
    })
    
    // Check if we need a new page for Test (simple heuristic)
    if (doc.y > 650) {
      doc.addPage()
    } else {
      doc.moveDown(2)
    }

    // --- TEST & EVALUATION ---

    // Test
    doc.font(fontName).fontSize(14).text('📝 Мини-тест')
    doc.moveDown(0.5)
    
    const letters = ['A', 'B', 'C', 'D']
    worksheet.test.forEach((q, i) => {
      // Check for page break inside test
      if (doc.y > 720) doc.addPage()

      doc.font(fontName).fontSize(11).text(`${i + 1}. ${q.question}`)
      doc.moveDown(0.3)
      if (q.options) {
        q.options.forEach((opt, idx) => {
           doc.font(fontName).fontSize(10).text(`   ${letters[idx]}) ${opt}`, { indent: 15 })
        })
      }
      doc.moveDown(1)
    })

    if (doc.y > 650) doc.addPage()
    doc.moveDown(2)

    // Self Evaluation
    doc.font(fontName).fontSize(12).text('😊 Самооценка:')
    doc.moveDown(0.5)
    doc.font(fontName).fontSize(10).text('[   ] Все понял', { indent: 20 })
    doc.font(fontName).fontSize(10).text('[   ] Было немного сложно', { indent: 20 })
    doc.font(fontName).fontSize(10).text('[   ] Нужна помощь', { indent: 20 })

    doc.moveDown(2)

    // Notes
    doc.font(fontName).fontSize(12).text('📝 Заметки:')
    doc.moveDown(0.5)
    doc.font(fontName).fontSize(10).text('__________________________________________________________________________')
    doc.moveDown(0.5)
    doc.font(fontName).fontSize(10).text('__________________________________________________________________________')

    doc.addPage()

    // --- TEACHER ANSWERS (2 Columns) ---

    doc.font(fontName).fontSize(16).text('🔍 Ответы для учителя', { align: 'center' })
    doc.moveDown(2)

    const startY = doc.y
    const colWidth = 250
    const gap = 20

    // Column 1: Assignments
    doc.text('Задания', 40, startY, { width: colWidth, align: 'left' })
    doc.moveDown(0.5)
    if (worksheet.answers && worksheet.answers.assignments) {
      worksheet.answers.assignments.forEach((ans, i) => {
        doc.font(fontName).fontSize(11).text(`${i + 1}: ${ans}`, { lineGap: 5, width: colWidth })
      })
    }

    // Column 2: Test
    // Reset Y to top of columns
    doc.y = startY
    doc.text('Мини-тест', 40 + colWidth + gap, startY, { width: colWidth, align: 'left' })
    doc.moveDown(0.5)
    if (worksheet.answers && worksheet.answers.test) {
      worksheet.answers.test.forEach((ans, i) => {
        doc.text(`${i + 1} — ${ans}`, 40 + colWidth + gap, doc.y, { lineGap: 5, width: colWidth })
      })
    }

    doc.end()
  })
}

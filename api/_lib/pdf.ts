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
    doc.moveDown(1)

    // Summary
    doc.font(fontName).fontSize(14).text('Краткий конспект')
    doc.moveDown(0.5)
    doc.font(fontName).fontSize(11).text(worksheet.summary, { align: 'justify', lineGap: 3 })
    doc.moveDown(1.5)

    // Cheatsheet
    if (worksheet.cheatsheet && worksheet.cheatsheet.length > 0) {
      doc.rect(doc.x, doc.y, 515, 15 + worksheet.cheatsheet.length * 20).fillAndStroke('#f3f4f6', '#e5e7eb')
      doc.fill('#000000')
      doc.moveDown(0.5)
      doc.font(fontName).fontSize(12).text('⚡ Шпаргалка', { indent: 10 })
      doc.moveDown(0.5)
      worksheet.cheatsheet.forEach(item => {
        doc.font(fontName).fontSize(10).text(`• ${item}`, { indent: 20, lineGap: 5 })
      })
      doc.moveDown(2)
    }

    // Assignments
    doc.moveDown(1)
    doc.font(fontName).fontSize(10).text('Имя: ___________________________________   Дата: ________________', { align: 'right' })
    doc.moveDown(1)
    doc.font(fontName).fontSize(14).text('Задания')
    doc.moveDown(0.5)
    worksheet.assignments.forEach((task, i) => {
      doc.font(fontName).fontSize(11).text(`✏️ ${i + 1}. ${task.text}`, { lineGap: 5 })
      doc.moveDown(0.5)
      // Space for answer
      doc.font(fontName).fontSize(10).text('__________________________________________________________________________', { color: '#9ca3af' })
      doc.moveDown(1)
      doc.fillColor('#000000')
    })
    
    doc.addPage()

    // --- PAGE 2: TEST & EVALUATION ---

    // Test
    doc.font(fontName).fontSize(14).text('📝 Мини-тест')
    doc.moveDown(0.5)
    
    const letters = ['A', 'B', 'C', 'D']
    worksheet.test.forEach((q, i) => {
      doc.font(fontName).fontSize(11).text(`${i + 1}. ${q.question}`)
      doc.moveDown(0.3)
      if (q.options) {
        q.options.forEach((opt, idx) => {
           doc.font(fontName).fontSize(10).text(`   ${letters[idx]}) ${opt}`, { indent: 15 })
        })
      }
      doc.moveDown(1)
    })

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

    // --- PAGE 3: TEACHER ANSWERS ---

    doc.font(fontName).fontSize(16).text('🔍 Ответы для учителя', { align: 'center' })
    doc.moveDown(2)

    doc.font(fontName).fontSize(14).text('Задания')
    doc.moveDown(0.5)
    if (worksheet.answers && worksheet.answers.assignments) {
      worksheet.answers.assignments.forEach((ans, i) => {
        doc.font(fontName).fontSize(11).text(`${i + 1}: ${ans}`, { lineGap: 5 })
      })
    }
    doc.moveDown(1.5)

    doc.font(fontName).fontSize(14).text('Мини-тест')
    doc.moveDown(0.5)
    if (worksheet.answers && worksheet.answers.test) {
      worksheet.answers.test.forEach((ans, i) => {
        doc.font(fontName).fontSize(11).text(`${i + 1} — ${ans}`, { lineGap: 5 })
      })
    }

    doc.end()
  })
}

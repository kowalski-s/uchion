import PDFDocument from 'pdfkit'
import type { Worksheet, GeneratePayload } from '../../shared/types'
import path from 'path'
import { fileURLToPath } from 'url'

export async function buildPdf(worksheet: Worksheet, meta: GeneratePayload): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', d => chunks.push(Buffer.from(d)))
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks)
      resolve(buffer.toString('base64'))
    })
    doc.on('error', reject)

    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const fontPath = path.join(__dirname, '../_assets/fonts/Inter-Regular.ttf')
    try {
      doc.registerFont('Body', fontPath)
    } catch (e) {}

    // Title
    doc.font('Body').fontSize(20).text(meta.topic, { align: 'center' })
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(`${worksheet.subject}, ${worksheet.grade}`, { align: 'center', color: 'grey' })
    doc.moveDown(1.5)

    // Goal
    doc.font('Body').fontSize(12).text('Цель урока: ', { continued: true, stroke: true })
    doc.font('Body').fontSize(12).text(worksheet.goal)
    doc.moveDown()

    // Summary (Conspect)
    doc.font('Body').fontSize(16).text('Конспект урока')
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(worksheet.summary, { align: 'justify', lineGap: 2 })
    doc.moveDown(1.5)

    // Examples
    doc.font('Body').fontSize(16).text('Примеры')
    doc.moveDown(0.5)
    worksheet.examples.forEach(ex => {
      doc.font('Body').fontSize(12).text(`• ${ex}`, { indent: 10, lineGap: 2 })
    })
    doc.moveDown(1.5)

    // Tasks
    doc.font('Body').fontSize(16).text('Задания')
    doc.moveDown(0.5)
    worksheet.tasks.forEach((task, i) => {
      doc.font('Body').fontSize(12).text(`${i + 1}. ${task}`, { lineGap: 5 })
    })
    doc.moveDown(1.5)

    // Test
    doc.font('Body').fontSize(16).text('Мини-тест')
    doc.moveDown(0.5)
    const letters = ['A', 'B', 'C', 'D', 'E', 'F']
    
    worksheet.test.forEach((q, i) => {
      doc.font('Body').fontSize(12).text(`${i + 1}. ${q.question}`)
      
      if (q.options && q.options.length > 0) {
        doc.moveDown(0.3)
        // Grid layout simulation or just list
        q.options.forEach((opt, idx) => {
          doc.font('Body').fontSize(11).text(`   ${letters[idx]}) ${opt}`, { indent: 15 })
        })
      } else {
        doc.moveDown(0.3)
        doc.font('Body').fontSize(11).text('   Ответ: _______________', { indent: 15 })
      }
      doc.moveDown(1)
    })

    doc.end()
  })
}

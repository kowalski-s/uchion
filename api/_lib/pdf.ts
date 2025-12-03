import PDFDocument from 'pdfkit'
import type { Worksheet, GeneratePayload } from '../../shared/types'

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

    doc.fontSize(18).text(meta.topic, { align: 'center' })
    doc.moveDown()
    doc.fontSize(12).text(`Предмет: ${meta.subject}. Класс: ${meta.grade}.`)
    doc.moveDown()
    doc.fontSize(14).text('Краткий конспект')
    doc.moveDown(0.5)
    doc.fontSize(12).text(worksheet.summary, { align: 'left' })
    doc.moveDown()
    doc.fontSize(14).text('Задания по теме')
    doc.moveDown(0.5)
    worksheet.tasks.forEach((t, i) => {
      doc.fontSize(12).text(`${i + 1}. ${t.type}: ${t.text}`)
      doc.moveDown(0.5)
    })
    doc.moveDown()
    doc.fontSize(14).text('Вопросы для закрепления')
    doc.moveDown(0.5)
    worksheet.questions.forEach((q, i) => {
      doc.fontSize(12).text(`${i + 1}. ${q}`)
      doc.moveDown(0.25)
    })

    doc.end()
  })
}

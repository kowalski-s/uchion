import PDFDocument from 'pdfkit'
import type { Worksheet, GeneratePayload, TestQuestion } from '../../shared/types'
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

    doc.font('Body').fontSize(18).text(worksheet.conspect.lessonTitle || meta.topic, { align: 'center' })
    doc.moveDown()
    doc.font('Body').fontSize(12).text(`Предмет: ${worksheet.subject}. Класс: ${worksheet.grade}.`)
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Цель урока')
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(worksheet.conspect.goal, { align: 'left' })
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Введение')
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(worksheet.conspect.introduction, { align: 'left' })
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Шаги объяснения')
    doc.moveDown(0.5)
    worksheet.conspect.steps.forEach((step, idx) => {
      doc.font('Body').fontSize(12).text(`Шаг ${idx + 1}. ${step.title}: ${step.text}`)
      doc.moveDown(0.5)
    })
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Мини‑практика')
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(worksheet.conspect.miniPractice)
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Пример с ошибкой')
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(worksheet.conspect.analysisExample)
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Мини‑вывод')
    doc.moveDown(0.5)
    doc.font('Body').fontSize(12).text(worksheet.conspect.miniConclusion)
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Задания по методу Блума')
    doc.moveDown(0.5)
    worksheet.bloomTasks.forEach((t, i) => {
      doc.font('Body').fontSize(12).text(`${i + 1}. [${t.title}] ${t.task}`)
      doc.moveDown(0.5)
    })
    doc.moveDown()

    doc.font('Body').fontSize(14).text('Мини‑тест')
    doc.moveDown(0.5)
    const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е']
    worksheet.test.forEach((q, i) => {
      if (q.type === 'single') {
        doc.font('Body').fontSize(12).text(`${i + 1}. ${q.question}`)
        q.options.forEach((opt, idx) => {
          doc.font('Body').fontSize(12).text(`   ${letters[idx]}. ${opt}`)
        })
      } else if (q.type === 'multi_or_task') {
        doc.font('Body').fontSize(12).text(`${i + 1}. ${q.question}`)
        if (q.options && q.options.length > 0) {
          q.options.forEach((opt, idx) => {
            doc.font('Body').fontSize(12).text(`   ${letters[idx]}. ${opt}`)
          })
        }
      } else {
        doc.font('Body').fontSize(12).text(`${i + 1}. ${q.question}`)
        doc.font('Body').fontSize(12).text('   Ответ: ____________')
      }
      doc.moveDown(0.5)
    })

    doc.end()
  })
}

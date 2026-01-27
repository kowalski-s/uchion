// api/_lib/pdf.ts
import puppeteer from 'puppeteer-core'
import type { Worksheet, GeneratePayload } from '../../shared/types'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Find Chrome executable for local development
function findLocalChrome(): string | null {
  const possiblePaths: string[] = []

  if (process.platform === 'win32') {
    possiblePaths.push(
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    )
  } else if (process.platform === 'darwin') {
    possiblePaths.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    )
  } else {
    possiblePaths.push(
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
    )
  }

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        return p
      }
    } catch {
      // Continue to next path
    }
  }
  return null
}

// Check if we're running in serverless environment
function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY)
}

// Load Inter font as base64 for embedding in HTML
function loadFontAsBase64(): { regular: string; bold: string } | null {
  const possiblePaths = [
    {
      regular: path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf'),
      bold: path.join(process.cwd(), 'public/fonts/Inter-Bold.ttf'),
    },
    {
      regular: path.join(__dirname, '../_assets/fonts/Inter-Regular.ttf'),
      bold: path.join(__dirname, '../_assets/fonts/Inter-Bold.ttf'),
    },
  ]

  for (const paths of possiblePaths) {
    try {
      if (fs.existsSync(paths.regular)) {
        const regularBuffer = fs.readFileSync(paths.regular)
        const boldBuffer = fs.existsSync(paths.bold)
          ? fs.readFileSync(paths.bold)
          : regularBuffer
        return {
          regular: regularBuffer.toString('base64'),
          bold: boldBuffer.toString('base64'),
        }
      }
    } catch (e) {
      // Continue to next path
    }
  }
  return null
}

// Helper to determine if answer field should be shown
function shouldShowAnswerField(text: string): boolean {
  // Don't show answer field for matching tasks
  if (text.startsWith('<!--MATCHING:')) return false
  const lower = text.toLowerCase()
  const hiddenKeywords = ['подчеркни', 'обведи', 'зачеркни', 'раскрась', 'соедини']
  return !hiddenKeywords.some(k => lower.includes(k))
}

// Parse matching task data from text
interface MatchingData {
  type: 'matching'
  instruction: string
  leftColumn: string[]
  rightColumn: string[]
}

function parseMatchingData(text: string): MatchingData | null {
  const match = text.match(/<!--MATCHING:(.*?)-->/)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as MatchingData
  } catch {
    return null
  }
}

// Render matching task as HTML
function renderMatchingHtml(data: MatchingData): string {
  const leftItems = data.leftColumn.map((item, i) =>
    `<div class="matching-item matching-left"><span class="matching-number">${i + 1}.</span> ${escapeHtml(item)}</div>`
  ).join('')

  const rightItems = data.rightColumn.map((item, i) =>
    `<div class="matching-item matching-right"><span class="matching-letter">${String.fromCharCode(1072 + i)})</span> ${escapeHtml(item)}</div>`
  ).join('')

  return `
    <div class="matching-instruction">${escapeHtml(data.instruction)}</div>
    <div class="matching-columns">
      <div class="matching-column">${leftItems}</div>
      <div class="matching-column">${rightItems}</div>
    </div>
  `
}

// Generate HTML template for the worksheet
function generateWorksheetHtml(worksheet: Worksheet): string {
  const fonts = loadFontAsBase64()

  const fontFaceCSS = fonts ? `
    @font-face {
      font-family: 'Inter';
      src: url(data:font/truetype;base64,${fonts.regular}) format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter';
      src: url(data:font/truetype;base64,${fonts.bold}) format('truetype');
      font-weight: 700;
      font-style: normal;
    }
  ` : ''

  const assignmentsHtml = worksheet.assignments.map((task, i) => {
    const matchingData = parseMatchingData(task.text)

    if (matchingData) {
      return `
        <div class="task-block">
          <div class="task-text">
            <span class="task-number">${i + 1}.</span>
          </div>
          ${renderMatchingHtml(matchingData)}
        </div>
      `
    }

    return `
      <div class="task-block">
        <div class="task-text">
          <span class="task-number">${i + 1}.</span>
          ${escapeHtml(task.text)}
        </div>
        ${shouldShowAnswerField(task.text) ? '<div class="answer-field"></div>' : ''}
      </div>
    `
  }).join('')

  const testHtml = worksheet.test.map((q, i) => `
    <div class="test-question">
      <div class="question-text">
        <span class="question-number">${i + 1}.</span>
        ${escapeHtml(q.question)}
      </div>
      <div class="options">
        ${q.options.map((opt, idx) => `
          <div class="option">
            <div class="option-letter">${String.fromCharCode(65 + idx)}</div>
            <span class="option-text">${escapeHtml(opt)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')

  const assignmentAnswersHtml = worksheet.answers.assignments.map((ans, i) => `
    <li class="answer-item">
      <span class="answer-number">${i + 1}.</span>
      ${escapeHtml(ans)}
    </li>
  `).join('')

  const testAnswersHtml = worksheet.answers.test.map((ans, i) => `
    <li class="answer-item-inline">
      <span class="answer-number">${i + 1}.</span>
      ${escapeHtml(ans)}
    </li>
  `).join('')

  const notesLinesHtml = Array.from({ length: 14 }).map(() => '<div class="note-line"></div>').join('')

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worksheet.topic)}</title>
  <style>
    ${fontFaceCSS}

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #111827;
      background: white;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm;
      background: white;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f3f4f6;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .logo {
      font-size: 24px;
      font-weight: bold;
      color: #4f46e5;
    }

    .meta-fields {
      font-size: 11px;
      color: #6b7280;
    }

    .meta-field {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .meta-line {
      flex: 1;
      min-width: 180px;
      border-bottom: 1px solid #d1d5db;
    }

    /* Title */
    .title {
      text-align: center;
      font-size: 24px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 24px;
    }

    /* Section titles */
    .section-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 18px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 20px;
    }

    .section-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: #4f46e5;
      color: white;
      border-radius: 6px;
      font-size: 14px;
      font-weight: bold;
    }

    /* Tasks/Assignments */
    .task-block {
      margin-bottom: 24px;
      page-break-inside: avoid;
    }

    .task-text {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
      line-height: 1.6;
      margin-bottom: 12px;
    }

    .task-number {
      color: #4f46e5;
      margin-right: 8px;
    }

    .answer-field {
      height: 120px;
      border: 2px dashed #e5e7eb;
      border-radius: 8px;
      background: rgba(249, 250, 251, 0.3);
    }

    /* Matching task styles */
    .matching-instruction {
      font-size: 13px;
      color: #374151;
      margin-bottom: 16px;
      margin-left: 24px;
    }

    .matching-columns {
      display: flex;
      gap: 32px;
      margin-left: 24px;
    }

    .matching-column {
      flex: 1;
    }

    .matching-item {
      padding: 10px 14px;
      margin-bottom: 10px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 12px;
      color: #374151;
    }

    .matching-number, .matching-letter {
      font-weight: bold;
      color: #4f46e5;
      margin-right: 8px;
    }

    /* Test questions */
    .test-question {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 16px;
      background: white;
      page-break-inside: avoid;
    }

    .question-text {
      font-size: 13px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 12px;
    }

    .question-number {
      margin-right: 8px;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .option {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .option-letter {
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e5e7eb;
      border-radius: 50%;
      font-size: 11px;
      font-weight: bold;
      color: #6b7280;
      flex-shrink: 0;
    }

    .option-text {
      font-size: 12px;
      color: #374151;
    }

    /* Evaluation */
    .evaluation-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .evaluation-title {
      font-weight: bold;
      color: #111827;
      margin-bottom: 16px;
    }

    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .checkbox {
      width: 20px;
      height: 20px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: white;
      flex-shrink: 0;
    }

    /* Notes */
    .notes-section {
      background: #f9fafb;
      border-radius: 12px;
      padding: 24px;
      min-height: 400px;
    }

    .notes-title {
      font-weight: bold;
      color: #111827;
      margin-bottom: 16px;
    }

    .note-line {
      border-bottom: 1px solid #d1d5db;
      height: 32px;
    }

    /* Answers page */
    .answers-title {
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 32px;
    }

    .answers-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }

    .answers-grid.single-column {
      grid-template-columns: 1fr;
    }

    .answers-column h3 {
      font-size: 16px;
      font-weight: bold;
      color: #4f46e5;
      margin-bottom: 16px;
    }

    .answers-list {
      list-style: none;
    }

    .answer-item {
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 12px;
      font-size: 12px;
      color: #374151;
      page-break-inside: avoid;
    }

    .answer-item-inline {
      display: flex;
      align-items: center;
      gap: 12px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 8px;
      padding: 12px 16px;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 500;
      color: #374151;
    }

    .answer-number {
      font-weight: bold;
      color: #6366f1;
      margin-right: 8px;
    }

    @media print {
      .page {
        margin: 0;
        padding: 10mm;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>
  <!-- PAGE 1: Assignments -->
  <div class="page">
    <div class="header">
      <div class="logo">УчиОн</div>
      <div class="meta-fields">
        <div class="meta-field">
          <span>Имя и фамилия:</span>
          <div class="meta-line"></div>
        </div>
        <div class="meta-field">
          <span>Дата:</span>
          <div class="meta-line"></div>
        </div>
      </div>
    </div>

    <h1 class="title">${escapeHtml(worksheet.topic)}</h1>

    <div class="section-title">
      <div class="section-badge">E</div>
      Задания
    </div>

    <div class="assignments">
      ${assignmentsHtml}
    </div>
  </div>

  ${worksheet.test.length > 0 ? `
  <!-- PAGE 2: Test -->
  <div class="page">
    <div class="section-title">
      <div class="section-badge">T</div>
      Мини-тест
    </div>

    <div class="test-questions">
      ${testHtml}
    </div>
  </div>
  ` : ''}

  <!-- PAGE 3: Evaluation & Notes -->
  <div class="page">
    <div class="evaluation-section">
      <div class="evaluation-title">Оценка урока</div>
      <div class="checkbox-item">
        <div class="checkbox"></div>
        <span>Все понял</span>
      </div>
      <div class="checkbox-item">
        <div class="checkbox"></div>
        <span>Было немного сложно</span>
      </div>
      <div class="checkbox-item">
        <div class="checkbox"></div>
        <span>Нужна помощь</span>
      </div>
    </div>

    <div class="notes-section">
      <div class="notes-title">Заметки</div>
      ${notesLinesHtml}
    </div>
  </div>

  <!-- PAGE 4: Answers -->
  <div class="page">
    <h2 class="answers-title">Ответы</h2>

    <div class="answers-grid${worksheet.test.length === 0 ? ' single-column' : ''}">
      <div class="answers-column">
        <h3>Задания</h3>
        <ul class="answers-list">
          ${assignmentAnswersHtml}
        </ul>
      </div>

      ${worksheet.test.length > 0 ? `
      <div class="answers-column">
        <h3>Мини-тест</h3>
        <ul class="answers-list">
          ${testAnswersHtml}
        </ul>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function buildPdf(worksheet: Worksheet, meta: GeneratePayload): Promise<string> {
  console.log('[PDF] Starting buildPdf...')
  console.log('[PDF] isServerless:', isServerless())

  let browser = null

  try {
    let executablePath: string
    let args: string[] = []

    if (isServerless()) {
      console.log('[PDF] Using @sparticuz/chromium for serverless')
      const chromium = await import('@sparticuz/chromium')
      executablePath = await chromium.default.executablePath()
      args = chromium.default.args
      console.log('[PDF] Serverless executablePath:', executablePath)
    } else {
      console.log('[PDF] Looking for local Chrome...')
      const localChrome = findLocalChrome()
      console.log('[PDF] Found local Chrome:', localChrome)

      if (!localChrome) {
        throw new Error('Chrome/Chromium not found. Please install Chrome or set CHROME_PATH environment variable.')
      }
      executablePath = process.env.CHROME_PATH || localChrome
      args = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ]
      console.log('[PDF] Using executablePath:', executablePath)
    }

    console.log('[PDF] Launching puppeteer...')
    browser = await puppeteer.launch({
      args,
      defaultViewport: {
        width: 794,
        height: 1123,
        deviceScaleFactor: 2,
      },
      executablePath,
      headless: true,
    })
    console.log('[PDF] Browser launched successfully')

    const page = await browser.newPage()
    console.log('[PDF] New page created')

    const html = generateWorksheetHtml(worksheet)
    console.log('[PDF] HTML generated, length:', html.length)

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    console.log('[PDF] Content set to page')

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0mm',
        right: '0mm',
        bottom: '0mm',
        left: '0mm',
      },
      preferCSSPageSize: true,
    })
    console.log('[PDF] PDF generated, buffer size:', pdfBuffer.length)

    const base64 = Buffer.from(pdfBuffer).toString('base64')
    console.log('[PDF] Base64 encoded, length:', base64.length)

    return base64
  } catch (error) {
    console.error('[PDF] Error generating PDF:', error)
    console.error('[PDF] Error stack:', error instanceof Error ? error.stack : 'no stack')
    throw error
  } finally {
    if (browser) {
      console.log('[PDF] Closing browser...')
      await browser.close()
      console.log('[PDF] Browser closed')
    }
  }
}

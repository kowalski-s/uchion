// api/_lib/pdf.ts
import puppeteer from 'puppeteer-core'
import type { Worksheet, GeneratePayload } from '../../shared/types'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

export type PdfTemplateId = 'standard' | 'rainbow' | 'academic'

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
    `<div class="matching-item matching-left"><span class="matching-number">${i + 1}.</span> ${processText(item)}</div>`
  ).join('')

  const rightItems = data.rightColumn.map((item, i) =>
    `<div class="matching-item matching-right"><span class="matching-letter">${String.fromCharCode(1072 + i)})</span> ${processText(item)}</div>`
  ).join('')

  return `
    <div class="matching-instruction">${processText(data.instruction)}</div>
    <div class="matching-columns">
      <div class="matching-column">${leftItems}</div>
      <div class="matching-column">${rightItems}</div>
    </div>
  `
}

// Dispatch to the correct template
function generateWorksheetHtml(worksheet: Worksheet, templateId: PdfTemplateId = 'standard'): string {
  if (templateId === 'rainbow') return generateRainbowHtml(worksheet)
  if (templateId === 'academic') return generateAcademicHtml(worksheet)
  return generateStandardHtml(worksheet)
}

// Standard (default) template
function generateStandardHtml(worksheet: Worksheet): string {
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

  // Build individual task HTML items
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
          ${processText(task.text)}
        </div>
        ${shouldShowAnswerField(task.text) ? '<div class="answer-field"></div>' : ''}
      </div>
    `
  }).join('')

  const testHtml = worksheet.test.map((q, i) => `
    <div class="test-question">
      <div class="question-text">
        <span class="question-number">${i + 1}.</span>
        ${processText(q.question)}
      </div>
      <div class="options">
        ${q.options.map((opt, idx) => `
          <div class="option">
            <div class="option-letter">${String.fromCharCode(65 + idx)}</div>
            <span class="option-text">${processText(opt)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('')

  const assignmentAnswersHtml = worksheet.answers.assignments.map((ans, i) => `
    <li class="answer-item">
      <span class="answer-number">${i + 1}.</span>
      ${processText(ans)}
    </li>
  `).join('')

  const testAnswersHtml = worksheet.answers.test.map((ans, i) => `
    <li class="answer-item-inline">
      <span class="answer-number">${i + 1}.</span>
      ${processText(ans)}
    </li>
  `).join('')

  const notesLinesHtml = Array.from({ length: 14 }).map(() => '<div class="note-line"></div>').join('')

  const hasAssignments = worksheet.assignments.length > 0
  const hasTest = worksheet.test.length > 0

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(worksheet.topic)}</title>
  <style>
    ${fontFaceCSS}

    @page {
      size: A4;
      margin: 12mm 14mm;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.4;
      color: #111827;
      background: white;
    }

    /* Content section — each starts on a new page, content flows naturally */
    .content-section {
      page-break-before: always;
    }

    .content-section:first-child {
      page-break-before: auto;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #f3f4f6;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }

    .logo {
      font-size: 22px;
      font-weight: bold;
      color: #4f46e5;
    }

    .meta-fields {
      font-size: 10px;
      color: #6b7280;
    }

    .meta-field {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .meta-line {
      flex: 1;
      min-width: 160px;
      border-bottom: 1px solid #d1d5db;
    }

    /* Title */
    .title {
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 16px;
    }

    /* Section titles */
    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 14px;
    }

    .section-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      background: #4f46e5;
      color: white;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
    }

    /* Tasks/Assignments */
    .task-block {
      margin-bottom: 14px;
      break-inside: avoid;
    }

    .task-text {
      font-size: 12px;
      font-weight: 500;
      color: #111827;
      line-height: 1.5;
      margin-bottom: 6px;
    }

    .task-number {
      color: #4f46e5;
      margin-right: 6px;
    }

    .answer-field {
      height: 56px;
      border: 1.5px dashed #d1d5db;
      border-radius: 6px;
      background: rgba(249, 250, 251, 0.3);
    }

    /* Matching task styles */
    .matching-instruction {
      font-size: 12px;
      color: #374151;
      margin-bottom: 10px;
      margin-left: 20px;
    }

    .matching-columns {
      display: flex;
      gap: 20px;
      margin-left: 20px;
    }

    .matching-column {
      flex: 1;
    }

    .matching-item {
      padding: 6px 10px;
      margin-bottom: 6px;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 11px;
      color: #374151;
    }

    .matching-number, .matching-letter {
      font-weight: bold;
      color: #4f46e5;
      margin-right: 6px;
    }

    /* Test questions */
    .test-question {
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 10px;
      background: white;
      break-inside: avoid;
    }

    .question-text {
      font-size: 12px;
      font-weight: 500;
      color: #111827;
      margin-bottom: 8px;
    }

    .question-number {
      margin-right: 6px;
    }

    .options {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .option {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .option-letter {
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid #e5e7eb;
      border-radius: 50%;
      font-size: 10px;
      font-weight: bold;
      color: #6b7280;
      flex-shrink: 0;
    }

    .option-text {
      font-size: 11px;
      color: #374151;
    }

    /* Evaluation */
    .evaluation-section {
      background: #f9fafb;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
    }

    .evaluation-title {
      font-weight: bold;
      color: #111827;
      margin-bottom: 12px;
    }

    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .checkbox {
      width: 18px;
      height: 18px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      background: white;
      flex-shrink: 0;
    }

    /* Notes */
    .notes-section {
      background: #f9fafb;
      border-radius: 10px;
      padding: 20px;
      min-height: 360px;
    }

    .notes-title {
      font-weight: bold;
      color: #111827;
      margin-bottom: 14px;
    }

    .note-line {
      border-bottom: 1px solid #d1d5db;
      height: 28px;
    }

    /* Answers page */
    .answers-title {
      text-align: center;
      font-size: 18px;
      font-weight: bold;
      color: #111827;
      margin-bottom: 24px;
    }

    .answers-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .answers-grid.single-column {
      grid-template-columns: 1fr;
    }

    .answers-column h3 {
      font-size: 14px;
      font-weight: bold;
      color: #4f46e5;
      margin-bottom: 12px;
    }

    .answers-list {
      list-style: none;
    }

    .answer-item {
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 6px;
      padding: 8px 10px;
      margin-bottom: 8px;
      font-size: 11px;
      color: #374151;
      break-inside: avoid;
    }

    .answer-item-inline {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f9fafb;
      border: 1px solid #f3f4f6;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 500;
      color: #374151;
    }

    .answer-number {
      font-weight: bold;
      color: #6366f1;
      margin-right: 6px;
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  ${hasAssignments ? `
  <!-- Assignments section -->
  <div class="content-section">
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
  ` : ''}

  ${hasTest ? `
  <!-- Test section -->
  <div class="content-section">
    ${!hasAssignments ? `
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
    ` : ''}

    <div class="section-title">
      <div class="section-badge">T</div>
      Мини-тест
    </div>

    <div class="test-questions">
      ${testHtml}
    </div>
  </div>
  ` : ''}

  <!-- Evaluation & Notes -->
  <div class="content-section">
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

  <!-- Answers -->
  <div class="content-section">
    <h2 class="answers-title">Ответы</h2>

    <div class="answers-grid${!hasAssignments || !hasTest ? ' single-column' : ''}">
      ${hasAssignments ? `
      <div class="answers-column">
        <h3>Задания</h3>
        <ul class="answers-list">
          ${assignmentAnswersHtml}
        </ul>
      </div>
      ` : ''}

      ${hasTest ? `
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

// Rainbow (Радуга) template — colorful, child-friendly style
function generateRainbowHtml(worksheet: Worksheet): string {
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

  const taskColors = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ec4899', '#eab308']
  const optionColors = ['#22c55e', '#f97316', '#3b82f6', '#a855f7', '#ec4899']
  const optionLetters = ['А', 'Б', 'В', 'Г', 'Д']
  const dotColors = ['#fda4af', '#fcd34d', '#93c5fd', '#86efac', '#c4b5fd', '#fdba74', '#f9a8d4', '#67e8f9', '#a7f3d0', '#fde047', '#d8b4fe', '#6ee7b7', '#fca5a5', '#bfdbfe', '#fcd34d', '#a5f3fc', '#fdba74', '#d9f99d', '#93c5fd', '#c4b5fd']

  const assignmentsHtml = worksheet.assignments.map((task, i) => {
    const color = taskColors[i % taskColors.length]
    const matchingData = parseMatchingData(task.text)

    if (matchingData) {
      return `
        <div class="task-block">
          <div class="task-header">
            <div class="task-circle" style="background:${color};color:white">${i + 1}</div>
            <div class="task-text">${renderRainbowMatchingHtml(matchingData)}</div>
          </div>
        </div>
      `
    }

    return `
      <div class="task-block">
        <div class="task-header">
          <div class="task-circle" style="background:${color};color:white">${i + 1}</div>
          <div class="task-text">${processText(task.text)}</div>
        </div>
        ${shouldShowAnswerField(task.text) ? '<div class="answer-dots"></div>' : ''}
      </div>
    `
  }).join('')

  const testHtml = worksheet.test.map((q, i) => {
    const color = taskColors[i % taskColors.length]
    const isMultiple = q.options.length > 0 && (q.question.toLowerCase().includes('несколько') || q.question.toLowerCase().includes('множественный'))
    return `
    <div class="test-question">
      <div class="question-header">
        <div class="task-circle" style="background:${color};color:white">${i + 1}</div>
        <div class="question-text">${processText(q.question)}</div>
      </div>
      <div class="options">
        ${q.options.map((opt, idx) => `
          <div class="option">
            <div class="option-marker ${isMultiple ? 'option-checkbox' : 'option-radio'}" style="border-color:${optionColors[idx % optionColors.length]}">
              ${isMultiple ? '' : ''}
            </div>
            <span class="option-letter" style="color:${optionColors[idx % optionColors.length]}">${optionLetters[idx] || String.fromCharCode(1040 + idx)}</span>
            <span class="option-text">${processText(opt)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `}).join('')

  const assignmentAnswersHtml = worksheet.answers.assignments.map((ans, i) => `
    <li class="answer-item">
      <span class="answer-number" style="color:${taskColors[i % taskColors.length]}">${i + 1}.</span>
      ${processText(ans)}
    </li>
  `).join('')

  const testAnswersHtml = worksheet.answers.test.map((ans, i) => `
    <li class="answer-item">
      <span class="answer-number" style="color:${taskColors[i % taskColors.length]}">${i + 1}.</span>
      ${processText(ans)}
    </li>
  `).join('')

  const dotsHtml = dotColors.map(c => `<span class="dot" style="background:${c}"></span>`).join('')
  const notesLinesHtml = Array.from({ length: 10 }).map(() => '<div class="note-line"></div>').join('')

  const hasAssignments = worksheet.assignments.length > 0
  const hasTest = worksheet.test.length > 0

  const headerHtml = `
    <div class="rb-header">
      <div class="rb-header-left">
        <div class="circle-yellow"></div>
        <div class="circle-white"></div>
        <span class="rb-logo">УчиОн</span>
      </div>
      <div class="rb-header-right">
        <div class="meta-field"><span>Имя:</span><div class="meta-line"></div></div>
        <div class="meta-field"><span>Дата:</span><div class="meta-line"></div><div class="circle-small-gray"></div></div>
      </div>
      <div class="circle-blue"></div>
    </div>
  `

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(worksheet.topic)}</title>
  <style>
    ${fontFaceCSS}

    @page { size: A4; margin: 0; }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11pt;
      line-height: 1.45;
      color: #1f2937;
      background: white;
    }

    .page {
      position: relative;
      padding: 0 28px 20px 28px;
      page-break-after: always;
      min-height: 100vh;
    }
    .page:last-child { page-break-after: auto; }

    /* ===== Header ===== */
    .rb-header {
      background: #f9a8d4;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      position: relative;
      margin: 0 -28px 20px -28px;
      min-height: 64px;
    }
    .rb-header-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .circle-yellow {
      width: 40px; height: 40px; border-radius: 50%;
      background: #fde047;
    }
    .circle-white {
      width: 20px; height: 20px; border-radius: 50%;
      background: #fbcfe8;
    }
    .rb-logo {
      font-size: 22px; font-weight: 700; color: #1f2937;
      margin-left: 4px;
    }
    .rb-header-right {
      margin-left: auto;
      margin-right: 60px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .meta-field {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #6b7280;
    }
    .meta-line {
      min-width: 120px;
      border-bottom: 1px solid #9ca3af;
    }
    .circle-small-gray {
      width: 12px; height: 12px; border-radius: 50%;
      background: #d1d5db;
    }
    .circle-blue {
      position: absolute;
      right: 16px;
      top: 6px;
      width: 52px; height: 52px; border-radius: 50%;
      background: #38bdf8;
    }

    /* ===== Topic banner ===== */
    .topic-banner {
      text-align: center;
      margin: 0 auto 18px;
      max-width: 80%;
    }
    .topic-banner h1 {
      display: inline-block;
      background: #fde047;
      color: #1f2937;
      font-size: 17px;
      font-weight: 700;
      padding: 8px 28px;
      border-radius: 24px;
    }

    /* ===== Section ribbon ===== */
    .section-ribbon {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #4ade80;
      color: white;
      font-weight: 700;
      font-size: 15px;
      padding: 6px 20px 6px 14px;
      border-radius: 4px 20px 20px 4px;
      margin-bottom: 14px;
      position: relative;
    }
    .section-ribbon::before {
      content: '';
      position: absolute;
      left: -6px; top: 2px;
      width: 12px; height: calc(100% - 4px);
      background: #a855f7;
      border-radius: 3px;
      transform: rotate(-3deg);
    }
    .section-ribbon-icon {
      font-size: 14px;
    }

    /* ===== Task blocks ===== */
    .task-block {
      margin-bottom: 16px;
      break-inside: avoid;
    }
    .task-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 4px;
    }
    .task-circle {
      width: 28px; height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .task-text {
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      padding-top: 4px;
      flex: 1;
    }
    .answer-dots {
      margin-left: 38px;
      margin-top: 4px;
      height: 44px;
      border-bottom: 2px dotted #d1d5db;
      position: relative;
    }
    .answer-dots::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0; right: 0;
      border-bottom: 2px dotted #d1d5db;
    }

    /* ===== Matching (rainbow) ===== */
    .rb-matching-instruction {
      font-size: 12px;
      color: #374151;
      margin-bottom: 8px;
    }
    .rb-matching-columns {
      display: flex;
      gap: 16px;
    }
    .rb-matching-column { flex: 1; }
    .rb-matching-item {
      padding: 6px 12px;
      margin-bottom: 6px;
      background: white;
      border: 1.5px solid #e5e7eb;
      border-radius: 20px;
      font-size: 11px;
      color: #374151;
    }
    .rb-matching-number, .rb-matching-letter {
      font-weight: 700;
      color: #6366f1;
      margin-right: 6px;
    }

    /* ===== Test questions ===== */
    .test-question {
      border: 1.5px solid #e5e7eb;
      border-radius: 12px;
      padding: 12px 16px;
      margin-bottom: 12px;
      background: white;
      break-inside: avoid;
    }
    .question-header {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 8px;
    }
    .question-text {
      font-size: 12px;
      font-weight: 600;
      color: #1f2937;
      padding-top: 4px;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-left: 38px;
    }
    .option {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .option-radio {
      width: 18px; height: 18px;
      border: 2px solid;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .option-checkbox {
      width: 18px; height: 18px;
      border: 2px solid;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .option-letter {
      font-weight: 700;
      font-size: 12px;
      min-width: 14px;
    }
    .option-text {
      font-size: 11px;
      color: #374151;
    }

    /* ===== Dots decoration ===== */
    .dots-row {
      display: flex;
      justify-content: center;
      gap: 10px;
      padding: 16px 0 4px;
      flex-wrap: wrap;
    }
    .dot {
      width: 14px; height: 14px;
      border-radius: 50%;
      display: inline-block;
    }

    /* ===== Notes ===== */
    .notes-section {
      margin-top: 12px;
    }
    .note-line {
      border-bottom: 2px dotted #d1d5db;
      height: 30px;
    }

    /* ===== Answers ===== */
    .answers-card {
      border: 1.5px solid #e5e7eb;
      border-radius: 12px;
      padding: 16px 20px;
      margin-top: 8px;
    }
    .answers-column h3 {
      font-size: 13px;
      font-weight: 700;
      color: #374151;
      margin-bottom: 8px;
    }
    .answers-list {
      list-style: none;
    }
    .answer-item {
      font-size: 11px;
      color: #374151;
      margin-bottom: 4px;
      padding: 2px 0;
    }
    .answer-number {
      font-weight: 700;
      margin-right: 4px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${hasAssignments ? `
  <div class="page">
    ${headerHtml}
    <div class="topic-banner"><h1>${escapeHtml(worksheet.topic)}</h1></div>
    <div class="section-ribbon"><span class="section-ribbon-icon">&#9999;&#65039;</span> Задания</div>
    <div class="assignments">${assignmentsHtml}</div>
    <div class="dots-row">${dotsHtml}</div>
  </div>
  ` : ''}

  ${hasTest ? `
  <div class="page">
    ${headerHtml}
    ${!hasAssignments ? `<div class="topic-banner"><h1>${escapeHtml(worksheet.topic)}</h1></div>` : ''}
    <div class="section-ribbon"><span class="section-ribbon-icon">&#128203;</span> Мини-тест</div>
    <div class="test-questions">${testHtml}</div>
    <div class="dots-row">${dotsHtml}</div>
  </div>
  ` : ''}

  <div class="page">
    <div class="section-ribbon"><span class="section-ribbon-icon">&#128203;</span> Заметки</div>
    <div class="notes-section">${notesLinesHtml}</div>
    <div class="dots-row">${dotsHtml}</div>
  </div>

  <div class="page">
    ${headerHtml}
    <div class="section-ribbon"><span class="section-ribbon-icon">&#128203;</span> Ответы</div>
    <div class="answers-card">
      ${hasAssignments ? `
      <div class="answers-column">
        <h3>Задания:</h3>
        <ul class="answers-list">${assignmentAnswersHtml}</ul>
      </div>
      ` : ''}
      ${hasTest ? `
      <div class="answers-column" ${hasAssignments ? 'style="margin-top:14px"' : ''}>
        <h3>Мини-тест:</h3>
        <ul class="answers-list">${testAnswersHtml}</ul>
      </div>
      ` : ''}
    </div>
  </div>
</body>
</html>`
}

// Academic (Академичный) template — elegant warm-toned style for middle/high school
function generateAcademicHtml(worksheet: Worksheet): string {
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

  const optionLetters = ['А', 'Б', 'В', 'Г', 'Д']

  const assignmentsHtml = worksheet.assignments.map((task, i) => {
    const matchingData = parseMatchingData(task.text)

    if (matchingData) {
      return `
        <div class="ac-task">
          <div class="ac-task-header">
            <div class="ac-task-num">${i + 1}</div>
            <div class="ac-task-text">${renderAcademicMatchingHtml(matchingData)}</div>
          </div>
        </div>
      `
    }

    return `
      <div class="ac-task">
        <div class="ac-task-header">
          <div class="ac-task-num">${i + 1}</div>
          <div class="ac-task-text">${processText(task.text)}</div>
        </div>
        ${shouldShowAnswerField(task.text) ? '<div class="ac-answer-line"></div>' : ''}
      </div>
    `
  }).join('')

  const testHtml = worksheet.test.map((q, i) => {
    const isMultiple = q.options.length > 0 && (q.question.toLowerCase().includes('несколько') || q.question.toLowerCase().includes('множественный') || q.question.toLowerCase().includes('выберите верные'))
    return `
    <div class="ac-test-q">
      <div class="ac-test-header">
        <div class="ac-task-num">${i + 1}</div>
        <div class="ac-test-text">${processText(q.question)}</div>
      </div>
      <div class="ac-options">
        ${q.options.map((opt, idx) => `
          <div class="ac-option">
            <div class="ac-option-marker ${isMultiple ? 'ac-checkbox' : 'ac-radio'}"></div>
            <span class="ac-option-letter">${optionLetters[idx] || String.fromCharCode(1040 + idx)}</span>
            <span class="ac-option-text">${processText(opt)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `}).join('')

  const assignmentAnswersHtml = worksheet.answers.assignments.map((ans, i) => `
    <li class="ac-ans-item">${i + 1}. &nbsp;${processText(ans)}</li>
  `).join('')

  const testAnswersHtml = worksheet.answers.test.map((ans, i) => `
    <li class="ac-ans-item">${i + 1}. ${processText(ans)}</li>
  `).join('')

  const notesLinesHtml = Array.from({ length: 10 }).map(() => '<div class="ac-note-line"></div>').join('')

  const hasAssignments = worksheet.assignments.length > 0
  const hasTest = worksheet.test.length > 0

  const totalPages = 1 + (hasAssignments && hasTest ? 1 : 0) + 1 + 1

  const headerHtml = `
    <div class="ac-header">
      <div class="ac-logo">УчиОн</div>
      <div class="ac-meta">
        <div class="ac-meta-field"><span>Имя:</span><div class="ac-meta-line"></div></div>
        <div class="ac-meta-field"><span>Дата:</span><div class="ac-meta-line"></div></div>
      </div>
    </div>
    <div class="ac-header-line"></div>
  `

  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(worksheet.topic)}</title>
  <style>
    ${fontFaceCSS}

    @page { size: A4; margin: 0; }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', 'Georgia', 'Times New Roman', serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    }

    .ac-page {
      position: relative;
      padding: 32px 40px 40px;
      page-break-after: always;
      min-height: 100vh;
    }
    .ac-page:last-child { page-break-after: auto; }

    /* ===== Header ===== */
    .ac-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 10px;
    }
    .ac-logo {
      font-size: 24px;
      font-weight: 700;
      color: #2d2d2d;
      letter-spacing: -0.5px;
    }
    .ac-meta {
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: flex-end;
    }
    .ac-meta-field {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10px;
      color: #6b7280;
    }
    .ac-meta-line {
      width: 140px;
      border-bottom: 1px solid #b8a080;
    }
    .ac-header-line {
      height: 2px;
      background: linear-gradient(90deg, #c4a882, #d4bc9a);
      border-radius: 1px;
      margin-bottom: 24px;
    }

    /* ===== Topic ===== */
    .ac-topic {
      margin-bottom: 24px;
    }
    .ac-topic h1 {
      font-size: 22px;
      font-weight: 700;
      color: #1a1a1a;
      padding-bottom: 8px;
      border-bottom: 3px solid #c4a882;
      display: inline-block;
    }

    /* ===== Section badge ===== */
    .ac-section-badge {
      display: inline-block;
      background: #c4a882;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      padding: 5px 20px;
      border-radius: 4px;
      margin-bottom: 18px;
      letter-spacing: 0.3px;
    }

    /* ===== Task blocks ===== */
    .ac-task {
      margin-bottom: 20px;
      break-inside: avoid;
    }
    .ac-task-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }
    .ac-task-num {
      width: 28px;
      height: 28px;
      background: #2d2d2d;
      color: white;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .ac-task-text {
      font-size: 12px;
      font-weight: 500;
      line-height: 1.6;
      padding-top: 4px;
      flex: 1;
    }
    .ac-answer-line {
      margin-left: 40px;
      margin-top: 10px;
      height: 48px;
      border-bottom: 1.5px solid #c4a882;
      position: relative;
    }
    .ac-answer-line::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 0; right: 0;
      border-bottom: 1.5px solid #c4a882;
    }

    /* ===== Matching (academic) ===== */
    .ac-match-instruction {
      font-size: 12px;
      color: #374151;
      margin-bottom: 10px;
    }
    .ac-match-columns {
      display: flex;
      gap: 20px;
    }
    .ac-match-col { flex: 1; }
    .ac-match-item {
      padding: 7px 12px;
      margin-bottom: 6px;
      background: #f5efe8;
      border: 1px solid #e5ddd2;
      border-radius: 4px;
      font-size: 11px;
      color: #374151;
    }
    .ac-match-num, .ac-match-letter {
      font-weight: 700;
      color: #8b7355;
      margin-right: 6px;
    }

    /* ===== Test ===== */
    .ac-test-q {
      margin-bottom: 20px;
      break-inside: avoid;
    }
    .ac-test-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 8px;
    }
    .ac-test-text {
      font-size: 12px;
      font-weight: 600;
      color: #1a1a1a;
      padding-top: 4px;
    }
    .ac-options {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-left: 40px;
    }
    .ac-option {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .ac-radio {
      width: 16px; height: 16px;
      border: 1.5px solid #9ca3af;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .ac-checkbox {
      width: 16px; height: 16px;
      border: 1.5px solid #9ca3af;
      border-radius: 3px;
      flex-shrink: 0;
    }
    .ac-option-letter {
      font-weight: 700;
      font-size: 12px;
      color: #4b5563;
      min-width: 14px;
    }
    .ac-option-text {
      font-size: 11px;
      color: #374151;
    }

    /* ===== Notes ===== */
    .ac-note-line {
      border-bottom: 1px solid #c4a882;
      height: 32px;
    }
    .ac-notes-area {
      margin-top: 8px;
    }

    /* ===== Page number ===== */
    .ac-page-num {
      position: absolute;
      bottom: 20px;
      right: 40px;
      background: #2d2d2d;
      color: white;
      font-size: 9px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 4px;
    }

    /* ===== Answers page ===== */
    .ac-answers-header {
      background: linear-gradient(135deg, #c4a882, #d4bc9a);
      padding: 24px 40px;
      margin: 0 -40px 24px;
    }
    .ac-answers-header .ac-logo {
      color: #1a1a1a;
      font-size: 24px;
    }
    .ac-answers-body {
      padding: 0;
    }
    .ac-ans-section h3 {
      font-size: 13px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 8px;
    }
    .ac-ans-list {
      list-style: none;
      margin-bottom: 20px;
    }
    .ac-ans-item {
      font-size: 11px;
      color: #374151;
      padding: 4px 0;
      margin-left: 16px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${hasAssignments ? `
  <div class="ac-page">
    ${headerHtml}
    <div class="ac-topic"><h1>${escapeHtml(worksheet.topic)}</h1></div>
    <div class="ac-section-badge">Задания</div>
    <div class="ac-assignments">${assignmentsHtml}</div>
    <div class="ac-page-num">Page 1 / ${totalPages}</div>
  </div>
  ` : ''}

  ${hasTest ? `
  <div class="ac-page">
    ${headerHtml}
    ${!hasAssignments ? `<div class="ac-topic"><h1>${escapeHtml(worksheet.topic)}</h1></div>` : ''}
    <div class="ac-section-badge">Мини-тест</div>
    <div class="ac-test">${testHtml}</div>
    <div class="ac-page-num">Page ${hasAssignments ? 2 : 1} / ${totalPages}</div>
  </div>
  ` : ''}

  <div class="ac-page">
    ${headerHtml}
    <div class="ac-section-badge">Заметки</div>
    <div class="ac-notes-area">${notesLinesHtml}</div>
    <div class="ac-page-num">Page ${totalPages - 1} / ${totalPages}</div>
  </div>

  <div class="ac-page">
    <div class="ac-answers-header">
      <div class="ac-logo">УчиОн</div>
    </div>
    <div class="ac-section-badge">Ответы</div>
    <div class="ac-answers-body">
      ${hasAssignments ? `
      <div class="ac-ans-section">
        <h3>Задания:</h3>
        <ol class="ac-ans-list">${assignmentAnswersHtml}</ol>
      </div>
      ` : ''}
      ${hasTest ? `
      <div class="ac-ans-section">
        <h3>Мини-тест:</h3>
        <ol class="ac-ans-list">${testAnswersHtml}</ol>
      </div>
      ` : ''}
    </div>
    <div class="ac-page-num">Page ${totalPages} / ${totalPages}</div>
  </div>
</body>
</html>`
}

// Render matching task for Academic template
function renderAcademicMatchingHtml(data: MatchingData): string {
  const leftItems = data.leftColumn.map((item, i) =>
    `<div class="ac-match-item"><span class="ac-match-num">${i + 1}.</span> ${processText(item)}</div>`
  ).join('')

  const rightItems = data.rightColumn.map((item, i) =>
    `<div class="ac-match-item"><span class="ac-match-letter">${String.fromCharCode(1072 + i)})</span> ${processText(item)}</div>`
  ).join('')

  return `
    <div class="ac-match-instruction">${processText(data.instruction)}</div>
    <div class="ac-match-columns">
      <div class="ac-match-col">${leftItems}</div>
      <div class="ac-match-col">${rightItems}</div>
    </div>
  `
}

// Render matching task for Rainbow template
function renderRainbowMatchingHtml(data: MatchingData): string {
  const leftItems = data.leftColumn.map((item, i) =>
    `<div class="rb-matching-item"><span class="rb-matching-number">${i + 1}.</span> ${processText(item)}</div>`
  ).join('')

  const rightItems = data.rightColumn.map((item, i) =>
    `<div class="rb-matching-item"><span class="rb-matching-letter">${String.fromCharCode(1072 + i)})</span> ${processText(item)}</div>`
  ).join('')

  return `
    <div class="rb-matching-instruction">${processText(data.instruction)}</div>
    <div class="rb-matching-columns">
      <div class="rb-matching-column">${leftItems}</div>
      <div class="rb-matching-column">${rightItems}</div>
    </div>
  `
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Converts LaTeX to plain Unicode text for PDF generation.
 * Handles both delimited \(...\) and raw LaTeX commands.
 */
function latexToUnicode(text: string): string {
  if (!text) return ''

  // Normalize double-escaped backslashes from JSON parsing
  let result = text.replace(/\\\\/g, '\\')

  // Process \(...\) and \[...\] blocks first
  result = result.replace(/\\\(([^]*?)\\\)|\\\[([^]*?)\\\]/g, (match, inline, display) => {
    const latex = (inline || display || '').trim()
    return convertLatexToUnicode(latex)
  })

  // Then process raw LaTeX commands (without delimiters)
  result = convertLatexToUnicode(result)

  return result
}

function convertLatexToUnicode(latex: string): string {
  let result = latex

  // Vectors: \vec{a} → a⃗
  result = result.replace(/\\vec\{([^}]+)\}/g, '$1\u20D7')
  result = result.replace(/\\vec ([a-zA-Z])/g, '$1\u20D7')

  // Overline/bar: \bar{a} → ā or \overline{AB} → A̅B̅
  result = result.replace(/\\(?:bar|overline)\{([^}]+)\}/g, (_, content) => {
    return content.split('').map((c: string) => c + '\u0305').join('')
  })

  // Fractions: \frac{a}{b} → a/b (handle nested braces with loop)
  let prevResult = ''
  while (prevResult !== result) {
    prevResult = result
    result = result.replace(/\\frac\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '($1/$2)')
  }

  // Square root: \sqrt{x} → √x (handle nested braces with loop)
  prevResult = ''
  while (prevResult !== result) {
    prevResult = result
    result = result.replace(/\\sqrt\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, '√($1)')
  }
  result = result.replace(/\\sqrt ([a-zA-Z0-9])/g, '√$1')

  // Trig functions (standard)
  result = result.replace(/\\sin\s*/g, 'sin ')
  result = result.replace(/\\cos\s*/g, 'cos ')
  result = result.replace(/\\tan\s*/g, 'tan ')
  result = result.replace(/\\cot\s*/g, 'cot ')
  result = result.replace(/\\sec\s*/g, 'sec ')
  result = result.replace(/\\csc\s*/g, 'csc ')
  result = result.replace(/\\arcsin\s*/g, 'arcsin ')
  result = result.replace(/\\arccos\s*/g, 'arccos ')
  result = result.replace(/\\arctan\s*/g, 'arctan ')
  result = result.replace(/\\arccot\s*/g, 'arccot ')
  result = result.replace(/\\arcsec\s*/g, 'arcsec ')
  result = result.replace(/\\arccsc\s*/g, 'arccsc ')

  // Russian/European trig notation
  result = result.replace(/\\tg\s*/g, 'tg ')
  result = result.replace(/\\ctg\s*/g, 'ctg ')
  result = result.replace(/\\cosec\s*/g, 'cosec ')
  result = result.replace(/\\arctg\s*/g, 'arctg ')
  result = result.replace(/\\arcctg\s*/g, 'arcctg ')

  // Hyperbolic functions
  result = result.replace(/\\sinh\s*/g, 'sinh ')
  result = result.replace(/\\cosh\s*/g, 'cosh ')
  result = result.replace(/\\tanh\s*/g, 'tanh ')
  result = result.replace(/\\coth\s*/g, 'coth ')
  result = result.replace(/\\sech\s*/g, 'sech ')
  result = result.replace(/\\csch\s*/g, 'csch ')

  // Russian hyperbolic notation
  result = result.replace(/\\sh\s*/g, 'sh ')
  result = result.replace(/\\ch\s*/g, 'ch ')
  result = result.replace(/\\th\s*/g, 'th ')
  result = result.replace(/\\cth\s*/g, 'cth ')

  // Logarithms and other functions
  result = result.replace(/\\log\s*/g, 'log ')
  result = result.replace(/\\ln\s*/g, 'ln ')
  result = result.replace(/\\lg\s*/g, 'lg ')
  result = result.replace(/\\exp\s*/g, 'exp ')
  result = result.replace(/\\lim\s*/g, 'lim ')

  // Handle \operatorname{...}
  result = result.replace(/\\operatorname\{([^}]+)\}/g, '$1 ')

  // Degree: ^\circ → °
  result = result.replace(/\^\\circ/g, '°')

  // Superscripts (basic)
  const superscripts: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
    'n': 'ⁿ', 'i': 'ⁱ',
  }
  result = result.replace(/\^{([^}]+)}/g, (_, exp) => {
    return exp.split('').map((c: string) => superscripts[c] || `^${c}`).join('')
  })
  result = result.replace(/\^([0-9n])/g, (_, c) => superscripts[c] || `^${c}`)

  // Subscripts (basic)
  const subscripts: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
    '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
    'a': 'ₐ', 'e': 'ₑ', 'i': 'ᵢ', 'o': 'ₒ', 'u': 'ᵤ',
    'x': 'ₓ', 'n': 'ₙ', 'm': 'ₘ',
  }
  result = result.replace(/_\{([^}]+)\}/g, (_, sub) => {
    return sub.split('').map((c: string) => subscripts[c] || `_${c}`).join('')
  })
  result = result.replace(/_([0-9])/g, (_, c) => subscripts[c] || `_${c}`)

  // Greek letters
  const greekLetters: Record<string, string> = {
    '\\alpha': 'α', '\\beta': 'β', '\\gamma': 'γ', '\\delta': 'δ',
    '\\epsilon': 'ε', '\\zeta': 'ζ', '\\eta': 'η', '\\theta': 'θ',
    '\\iota': 'ι', '\\kappa': 'κ', '\\lambda': 'λ', '\\mu': 'μ',
    '\\nu': 'ν', '\\xi': 'ξ', '\\pi': 'π', '\\rho': 'ρ',
    '\\sigma': 'σ', '\\tau': 'τ', '\\upsilon': 'υ', '\\phi': 'φ',
    '\\chi': 'χ', '\\psi': 'ψ', '\\omega': 'ω',
    '\\Gamma': 'Γ', '\\Delta': 'Δ', '\\Theta': 'Θ', '\\Lambda': 'Λ',
    '\\Xi': 'Ξ', '\\Pi': 'Π', '\\Sigma': 'Σ', '\\Phi': 'Φ',
    '\\Psi': 'Ψ', '\\Omega': 'Ω',
  }
  for (const [tex, unicode] of Object.entries(greekLetters)) {
    result = result.replace(new RegExp(tex.replace(/\\/g, '\\\\'), 'g'), unicode)
  }

  // Math operators and symbols
  const symbols: Record<string, string> = {
    '\\cdot': '·', '\\times': '×', '\\div': '÷',
    '\\pm': '±', '\\mp': '∓',
    '\\leq': '≤', '\\geq': '≥', '\\neq': '≠',
    '\\approx': '≈', '\\equiv': '≡',
    '\\infty': '∞', '\\partial': '∂',
    '\\sum': 'Σ', '\\prod': 'Π', '\\int': '∫',
    '\\rightarrow': '→', '\\leftarrow': '←', '\\leftrightarrow': '↔',
    '\\Rightarrow': '⇒', '\\Leftarrow': '⇐', '\\Leftrightarrow': '⇔',
    '\\angle': '∠', '\\perp': '⊥', '\\parallel': '∥',
    '\\in': '∈', '\\notin': '∉', '\\subset': '⊂', '\\supset': '⊃',
    '\\cup': '∪', '\\cap': '∩',
    '\\forall': '∀', '\\exists': '∃',
    '\\nabla': '∇', '\\triangle': '△',
    '\\circ': '°',
    '\\degree': '°',
    '\\,': ' ', '\\;': ' ', '\\quad': '  ', '\\qquad': '    ',
  }
  for (const [tex, unicode] of Object.entries(symbols)) {
    result = result.replace(new RegExp(tex.replace(/\\/g, '\\\\'), 'g'), unicode)
  }

  // Remove remaining LaTeX commands like \text{}, \mathrm{}, etc.
  result = result.replace(/\\(?:text|mathrm|mathbf|mathit|mathsf)\{([^}]+)\}/g, '$1')

  // Remove curly braces used for grouping
  result = result.replace(/\{([^{}]+)\}/g, '$1')

  // Clean up any remaining backslashes before common letters
  result = result.replace(/\\([a-zA-Z]+)/g, '$1')

  return result.trim()
}

/**
 * Process text: convert LaTeX to Unicode, then escape HTML
 */
function processText(text: string): string {
  return escapeHtml(latexToUnicode(text))
}

export async function buildPdf(worksheet: Worksheet, meta: GeneratePayload, templateId: PdfTemplateId = 'standard'): Promise<string> {
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

    const html = generateWorksheetHtml(worksheet, templateId)
    console.log('[PDF] HTML generated, template:', templateId, 'length:', html.length)

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    console.log('[PDF] Content set to page')

    const pdfMargins = (templateId === 'rainbow' || templateId === 'academic')
      ? { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' }
      : { top: '12mm', right: '14mm', bottom: '12mm', left: '14mm' }

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: pdfMargins,
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

import type { PresentationStructure, PresentationSlide, ContentElement, ContentElementType } from '../../../shared/types.js'

const VALID_EL_TYPES: Set<string> = new Set<ContentElementType>([
  'heading', 'definition', 'text', 'bullet', 'highlight', 'task', 'formula',
])

/** Extract plain text from a content item (string or ContentElement) */
export function getContentItemText(item: string | ContentElement): string {
  if (typeof item === 'string') return item
  return item.text || ''
}

/** Normalize mixed content array to ContentElement[] (strings become bullets) */
export function normalizeContent(content: (string | ContentElement)[]): ContentElement[] {
  return content.map(item => {
    if (typeof item === 'string') {
      return { el: 'bullet' as const, text: item }
    }
    return item
  })
}

/** Validate and clean a single content element object */
function cleanContentElement(item: unknown): string | ContentElement {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && 'el' in item && 'text' in item) {
    const obj = item as Record<string, unknown>
    if (VALID_EL_TYPES.has(String(obj.el)) && typeof obj.text === 'string' && obj.text.trim() !== '') {
      const result: ContentElement = { el: obj.el as ContentElementType, text: obj.text }
      if (obj.el === 'task' && typeof obj.number === 'number') {
        result.number = obj.number
      }
      return result
    }
    // Invalid object with text — convert to bullet
    if (typeof obj.text === 'string' && obj.text.trim() !== '') {
      return { el: 'bullet', text: obj.text }
    }
  }
  // Fallback: stringify
  const text = String(item).trim()
  return text ? { el: 'bullet', text } : ''
}

/**
 * Post-process AI-generated presentation structure:
 * 1. Filter empty strings from content arrays
 * 2. Convert invalid slides (table without tableData, etc.) to content type
 * 3. Split practice slides: move answers to separate slide
 * 4. Remove completely empty slides (except title/conclusion)
 */
export function sanitizePresentationStructure(
  structure: PresentationStructure
): PresentationStructure {
  let slides = structure.slides.map(cleanSlide)
  slides = convertInvalidSlides(slides)
  slides = splitPracticeAnswers(slides)
  slides = removeEmptySlides(slides)

  return { title: structure.title, slides }
}

/** Clean and validate content items, remove empty entries */
function cleanSlide(slide: PresentationSlide): PresentationSlide {
  return {
    ...slide,
    content: slide.content
      .map(cleanContentElement)
      .filter(item => getContentItemText(item).trim() !== ''),
    leftColumn: slide.leftColumn?.map(item => typeof item === 'string' ? item : getContentItemText(item as any)).filter(item => item.trim() !== ''),
    rightColumn: slide.rightColumn?.map(item => typeof item === 'string' ? item : getContentItemText(item as any)).filter(item => item.trim() !== ''),
  }
}

/** Convert slides with missing required data to plain content */
function convertInvalidSlides(slides: PresentationSlide[]): PresentationSlide[] {
  return slides.map(slide => {
    if (slide.type === 'table' && (!slide.tableData || slide.tableData.headers.length === 0)) {
      return { ...slide, type: 'content' as const }
    }
    if (slide.type === 'twoColumn' && (!slide.leftColumn?.length && !slide.rightColumn?.length)) {
      return { ...slide, type: 'content' as const }
    }
    if (slide.type === 'chart' && (!slide.chartData || slide.chartData.labels.length === 0 || slide.chartData.values.length === 0)) {
      return { ...slide, type: 'content' as const }
    }
    return slide
  })
}

/** Answer-like line patterns */
const ANSWER_PATTERNS = [
  /^ответ[ыи]?\s*[:\.]/i,
  /^ответ\s*\d/i,
  /^правильн/i,
  /^решени[еяй]/i,
]

function isAnswerLine(item: string | ContentElement): boolean {
  const line = getContentItemText(item)
  return ANSWER_PATTERNS.some(p => p.test(line.trim()))
}

function isAnswerHeaderLine(item: string | ContentElement): boolean {
  const trimmed = getContentItemText(item).trim().toLowerCase()
  return trimmed === 'ответы' || trimmed === 'ответы:' || trimmed === 'ответ:' || trimmed === 'ответ'
}

/**
 * For practice slides: if they contain answer lines, extract them
 * into a separate content slide with title="Ответы"
 */
function splitPracticeAnswers(slides: PresentationSlide[]): PresentationSlide[] {
  const result: PresentationSlide[] = []

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]

    if (slide.type !== 'practice') {
      result.push(slide)
      continue
    }

    // Check if next slide is already an "Ответы" slide
    const nextSlide = slides[i + 1]
    const nextIsAnswers = nextSlide &&
      (nextSlide.title.toLowerCase().includes('ответ') ||
       nextSlide.title.toLowerCase() === 'ответы')

    // Find answer lines in content
    let answerStartIdx = -1
    for (let j = 0; j < slide.content.length; j++) {
      if (isAnswerHeaderLine(slide.content[j]) || isAnswerLine(slide.content[j])) {
        answerStartIdx = j
        break
      }
    }

    if (answerStartIdx === -1 || nextIsAnswers) {
      // No answers found in this slide, or next slide already has answers
      result.push(slide)
      continue
    }

    // Split: tasks stay, answers go to new slide
    const taskContent = slide.content.slice(0, answerStartIdx)
    const answerContent = slide.content.slice(answerStartIdx)
      .filter(line => !isAnswerHeaderLine(line)) // Remove bare "Ответы:" header

    // Push practice slide without answers
    result.push({ ...slide, content: taskContent.length > 0 ? taskContent : slide.content })

    // Push answers slide if we extracted any
    if (answerContent.length > 0) {
      result.push({
        type: 'content',
        title: 'Ответы',
        content: answerContent,
      })
    }
  }

  return result
}

/** Remove slides with empty content (except title/conclusion which may be decorative) */
function removeEmptySlides(slides: PresentationSlide[]): PresentationSlide[] {
  return slides.filter(slide => {
    // Always keep title and conclusion
    if (slide.type === 'title' || slide.type === 'conclusion') return true

    // Keep if has content
    if (slide.content.length > 0) return true

    // Keep if has structured data
    if (slide.tableData && slide.tableData.headers.length > 0) return true
    if (slide.leftColumn && slide.leftColumn.length > 0) return true
    if (slide.rightColumn && slide.rightColumn.length > 0) return true
    if (slide.chartData && slide.chartData.labels.length > 0) return true

    // Empty slide — remove
    return false
  })
}

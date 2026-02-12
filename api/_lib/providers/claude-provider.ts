import type { PresentationStructure } from '../../../shared/types.js'
import OpenAI from 'openai'
import { getPresentationSubjectConfig } from '../generation/config/presentations/index.js'
import { getPresentationModel } from '../ai-models.js'
import { sanitizeUserInput } from '../generation/sanitize.js'
import type { GeneratePresentationParams } from '../ai-provider.js'

/**
 * Claude Provider for Presentation Generation
 *
 * Minimal constraints - let Claude decide structure and content flow.
 */
export class ClaudeProvider {
  private client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseURL && { baseURL })
    })
    console.log('[УчиОн] ClaudeProvider initialized', { model: getPresentationModel() })
  }

  async generatePresentation(
    params: GeneratePresentationParams,
    onProgress?: (percent: number) => void
  ): Promise<PresentationStructure> {
    console.log('[УчиОн] ClaudeProvider.generatePresentation', params)
    onProgress?.(5)

    const subjectConfig = getPresentationSubjectConfig(params.subject)
    const slideCount = params.slideCount || 18

    // Minimal system prompt - just role and style
    const systemPrompt = `Ты создаёшь учебные презентации. Отвечай только валидным JSON.`

    // Style from user or default
    let style = 'минимализм'
    if (params.themeType === 'custom' && params.themeCustom) {
      style = sanitizeUserInput(params.themeCustom)
    }

    // Simplified prompt - let Claude be creative
    const userPrompt = `Создай презентацию для урока.

Тема: ${params.topic}
Предмет: ${subjectConfig.name}
Класс: ${params.grade}
Слайдов: ${slideCount}
Стиль: ${style}

Структура JSON:
{
  "title": "Название презентации",
  "slides": [
    {
      "type": "тип слайда",
      "title": "Заголовок",
      "content": [элементы],
      // опционально для таблиц:
      "tableData": {"headers": [...], "rows": [[...], ...]}
    }
  ]
}

Поле "content" — массив элементов. Каждый элемент — объект с полем "el":
- {"el": "heading", "text": "..."} — ключевое понятие/подзаголовок (крупный шрифт, по центру)
- {"el": "definition", "text": "..."} — определение/правило (с акцентной рамкой)
- {"el": "text", "text": "..."} — обычный текст (без маркера)
- {"el": "bullet", "text": "..."} — пункт списка (с маркером •)
- {"el": "highlight", "text": "..."} — важная мысль (акцентный цвет, жирный)
- {"el": "task", "text": "...", "number": 1} — задание с номером
- {"el": "formula", "text": "..."} — формула (крупно, по центру)

Каждый элемент content ОБЯЗАТЕЛЬНО должен быть объектом {"el": "...", "text": "..."}.
НЕ используй простые строки в content — только объекты.

Для content-слайдов: начинай с heading, затем definition (если есть), потом bullet/text.
Для practice: используй task с номерами 1, 2, 3...

Типы слайдов:
- title — титульный (первый слайд)
- content — основной тип, текст с семантической разметкой
- table — таблица (ТОЛЬКО если данные действительно табличные, например сравнение)
- example — пример с решением
- formula — одна крупная формула с пояснением
- practice — задания для учеников (ТОЛЬКО задания, БЕЗ ответов)
- conclusion — итоги (последний слайд)

Используй преимущественно content и example. Тип table — только когда информация реально сравнительная (2-3 колонки с данными). Для всего остального используй content с разнообразной разметкой (heading, definition, bullet, highlight).

ВАЖНО:
- Слайды "practice" содержат ТОЛЬКО задания, БЕЗ ответов
- После каждого "practice" добавь слайд type="content" с title="Ответы" и ответами
- Каждый слайд должен иметь непустой content (минимум 3-4 элемента)
- Каждый элемент content — объект {"el": "тип", "text": "текст"}
- Обязательно включи теорию, определения, формулы (если есть для темы)

Создай интересную, содержательную презентацию. Теория, примеры, практика — на твоё усмотрение.
Пиши подробно, это для школьников ${params.grade} класса.`

    onProgress?.(15)

    const model = getPresentationModel()
    console.log(`[УчиОн] Model: ${model}`)

    let completion
    try {
      completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 12000,
        temperature: 0.8
      })
    } catch (error: unknown) {
      console.error('[УчиОн] Claude API Error:', error)
      if (error instanceof Error) {
        console.error('[УчиОн] Message:', error.message)
      }
      throw new Error('AI_ERROR')
    }

    onProgress?.(65)

    const content = completion.choices[0]?.message?.content || ''
    console.log('[УчиОн] Response length:', content.length)

    let structure: PresentationStructure
    try {
      // Clean up response
      let json = content.trim()
      if (json.startsWith('```json')) json = json.slice(7)
      if (json.startsWith('```')) json = json.slice(3)
      if (json.endsWith('```')) json = json.slice(0, -3)
      json = json.trim()

      const match = json.match(/\{[\s\S]*\}/)
      if (!match) {
        console.error('[УчиОн] No JSON in response')
        throw new Error('AI_ERROR')
      }

      const parsed = JSON.parse(match[0])

      if (!parsed.title || !Array.isArray(parsed.slides)) {
        console.error('[УчиОн] Invalid structure')
        throw new Error('AI_ERROR')
      }

      // Light validation - just ensure required fields exist
      const validTypes = new Set([
        'title', 'content', 'twoColumn', 'table', 'example',
        'formula', 'diagram', 'chart', 'practice', 'conclusion'
      ])

      for (let i = 0; i < parsed.slides.length; i++) {
        const slide = parsed.slides[i]

        // Default type if missing or invalid
        if (!slide.type || !validTypes.has(slide.type)) {
          slide.type = 'content'
        }

        // Ensure title and content exist
        slide.title = slide.title || ''
        slide.content = Array.isArray(slide.content)
          ? slide.content.map((item: unknown) => {
              if (typeof item === 'string') return item
              if (item && typeof item === 'object') {
                const obj = item as Record<string, unknown>
                // Valid ContentElement: {el, text}
                if ('el' in obj && typeof obj.text === 'string') return item
                // Object with just text field — wrap as bullet
                if (typeof obj.text === 'string') return { el: 'bullet', text: obj.text }
                // Object with content/value field — try to extract
                if (typeof obj.content === 'string') return { el: 'bullet', text: obj.content }
                if (typeof obj.value === 'string') return { el: 'bullet', text: obj.value }
                // Skip unrecoverable objects
                return null
              }
              return typeof item === 'number' ? String(item) : null
            }).filter((item: unknown) => item !== null)
          : (slide.content ? [String(slide.content)] : [])
      }

      structure = {
        title: parsed.title,
        slides: parsed.slides,
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'AI_ERROR') throw e
      console.error('[УчиОн] Parse error:', e)
      throw new Error('AI_ERROR')
    }

    onProgress?.(80)
    console.log(`[УчиОн] Generated: "${structure.title}", ${structure.slides.length} slides`)

    return structure
  }
}

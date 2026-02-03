import type { PresentationStructure } from '../../../shared/types.js'
import OpenAI from 'openai'
import { getPresentationSubjectConfig } from '../generation/config/presentations/index.js'
import { getPresentationModel } from '../ai-models.js'
import { sanitizeUserInput } from '../generation/sanitize.js'
import type { GeneratePresentationParams } from '../ai-provider.js'

/**
 * Claude Provider for Presentation Generation
 *
 * Uses Anthropic's Claude model (via polza.ai aggregator) for high-quality
 * educational presentation generation. Claude excels at:
 * - Structured content creation
 * - Educational material formatting
 * - Following complex instructions
 * - Consistent JSON output
 */
export class ClaudeProvider {
  private client: OpenAI

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      ...(baseURL && { baseURL })
    })
    console.log('[УчиОн] ClaudeProvider initialized for presentations', {
      baseURL: baseURL || 'default',
      model: getPresentationModel()
    })
  }

  /**
   * Generate a presentation structure using Claude
   * Claude works best with clear, structured prompts and minimal constraints
   */
  async generatePresentation(
    params: GeneratePresentationParams,
    onProgress?: (percent: number) => void
  ): Promise<PresentationStructure> {
    console.log('[УчиОн] ClaudeProvider.generatePresentation called', params)
    onProgress?.(5)

    const subjectConfig = getPresentationSubjectConfig(params.subject)
    const slideCount = params.slideCount || 18

    // Claude-optimized system prompt - more conversational, less rigid
    const systemPrompt = `Ты опытный методист и преподаватель ${subjectConfig.name.toLowerCase()}.
Твоя задача — создавать увлекательные учебные презентации для школьников ${params.grade} класса.

Твой стиль:
- Контент соответствует ФГОС и возрасту учеников
- Теория подается просто и понятно
- Примеры наглядные и запоминающиеся
- Структура логичная: от простого к сложному

Ты всегда отвечаешь валидным JSON без markdown-обертки.`

    // Build style instruction
    let styleDescription: string
    if (params.themeType === 'custom' && params.themeCustom) {
      styleDescription = sanitizeUserInput(params.themeCustom)
    } else {
      styleDescription = 'минимализм: чистый дизайн, много воздуха, акцент на содержании'
    }

    // Claude-optimized user prompt - clear structure, examples
    const userPrompt = `Создай учебную презентацию.

**Тема:** ${params.topic}
**Предмет:** ${subjectConfig.name}
**Класс:** ${params.grade}
**Количество слайдов:** ${slideCount}
**Визуальный стиль:** ${styleDescription}

## Доступные типы слайдов

Используй разнообразные типы для интересной подачи материала:

| Тип | Назначение | Обязательные поля |
|-----|-----------|-------------------|
| title | Титульный слайд | content: [категория, подзаголовок, класс] |
| content | Теория с буллетами | content: [5-7 пунктов] |
| twoColumn | Сравнение/определения | leftColumn, rightColumn |
| table | Таблица данных | tableData: {headers, rows} |
| example | Задача + решение | content: [задача, шаги, ответ] |
| formula | Ключевая формула | content: [формула, пояснение] |
| diagram | Схема/классификация | content: [элементы схемы] |
| practice | Задания для учеников | content: [3-5 заданий] |
| conclusion | Итоги/вопросы | content: [выводы] |

## Требования к содержанию

1. **Первый слайд** (type: "title"):
   - content[0]: название предмета заглавными буквами
   - content[1]: подзаголовок темы
   - content[2]: "${params.grade} класс"

2. **Теоретические слайды**:
   - Обязательно включи определения и правила
   - Используй формулы где уместно
   - Приводи примеры

3. **Практические слайды**:
   - Задания без ответов (ответы на отдельном слайде)
   - 3-5 заданий разной сложности

4. **Последний слайд** (type: "conclusion"):
   - title: "Вопросы?"
   - Краткие итоги урока

## Формат ответа

Верни ТОЛЬКО JSON (без \`\`\`json обертки):

{
  "title": "Название презентации",
  "slides": [
    {
      "type": "title",
      "title": "Тема урока",
      "content": ["ПРЕДМЕТ", "Подзаголовок", "${params.grade} класс"]
    },
    {
      "type": "content",
      "title": "Заголовок слайда",
      "content": ["Пункт 1", "Пункт 2", "Пункт 3", "Пункт 4", "Пункт 5"]
    }
  ]
}

Создай ровно ${slideCount} слайдов. Каждый слайд ОБЯЗАТЕЛЬНО имеет поля type, title, content.`

    onProgress?.(15)

    const model = getPresentationModel()
    console.log(`[УчиОн] Claude presentation model: ${model}`)

    let completion
    try {
      completion = await this.client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 10000,
        temperature: 0.7 // Claude works well with slightly higher temperature for creativity
      })
    } catch (error) {
      console.error('[УчиОн] Claude API Error (generatePresentation):', error)
      throw new Error('AI_ERROR')
    }

    onProgress?.(65)

    const content = completion.choices[0]?.message?.content || ''
    console.log('[УчиОн] Claude presentation response length:', content.length)

    let structure: PresentationStructure
    try {
      // Claude usually returns clean JSON, but let's be safe
      let jsonContent = content.trim()

      // Remove markdown code block if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7)
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3)
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3)
      }
      jsonContent = jsonContent.trim()

      // Try to extract JSON object
      const jsonMatch = jsonContent.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        console.error('[УчиОн] No JSON found in Claude response')
        console.error('[УчиОн] Raw response:', content.substring(0, 500))
        throw new Error('AI_ERROR')
      }

      const parsed = JSON.parse(jsonMatch[0])

      if (!parsed.title || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        console.error('[УчиОн] Invalid presentation structure from Claude:', {
          hasTitle: !!parsed.title,
          slidesCount: parsed.slides?.length
        })
        throw new Error('AI_ERROR')
      }

      // Validate and fix slides
      const validTypes = new Set([
        'title', 'content', 'twoColumn', 'table', 'example',
        'formula', 'diagram', 'chart', 'practice', 'conclusion'
      ])

      for (let i = 0; i < parsed.slides.length; i++) {
        const slide = parsed.slides[i]

        // Ensure required fields
        if (!slide.type || !validTypes.has(slide.type)) {
          console.warn(`[УчиОн] Claude slide ${i}: invalid type "${slide.type}", using "content"`)
          slide.type = 'content'
        }

        if (!slide.title) {
          slide.title = `Слайд ${i + 1}`
        }

        if (!Array.isArray(slide.content)) {
          slide.content = slide.content ? [String(slide.content)] : []
        }

        // Convert all content items to strings
        slide.content = slide.content.map((item: unknown) => String(item))

        // Validate type-specific fields
        if (slide.type === 'table' && slide.tableData) {
          if (!Array.isArray(slide.tableData.headers)) slide.tableData.headers = []
          if (!Array.isArray(slide.tableData.rows)) slide.tableData.rows = []
        }

        if (slide.type === 'twoColumn') {
          if (!Array.isArray(slide.leftColumn)) slide.leftColumn = []
          if (!Array.isArray(slide.rightColumn)) slide.rightColumn = []
        }

        if (slide.type === 'chart' && slide.chartData) {
          if (!Array.isArray(slide.chartData.labels)) slide.chartData.labels = []
          if (!Array.isArray(slide.chartData.values)) slide.chartData.values = []
        }
      }

      structure = {
        title: parsed.title,
        slides: parsed.slides,
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'AI_ERROR') throw e
      console.error('[УчиОн] JSON parse error (Claude presentation):', e)
      throw new Error('AI_ERROR')
    }

    onProgress?.(80)
    console.log(`[УчиОн] Claude presentation generated: "${structure.title}", ${structure.slides.length} slides`)

    // Log slide type distribution for debugging
    const typeCount: Record<string, number> = {}
    for (const slide of structure.slides) {
      typeCount[slide.type] = (typeCount[slide.type] || 0) + 1
    }
    console.log('[УчиОн] Claude slide types:', typeCount)

    return structure
  }
}

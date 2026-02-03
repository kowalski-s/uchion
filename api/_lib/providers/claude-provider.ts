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
      "content": ["текст", "текст"],
      // опционально для таблиц:
      "tableData": {"headers": [...], "rows": [[...], ...]},
      // опционально для двух колонок:
      "leftColumn": [...], "rightColumn": [...]
    }
  ]
}

Типы слайдов (выбирай подходящие):
- title — титульный
- content — текст с пунктами
- twoColumn — две колонки
- table — таблица
- example — пример/задача с решением
- formula — формула крупно
- diagram — схема/структура
- practice — задания для учеников
- conclusion — итоги

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
          ? slide.content.map(String)
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

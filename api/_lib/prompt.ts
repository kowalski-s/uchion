import type { GeneratePayload } from '../../shared/types'

export function generatePrompt({ subject, grade, topic }: GeneratePayload): string {
  return `Ты — методист начальной школы. Сгенерируй рабочий лист строго в формате JSON для предмета ${subject}, класса ${grade}, тема: "${topic}". Структура JSON: { "summary": "...", "tasks": [{"type": "...", "text": "..."}], "questions": ["..."] } Без комментариев и Markdown.`
}

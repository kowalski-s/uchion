import OpenAI from 'openai';
import { getAgentsModel } from '../../../ai-models.js';
const SUBJECT_NAMES = {
    math: 'Математика',
    algebra: 'Алгебра',
    geometry: 'Геометрия',
    russian: 'Русский язык',
};
const MAX_FIXES_PER_GENERATION = 10;
export async function fixTask(task, issue, context) {
    const start = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_BASE_URL;
    const model = getAgentsModel();
    if (!apiKey) {
        return { success: false, originalTask: task, error: 'No API key' };
    }
    const client = new OpenAI({ apiKey, ...(baseURL && { baseURL }) });
    const subjectName = SUBJECT_NAMES[context.subject] || context.subject;
    const suggestionLine = issue.suggestion
        ? `\nРЕКОМЕНДАЦИЯ: ${issue.suggestion}`
        : '';
    const userPrompt = `Ты — редактор учебных материалов. Исправь ошибку в задании.
Предмет: ${subjectName}
Класс: ${context.grade}
Тема: "${context.topic}"

ЗАДАНИЕ С ОШИБКОЙ:
${JSON.stringify(task, null, 2)}

НАЙДЕННАЯ ОШИБКА:
${issue.message}${suggestionLine}

ЗАДАЧА:
1. Исправь ошибку
2. Убедись что ответ правильный
3. Сохрани тип и формат задания (type: "${task.type}")

Верни исправленное задание в том же JSON формате.
Только JSON, без пояснений.`;
    try {
        const completion = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: userPrompt }],
            max_tokens: 2000,
            temperature: 0.2,
        });
        const content = completion.choices[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            const duration = Date.now() - start;
            console.warn(`[task-fixer] No JSON in response (${duration}ms)`);
            return { success: false, originalTask: task, error: 'No JSON in LLM response' };
        }
        const fixedTask = JSON.parse(jsonMatch[0]);
        // Ensure type is preserved
        if (fixedTask.type !== task.type) {
            fixedTask.type = task.type;
        }
        const duration = Date.now() - start;
        const fixDescription = `${issue.code}: исправлено за ${duration}ms`;
        console.log(`[task-fixer] Fixed in ${duration}ms (${issue.code})`);
        return { success: true, originalTask: task, fixedTask, fixDescription };
    }
    catch (error) {
        const duration = Date.now() - start;
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`[task-fixer] Failed in ${duration}ms:`, errMsg);
        return { success: false, originalTask: task, error: errMsg };
    }
}
export { MAX_FIXES_PER_GENERATION };
//# sourceMappingURL=task-fixer.js.map
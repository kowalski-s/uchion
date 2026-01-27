import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt, getTaskCounts, getRecommendedTaskTypes } from './generation/prompts.js';
import { timedLLMCall } from './ai/validator.js';
import { checkValidationScore } from './alerts/generation-alerts.js';
// =============================================================================
// DummyProvider - для разработки без API
// =============================================================================
class DummyProvider {
    async generateWorksheet(params) {
        console.log('[УчиОн] DummyProvider.generateWorksheet called', params);
        // Получаем количество заданий из формата
        const format = params.format || 'test_and_open';
        const variantIndex = params.variantIndex ?? 0;
        const { openTasks, testQuestions } = getTaskCounts(format, variantIndex);
        // Генерируем dummy задания
        const assignments = [];
        for (let i = 0; i < openTasks; i++) {
            assignments.push({
                title: `Задание ${i + 1}`,
                text: `Демо-задание ${i + 1} по теме "${params.topic}"`
            });
        }
        const test = [];
        for (let i = 0; i < testQuestions; i++) {
            test.push({
                question: `Демо-вопрос ${i + 1} по теме "${params.topic}"?`,
                options: ['Вариант А', 'Вариант Б', 'Вариант В', 'Вариант Г'],
                answer: 'Вариант А'
            });
        }
        const answers = {
            assignments: assignments.map((_, i) => `Ответ ${i + 1}`),
            test: test.map(() => 'Вариант А')
        };
        return {
            id: 'dummy-id',
            subject: params.subject,
            grade: `${params.grade} класс`,
            topic: params.topic,
            assignments,
            test,
            answers,
            pdfBase64: ''
        };
    }
}
// =============================================================================
// OpenAIProvider - реальная генерация через AI
// =============================================================================
class OpenAIProvider {
    client;
    constructor(apiKey, baseURL) {
        this.client = new OpenAI({
            apiKey,
            ...(baseURL && { baseURL })
        });
        console.log('[УчиОн] OpenAIProvider initialized', { baseURL: baseURL || 'default (api.openai.com)' });
    }
    async generateWorksheet(params, onProgress) {
        console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params);
        const totalStart = Date.now();
        onProgress?.(5);
        // Получаем параметры генерации
        const format = params.format || 'test_and_open';
        const variantIndex = params.variantIndex ?? 0;
        const difficulty = params.difficulty || 'medium';
        const taskTypes = params.taskTypes?.length
            ? params.taskTypes
            : getRecommendedTaskTypes(format);
        const { openTasks, testQuestions } = getTaskCounts(format, variantIndex);
        const totalTasks = openTasks + testQuestions;
        console.log('[УчиОн] Generation params:', { format, variantIndex, difficulty, taskTypes, openTasks, testQuestions });
        // Собираем промпты
        const promptParams = {
            subject: params.subject,
            grade: params.grade,
            topic: params.topic,
            taskTypes,
            difficulty,
            format,
            variantIndex
        };
        const systemPrompt = buildSystemPrompt(params.subject);
        const userPrompt = buildUserPrompt(promptParams);
        onProgress?.(15);
        // Генерируем задания
        const generationModel = process.env.AI_MODEL_GENERATION || 'gpt-4.1-mini';
        console.log('[УчиОн] Using model:', generationModel);
        let completion;
        try {
            completion = await timedLLMCall("new-generation", () => this.client.chat.completions.create({
                model: generationModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 8000,
                temperature: 0.7
            }));
        }
        catch (error) {
            console.error('[УчиОн] OpenAI API Error:', error);
            throw new Error('AI_ERROR');
        }
        onProgress?.(60);
        // Парсим ответ
        const content = completion.choices[0]?.message?.content || '';
        console.log('[УчиОн] Raw AI response length:', content.length);
        let generatedJson;
        try {
            // Извлекаем JSON из ответа (может быть обёрнут в markdown)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('[УчиОн] No JSON found in response');
                throw new Error('AI_ERROR');
            }
            generatedJson = JSON.parse(jsonMatch[0]);
        }
        catch (e) {
            console.error('[УчиОн] JSON parse error:', e);
            throw new Error('AI_ERROR');
        }
        onProgress?.(75);
        // Валидируем и преобразуем задания
        const tasks = generatedJson.tasks || [];
        console.log('[УчиОн] Generated tasks count:', tasks.length);
        // Разделяем задания на тестовые и открытые
        const testTasks = [];
        const openTasksList = [];
        for (const task of tasks) {
            if (task.type === 'single_choice' || task.type === 'multiple_choice') {
                testTasks.push(task);
            }
            else {
                openTasksList.push(task);
            }
        }
        // Преобразуем в формат Worksheet
        const worksheet = this.convertToWorksheet(params, testTasks, openTasksList, testQuestions, openTasks);
        onProgress?.(90);
        // Алерт о низком качестве (если мало заданий)
        if (tasks.length < totalTasks * 0.8) {
            checkValidationScore({
                score: Math.round((tasks.length / totalTasks) * 10),
                topic: params.topic,
                subject: params.subject,
                grade: params.grade,
            }).catch((e) => console.error('[Alerts] Failed to check:', e));
        }
        console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
        onProgress?.(95);
        return worksheet;
    }
    /**
     * Преобразует сгенерированные задания в формат Worksheet
     */
    convertToWorksheet(params, testTasks, openTasksList, targetTestCount, targetOpenCount) {
        // Преобразуем тестовые задания
        const test = testTasks.slice(0, targetTestCount).map(task => {
            if (task.type === 'single_choice') {
                const options = task.options || [];
                const correctIdx = task.correctIndex ?? 0;
                return {
                    question: task.question || '',
                    options,
                    answer: options[correctIdx] || options[0] || ''
                };
            }
            else if (task.type === 'multiple_choice') {
                const options = task.options || [];
                const correctIdxs = task.correctIndices || [0];
                const answers = correctIdxs.map(i => options[i]).filter(Boolean);
                return {
                    question: task.question || '',
                    options,
                    answer: answers.join(', ')
                };
            }
            return { question: '', options: [], answer: '' };
        });
        // Преобразуем открытые задания
        const assignments = openTasksList.slice(0, targetOpenCount).map((task, i) => {
            let text = '';
            if (task.type === 'open_question') {
                text = task.question || '';
            }
            else if (task.type === 'matching') {
                const left = task.leftColumn || [];
                const right = task.rightColumn || [];
                text = `${task.instruction || 'Соотнеси элементы'}\n\nЛевый столбец:\n${left.map((l, i) => `${i + 1}. ${l}`).join('\n')}\n\nПравый столбец:\n${right.map((r, i) => `${String.fromCharCode(65 + i)}. ${r}`).join('\n')}`;
            }
            else if (task.type === 'fill_blank') {
                text = task.textWithBlanks || '';
            }
            return {
                title: `Задание ${i + 1}`,
                text
            };
        });
        // Собираем ответы
        const answersAssignments = openTasksList.slice(0, targetOpenCount).map(task => {
            if (task.type === 'open_question') {
                return task.correctAnswer || '';
            }
            else if (task.type === 'matching') {
                const pairs = task.correctPairs || [];
                return pairs.map(([l, r]) => `${l + 1}-${String.fromCharCode(65 + r)}`).join(', ');
            }
            else if (task.type === 'fill_blank') {
                const blanks = task.blanks || [];
                return blanks.map(b => `(${b.position}) ${b.correctAnswer}`).join('; ');
            }
            return '';
        });
        const answersTest = testTasks.slice(0, targetTestCount).map(task => {
            if (task.type === 'single_choice') {
                const options = task.options || [];
                const idx = task.correctIndex ?? 0;
                return options[idx] || '';
            }
            else if (task.type === 'multiple_choice') {
                const options = task.options || [];
                const idxs = task.correctIndices || [];
                return idxs.map(i => options[i]).filter(Boolean).join(', ');
            }
            return '';
        });
        return {
            id: '',
            subject: params.subject,
            grade: `${params.grade} класс`,
            topic: params.topic,
            assignments,
            test,
            answers: {
                assignments: answersAssignments,
                test: answersTest
            },
            pdfBase64: ''
        };
    }
}
// =============================================================================
// Factory
// =============================================================================
export function getAIProvider() {
    const isProd = process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production';
    const aiProvider = process.env.AI_PROVIDER;
    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = process.env.AI_BASE_URL;
    const useAI = (isProd && aiProvider === 'openai' && apiKey) ||
        (aiProvider === 'polza' && apiKey) ||
        (aiProvider === 'neuroapi' && apiKey);
    console.log('[УчиОн] getAIProvider:', {
        isProd,
        AI_PROVIDER: aiProvider,
        AI_BASE_URL: baseURL || 'default',
        useAI: !!useAI,
    });
    if (useAI) {
        return new OpenAIProvider(apiKey, baseURL);
    }
    return new DummyProvider();
}
//# sourceMappingURL=ai-provider.js.map
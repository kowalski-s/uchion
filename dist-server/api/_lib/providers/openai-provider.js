import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt, getTaskCounts, getRecommendedTaskTypes } from '../generation/prompts.js';
import { getTaskType, getDifficultyPrompt, } from '../generation/config/index.js';
import { timedLLMCall } from '../ai/validator.js';
import { sanitizeUserInput } from '../generation/sanitize.js';
import { checkValidationScore } from '../alerts/generation-alerts.js';
import { validateWorksheet as validateTasksDeterministic } from '../generation/validation/deterministic.js';
import { runMultiAgentValidation } from '../generation/validation/agents/index.js';
import { getPresentationSubjectConfig } from '../generation/config/presentations/index.js';
import { getGenerationModel } from '../ai-models.js';
import { getCircuitBreaker } from './circuit-breaker.js';
// =============================================================================
// OpenAIProvider - real generation via AI
// =============================================================================
export class OpenAIProvider {
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
        const format = params.format || 'test_and_open';
        const variantIndex = params.variantIndex ?? 0;
        const difficulty = params.difficulty || 'medium';
        const taskTypes = params.taskTypes?.length
            ? params.taskTypes
            : getRecommendedTaskTypes(format);
        const { openTasks, testQuestions } = getTaskCounts(format, variantIndex);
        const totalTasks = openTasks + testQuestions;
        console.log('[УчиОн] Generation params:', { format, variantIndex, difficulty, taskTypes, openTasks, testQuestions });
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
        const isPaid = params.isPaid ?? false;
        const generationModel = getGenerationModel(isPaid);
        console.log(`[УчиОн] Generation model: ${generationModel} (isPaid: ${isPaid})`);
        let completion;
        try {
            completion = await timedLLMCall("new-generation", () => this.client.chat.completions.create({
                model: generationModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 8000,
                temperature: 0.5
            }));
        }
        catch (error) {
            console.error('[УчиОн] OpenAI API Error:', error);
            throw new Error('AI_ERROR');
        }
        onProgress?.(60);
        const content = completion.choices[0]?.message?.content || '';
        console.log('[УчиОн] Raw AI response length:', content.length);
        let generatedJson;
        try {
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
        let tasks = generatedJson.tasks || [];
        console.log('[УчиОн] Generated tasks count:', tasks.length, 'Expected:', totalTasks);
        let testTasks = [];
        let openTasksList = [];
        for (const task of tasks) {
            if (task.type === 'single_choice' || task.type === 'multiple_choice') {
                testTasks.push(task);
            }
            else {
                openTasksList.push(task);
            }
        }
        console.log('[УчиОн] Split: testTasks=', testTasks.length, 'openTasksList=', openTasksList.length);
        console.log('[УчиОн] Targets: testQuestions=', testQuestions, 'openTasks=', openTasks);
        // RETRY: Generate missing tasks (up to 3 attempts) with exponential backoff
        // Circuit breaker prevents retries if AI provider is systematically failing
        const circuitBreaker = getCircuitBreaker();
        const MAX_RETRIES = 3;
        // Check circuit breaker before starting retry loop
        if (circuitBreaker.isOpen()) {
            console.warn('[УчиОн] Circuit breaker is OPEN - skipping retry loop due to systematic AI failures');
        }
        else {
            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                const missingOpen = openTasks - openTasksList.length;
                const missingTest = testQuestions - testTasks.length;
                if (missingOpen <= 0 && missingTest <= 0)
                    break;
                console.log(`[УчиОн] Task count mismatch: got ${openTasksList.length} open (expected ${openTasks}), ${testTasks.length} test (expected ${testQuestions}). Retrying... (attempt ${attempt}/${MAX_RETRIES})`);
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
                const retryOpenCount = Math.max(0, missingOpen);
                const retryTestCount = Math.max(0, missingTest);
                // Early exit if nothing to retry
                if (retryOpenCount === 0 && retryTestCount === 0)
                    break;
                try {
                    const retryTasks = await this.generateMissingTasks(params, retryOpenCount, retryTestCount, taskTypes, difficulty);
                    for (const task of retryTasks) {
                        if (task.type === 'single_choice' || task.type === 'multiple_choice') {
                            testTasks.push(task);
                        }
                        else {
                            openTasksList.push(task);
                        }
                    }
                    console.log(`[УчиОн] After retry ${attempt}: testTasks=${testTasks.length}, openTasksList=${openTasksList.length}`);
                    // Record success in circuit breaker
                    circuitBreaker.recordSuccess();
                }
                catch (retryError) {
                    console.error(`[УчиОн] Retry ${attempt} failed:`, retryError);
                    // Record failure in circuit breaker
                    circuitBreaker.recordFailure();
                }
            }
        }
        const finalMissingOpen = openTasks - openTasksList.length;
        const finalMissingTest = testQuestions - testTasks.length;
        if (finalMissingOpen > 0 || finalMissingTest > 0) {
            console.warn(`[УчиОн] After ${MAX_RETRIES} retries still missing: ${Math.max(0, finalMissingOpen)} open, ${Math.max(0, finalMissingTest)} test`);
        }
        // Deterministic validation (no LLM)
        const allTasks = [...testTasks, ...openTasksList];
        const validationResult = validateTasksDeterministic(allTasks, params.subject, params.grade);
        if (!validationResult.valid) {
            console.warn(`[УчиОн] Validation errors (${validationResult.errors.length}):`, validationResult.errors.map(e => `  [${e.taskIndex}] ${e.code}: ${e.message}`).join('\n'));
            const badTaskIndices = new Set(validationResult.errors.map(e => e.taskIndex));
            const cleanTest = testTasks.filter((_, idx) => !badTaskIndices.has(idx));
            const testOffset = testTasks.length;
            const cleanOpen = openTasksList.filter((_, idx) => !badTaskIndices.has(idx + testOffset));
            if (cleanTest.length < testTasks.length || cleanOpen.length < openTasksList.length) {
                console.log(`[УчиОн] Removed ${testTasks.length - cleanTest.length} test + ${openTasksList.length - cleanOpen.length} open invalid tasks`);
                testTasks = cleanTest;
                openTasksList = cleanOpen;
            }
        }
        if (validationResult.warnings.length > 0) {
            console.log(`[УчиОн] Validation warnings (${validationResult.warnings.length}):`, validationResult.warnings.map(w => `  [${w.taskIndex}] ${w.code}: ${w.message}`).join('\n'));
        }
        // Multi-agent validation (LLM-based, parallel) + auto-fix
        const allTasksForAgents = [...testTasks, ...openTasksList];
        const agentValidation = await runMultiAgentValidation(allTasksForAgents, { subject: params.subject, grade: params.grade, topic: params.topic, difficulty }, { autoFix: true });
        if (agentValidation.problemTasks.length > 0) {
            console.warn(`[УчиОн] Agent validation: ${agentValidation.problemTasks.length} problem tasks:`, agentValidation.allIssues.map(i => `  [${i.taskIndex}] (${i.agent}) ${i.issue.code}: ${i.issue.message}`).join('\n'));
            const fixedCount = agentValidation.fixResults.filter(r => r.success).length;
            console.log(`[УчиОн] Fixed ${fixedCount} of ${agentValidation.fixResults.length} problem tasks`);
        }
        else {
            console.log('[УчиОн] Agent validation: all tasks OK');
        }
        const finalTasks = agentValidation.fixedTasks;
        const testOffset = testTasks.length;
        testTasks = finalTasks.slice(0, testOffset);
        openTasksList = finalTasks.slice(testOffset);
        const worksheet = this.convertToWorksheet(params, testTasks, openTasksList, testQuestions, openTasks);
        onProgress?.(90);
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
     * Convert generated tasks to Worksheet format
     */
    convertToWorksheet(params, testTasks, openTasksList, targetTestCount, targetOpenCount) {
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
        const assignments = openTasksList.slice(0, targetOpenCount).map((task, i) => {
            let text = '';
            if (task.type === 'open_question') {
                text = task.question || '';
            }
            else if (task.type === 'matching') {
                const matchingData = {
                    type: 'matching',
                    instruction: task.instruction || 'Соотнеси элементы',
                    leftColumn: task.leftColumn || [],
                    rightColumn: task.rightColumn || [],
                };
                text = `<!--MATCHING:${JSON.stringify(matchingData)}-->`;
            }
            else if (task.type === 'fill_blank') {
                text = task.textWithBlanks || '';
            }
            return {
                title: `Задание ${i + 1}`,
                text
            };
        });
        const answersAssignments = openTasksList.slice(0, targetOpenCount).map((task, i) => {
            let answer = '';
            if (task.type === 'open_question') {
                answer = task.correctAnswer || '';
            }
            else if (task.type === 'matching') {
                const pairs = task.correctPairs || [];
                answer = pairs.map(([l, r]) => `${l + 1}-${String.fromCharCode(65 + r)}`).join(', ');
            }
            else if (task.type === 'fill_blank') {
                const blanks = task.blanks || [];
                answer = blanks.map(b => `(${b.position}) ${b.correctAnswer}`).join('; ');
            }
            if (!answer) {
                console.warn(`[УчиОн] Empty answer for open task ${i} (type: ${task.type})`, {
                    hasCorrectAnswer: !!task.correctAnswer,
                    hasCorrectPairs: !!(task.correctPairs?.length),
                    hasBlanks: !!(task.blanks?.length),
                });
            }
            return answer;
        });
        const answersTest = testTasks.slice(0, targetTestCount).map((task, i) => {
            let answer = '';
            if (task.type === 'single_choice') {
                const options = task.options || [];
                const idx = task.correctIndex ?? 0;
                if (idx >= options.length) {
                    console.warn(`[УчиОн] single_choice task ${i}: correctIndex ${idx} out of bounds (options: ${options.length})`);
                }
                answer = options[idx] || options[0] || '';
            }
            else if (task.type === 'multiple_choice') {
                const options = task.options || [];
                const idxs = task.correctIndices || [0];
                const outOfBounds = idxs.filter(idx => idx >= options.length);
                if (outOfBounds.length > 0) {
                    console.warn(`[УчиОн] multiple_choice task ${i}: correctIndices ${outOfBounds.join(',')} out of bounds (options: ${options.length})`);
                }
                answer = idxs.map(idx => options[idx]).filter(Boolean).join(', ');
            }
            if (!answer) {
                console.warn(`[УчиОн] Empty answer for test task ${i} (type: ${task.type})`, {
                    hasOptions: !!(task.options?.length),
                    correctIndex: task.correctIndex,
                    correctIndices: task.correctIndices,
                });
            }
            return answer;
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
    /**
     * Convert a single GeneratedTask to assignment/testQuestion + answer
     */
    convertSingleTask(task, isTest) {
        if (isTest) {
            if (task.type === 'single_choice') {
                const options = task.options || [];
                const correctIdx = task.correctIndex ?? 0;
                const answer = options[correctIdx] || options[0] || '';
                return {
                    testQuestion: {
                        question: task.question || '',
                        options,
                        answer
                    },
                    answer
                };
            }
            else if (task.type === 'multiple_choice') {
                const options = task.options || [];
                const correctIdxs = task.correctIndices || [0];
                const answers = correctIdxs.map(i => options[i]).filter(Boolean);
                const answer = answers.join(', ');
                return {
                    testQuestion: {
                        question: task.question || '',
                        options,
                        answer
                    },
                    answer
                };
            }
            return { testQuestion: { question: '', options: [], answer: '' }, answer: '' };
        }
        let text = '';
        let answer = '';
        if (task.type === 'open_question') {
            text = task.question || '';
            answer = task.correctAnswer || '';
        }
        else if (task.type === 'matching') {
            const matchingData = {
                type: 'matching',
                instruction: task.instruction || 'Соотнеси элементы',
                leftColumn: task.leftColumn || [],
                rightColumn: task.rightColumn || [],
            };
            text = `<!--MATCHING:${JSON.stringify(matchingData)}-->`;
            const pairs = task.correctPairs || [];
            answer = pairs.map(([l, r]) => `${l + 1}-${String.fromCharCode(65 + r)}`).join(', ');
        }
        else if (task.type === 'fill_blank') {
            text = task.textWithBlanks || '';
            const blanks = task.blanks || [];
            answer = blanks.map(b => `(${b.position}) ${b.correctAnswer}`).join('; ');
        }
        return {
            assignment: { title: 'Задание', text },
            answer
        };
    }
    /**
     * Regenerate a single task via LLM
     */
    async regenerateTask(params) {
        console.log('[УчиОн] OpenAIProvider.regenerateTask called', params);
        const systemPrompt = buildSystemPrompt(params.subject);
        const taskTypeConfig = getTaskType(params.taskType);
        const difficultyPrompt = getDifficultyPrompt(params.difficulty, params.subject, params.grade);
        const userPrompt = `
Создай РОВНО 1 задание для рабочего листа.

Предмет: ${params.subject}
Класс: ${params.grade}
Тема: "${params.topic}"
Сложность: ${difficultyPrompt}

Тип задания: ${taskTypeConfig.name}
${taskTypeConfig.promptInstruction}

Верни JSON:
{
  "tasks": [
    { "type": "${params.taskType}", ... }
  ]
}

ВАЖНО: Создай РОВНО 1 задание, не больше и не меньше!
`.trim();
        const isPaid = params.isPaid ?? false;
        const generationModel = getGenerationModel(isPaid);
        console.log(`[УчиОн] Regenerate model: ${generationModel} (isPaid: ${isPaid})`);
        let completion;
        try {
            completion = await timedLLMCall("regenerate-task", () => this.client.chat.completions.create({
                model: generationModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 2000,
                temperature: 0.5
            }));
        }
        catch (error) {
            console.error('[УчиОн] OpenAI API Error (regenerateTask):', error);
            throw new Error('AI_ERROR');
        }
        const content = completion.choices[0]?.message?.content || '';
        let generatedJson;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch)
                throw new Error('No JSON');
            generatedJson = JSON.parse(jsonMatch[0]);
        }
        catch (e) {
            console.error('[УчиОн] JSON parse error (regenerateTask):', e);
            throw new Error('AI_ERROR');
        }
        const task = generatedJson.tasks?.[0];
        if (!task) {
            console.error('[УчиОн] No task in response (regenerateTask)');
            throw new Error('AI_ERROR');
        }
        return this.convertSingleTask(task, params.isTest);
    }
    /**
     * Generate a presentation structure via LLM
     */
    async generatePresentation(params, onProgress) {
        console.log('[УчиОн] OpenAIProvider.generatePresentation called', params);
        onProgress?.(5);
        const subjectConfig = getPresentationSubjectConfig(params.subject);
        const systemPrompt = `${subjectConfig.systemPrompt} Ты опытный методист-${subjectConfig.name.toLowerCase()}, создаёшь учебные презентации для ${params.grade} класса. Контент должен быть по ФГОС.`;
        let styleInstruction;
        if (params.themeType === 'custom' && params.themeCustom) {
            styleInstruction = `Стиль: <user_style>${sanitizeUserInput(params.themeCustom)}</user_style>`;
        }
        else if (params.themeType === 'preset' && params.themePreset) {
            styleInstruction = `Стиль: ${params.themePreset}`;
        }
        else {
            styleInstruction = 'Стиль: professional';
        }
        const slideCount = params.slideCount || 18;
        const subjectHints = {
            math: 'Обязательно используй слайды типа "example" (задача + пошаговое решение) и "formula" (ключевые формулы). Добавь "practice" (задачи для самостоятельного решения). Используй "table" для сравнений/свойств.',
            algebra: 'Обязательно используй "formula" (формулы, тождества), "example" (примеры решения уравнений/неравенств), "chart" (графики функций с числовыми данными). Добавь "practice" слайд.',
            geometry: 'Обязательно используй "formula" (теоремы, формулы), "diagram" (описание геометрических фигур и их свойств), "example" (задачи с решением). Используй "table" для сравнения фигур.',
            russian: 'Обязательно используй "table" (правила, исключения, парадигмы), "example" (разбор предложений/слов), "twoColumn" (сравнение правил). Добавь "practice" слайд с упражнениями.',
        };
        const subjectHint = subjectHints[params.subject] || '';
        const userPrompt = `Создай презентацию на тему "${params.topic}" для ${params.grade} класса по предмету "${subjectConfig.name}". Ровно ${slideCount} слайдов.

Доступные типы слайдов (используй РАЗНООБРАЗНО, не только "content"):
- "title" — первый слайд: заголовок + подзаголовок
- "content" — обычный слайд с буллетами (4-6 пунктов, подробно!)
- "twoColumn" — два столбца для сравнений. Поля: leftColumn (массив строк), rightColumn (массив строк)
- "table" — таблица с данными. Поле: tableData: {headers: [...], rows: [[...], [...]]}
- "example" — задача/пример + пошаговое решение (content: ["Задача: ...", "Шаг 1: ...", "Шаг 2: ...", "Ответ: ..."])
- "formula" — ключевая формула/правило крупно (content: ["формула", "пояснение", "где ..."])
- "diagram" — описание схемы/классификации (content: ["Элемент 1 → описание", "Элемент 2 → описание"])
- "chart" — диаграмма. Поле: chartData: {labels: [...], values: [...числа...]}
- "practice" — практические задания (content: ["1. Задание ...", "2. Задание ...", "3. Задание ..."])
- "conclusion" — последний слайд: итоги/выводы

${subjectHint}

${styleInstruction}

Верни JSON:
{"title": "Название", "slides": [
  {"type": "title", "title": "...", "content": ["подзаголовок"]},
  {"type": "content", "title": "...", "content": ["пункт1", "пункт2", "пункт3", "пункт4"]},
  {"type": "twoColumn", "title": "Сравнение ...", "content": ["Описание"], "leftColumn": ["А", "Б"], "rightColumn": ["В", "Г"]},
  {"type": "table", "title": "...", "content": [], "tableData": {"headers": ["Кол1","Кол2"], "rows": [["a","b"],["c","d"]]}},
  {"type": "example", "title": "Пример", "content": ["Задача: ...", "Решение: шаг 1 ...", "Ответ: ..."]},
  {"type": "formula", "title": "Формула", "content": ["S = a * b", "где a — длина, b — ширина"]},
  {"type": "chart", "title": "...", "content": ["Описание"], "chartData": {"labels": ["A","B","C"], "values": [10,20,30]}},
  {"type": "practice", "title": "Практика", "content": ["1. Задание...", "2. Задание...", "3. Задание..."]},
  {"type": "conclusion", "title": "Итоги", "content": ["вывод1", "вывод2", "вывод3"]}
]}

ВАЖНО:
- Ровно ${slideCount} слайдов
- Первый слайд type="title", последний type="conclusion"
- Используй МИНИМУМ 4-5 РАЗНЫХ типов слайдов (не только "content"!)
- Каждый слайд ОБЯЗАТЕЛЬНО имеет поля "type", "title", "content" (массив строк)
- На content-слайдах пиши 4-6 подробных пунктов, не 2-3
- Контент должен быть содержательным, по ФГОС, для ${params.grade} класса
- Для "table" обязательно заполни tableData, для "twoColumn" — leftColumn/rightColumn, для "chart" — chartData`;
        onProgress?.(15);
        const isPaid = params.isPaid ?? false;
        const generationModel = getGenerationModel(isPaid);
        console.log(`[УчиОн] Presentation model: ${generationModel} (isPaid: ${isPaid})`);
        let completion;
        try {
            completion = await timedLLMCall("presentation-generation", () => this.client.chat.completions.create({
                model: generationModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 8000,
                temperature: 0.6
            }));
        }
        catch (error) {
            console.error('[УчиОн] OpenAI API Error (generatePresentation):', error);
            throw new Error('AI_ERROR');
        }
        onProgress?.(65);
        const content = completion.choices[0]?.message?.content || '';
        console.log('[УчиОн] Presentation raw response length:', content.length);
        let structure;
        try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('[УчиОн] No JSON found in presentation response');
                throw new Error('AI_ERROR');
            }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.title || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
                console.error('[УчиОн] Invalid presentation structure:', { hasTitle: !!parsed.title, slidesCount: parsed.slides?.length });
                throw new Error('AI_ERROR');
            }
            const validTypes = new Set(['title', 'content', 'twoColumn', 'table', 'example', 'formula', 'diagram', 'chart', 'practice', 'conclusion']);
            for (let i = 0; i < parsed.slides.length; i++) {
                const slide = parsed.slides[i];
                if (!slide.type || !slide.title || !Array.isArray(slide.content)) {
                    console.warn(`[УчиОн] Fixing slide ${i}: missing fields`, { type: slide.type, title: slide.title, hasContent: Array.isArray(slide.content) });
                    slide.type = slide.type || 'content';
                    slide.title = slide.title || `Слайд ${i + 1}`;
                    slide.content = Array.isArray(slide.content) ? slide.content : (slide.content ? [String(slide.content)] : []);
                }
                if (!validTypes.has(slide.type)) {
                    console.warn(`[УчиОн] Unknown slide type "${slide.type}" at index ${i}, falling back to "content"`);
                    slide.type = 'content';
                }
                slide.content = slide.content.map((item) => String(item));
                if (slide.tableData) {
                    if (!Array.isArray(slide.tableData.headers))
                        slide.tableData.headers = [];
                    if (!Array.isArray(slide.tableData.rows))
                        slide.tableData.rows = [];
                }
                if (slide.leftColumn && !Array.isArray(slide.leftColumn))
                    slide.leftColumn = [];
                if (slide.rightColumn && !Array.isArray(slide.rightColumn))
                    slide.rightColumn = [];
                if (slide.chartData) {
                    if (!Array.isArray(slide.chartData.labels))
                        slide.chartData.labels = [];
                    if (!Array.isArray(slide.chartData.values))
                        slide.chartData.values = [];
                }
            }
            structure = {
                title: parsed.title,
                slides: parsed.slides,
            };
        }
        catch (e) {
            if (e instanceof Error && e.message === 'AI_ERROR')
                throw e;
            console.error('[УчиОн] JSON parse error (generatePresentation):', e);
            throw new Error('AI_ERROR');
        }
        onProgress?.(75);
        console.log(`[УчиОн] Presentation generated: "${structure.title}", ${structure.slides.length} slides`);
        return structure;
    }
    /**
     * Generate missing tasks (retry)
     */
    async generateMissingTasks(params, missingOpen, missingTest, taskTypes, difficulty) {
        const openTypes = taskTypes.filter(t => !['single_choice', 'multiple_choice'].includes(t));
        const testTypes = taskTypes.filter(t => ['single_choice', 'multiple_choice'].includes(t));
        const tasksToGenerate = [];
        const jsonExamples = [];
        if (missingTest > 0 && testTypes.length > 0) {
            const typeToUse = testTypes[Math.floor(Math.random() * testTypes.length)];
            tasksToGenerate.push(`- ${missingTest} тестовых вопросов типа "${typeToUse}"`);
            if (typeToUse === 'single_choice') {
                jsonExamples.push(`    {"type":"single_choice","question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}`);
            }
            else {
                jsonExamples.push(`    {"type":"multiple_choice","question":"...","options":["A","B","C","D"],"correctIndices":[0,2],"explanation":"..."}`);
            }
        }
        if (missingOpen > 0 && openTypes.length > 0) {
            const typeToUse = openTypes[Math.floor(Math.random() * openTypes.length)];
            tasksToGenerate.push(`- ${missingOpen} открытых заданий типа "${typeToUse}"`);
            if (typeToUse === 'open_question') {
                jsonExamples.push(`    {"type":"open_question","question":"...","correctAnswer":"..."}`);
            }
            else if (typeToUse === 'matching') {
                jsonExamples.push(`    {"type":"matching","instruction":"...","leftColumn":["..."],"rightColumn":["..."],"correctPairs":[[0,1],[1,0]]}`);
            }
            else if (typeToUse === 'fill_blank') {
                jsonExamples.push(`    {"type":"fill_blank","textWithBlanks":"Текст ___(1)___ ...","blanks":[{"position":1,"correctAnswer":"..."}]}`);
            }
        }
        if (tasksToGenerate.length === 0) {
            return [];
        }
        const totalNeeded = missingOpen + missingTest;
        const difficultyPrompt = getDifficultyPrompt(difficulty, params.subject, params.grade);
        const systemPrompt = buildSystemPrompt(params.subject);
        const retryPrompt = `Создай дополнительные задания по теме "${params.topic}" для ${params.grade} класса.
Сложность: ${difficultyPrompt}

СОЗДАЙ РОВНО ${totalNeeded} заданий:
${tasksToGenerate.join('\n')}

Верни JSON строго в таком формате:
{
  "tasks": [
${jsonExamples.join(',\n')}
  ]
}

В массиве "tasks" должно быть РОВНО ${totalNeeded} элементов. Не больше и не меньше!
Каждое задание ОБЯЗАТЕЛЬНО должно иметь поле "type".`;
        const isPaid = params.isPaid ?? false;
        const generationModel = getGenerationModel(isPaid);
        const completion = await this.client.chat.completions.create({
            model: generationModel,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: retryPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.4
        });
        const retryContent = completion.choices[0]?.message?.content || '';
        const jsonMatch = retryContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('[УчиОн] RETRY: No JSON found in response');
            return [];
        }
        try {
            const parsed = JSON.parse(jsonMatch[0]);
            const tasks = parsed.tasks || [];
            console.log(`[УчиОн] RETRY: requested ${totalNeeded}, got ${tasks.length}`);
            return tasks;
        }
        catch {
            console.error('[УчиОн] RETRY: JSON parse error');
            return [];
        }
    }
}
//# sourceMappingURL=openai-provider.js.map
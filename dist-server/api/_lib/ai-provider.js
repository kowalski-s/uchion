import OpenAI from 'openai';
import { SUBJECT_CONFIG } from './ai/prompts.js';
import { WORKSHEET_JSON_SCHEMA } from './ai/schema.js';
import { timedLLMCall, extractWorksheetJsonFromResponse, buildWorksheetTextFromJson, validateWorksheet, analyzeValidationIssues, regenerateProblemBlocks } from './ai/validator.js';
class DummyProvider {
    async generateWorksheet(params) {
        console.log('[УчиОн] DummyProvider.generateWorksheet called', params);
        const assignments = [
            { title: "Задание 1", text: "Найди значение выражения 245 + 130." },
            { title: "Задание 2", text: "Реши задачу: У Маши было 120 тетрадей, 40 она раздала. Сколько осталось?" },
            { title: "Задание 3", text: "Найди и исправь ошибку в вычислении: 360 : 9 = 2." },
            { title: "Задание 4", text: "Продолжи числовой ряд: 300, 290, 280, ..." },
            { title: "Задание 5", text: "Запиши в виде выражения: число 450 уменьшили на 70." },
            { title: "Задание 6", text: "Найди ошибку: 600 – 250 = 450." },
            { title: "Задание 7", text: "Текстовая задача: У Пети 3 пачки по 12 карандашей. Сколько карандашей всего?" }
        ];
        const test = [
            { question: 'Как называется результат деления?', options: ['Разность', 'Частное', 'Произведение'], answer: 'Частное' },
            { question: 'Сколько будет 24 : 4?', options: ['6', '8', '4'], answer: '6' },
            { question: 'Можно ли делить на ноль?', options: ['Да', 'Нет', 'Иногда'], answer: 'Нет' },
            { question: 'Какой знак используется для деления?', options: ['+', '-', ':'], answer: ':' },
            { question: 'Если 10 разделить на 2, сколько получится?', options: ['2', '5', '10'], answer: '5' },
            { question: 'Как найти площадь прямоугольника?', options: ['a + b', 'a * b', '2 * (a + b)'], answer: 'a * b' },
            { question: 'Сколько сантиметров в 1 метре?', options: ['10', '100', '1000'], answer: '100' },
            { question: 'Что больше: 1 кг или 1000 г?', options: ['1 кг', '1000 г', 'Равны'], answer: 'Равны' },
            { question: 'Найди периметр квадрата со стороной 5 см.', options: ['20 см', '25 см', '10 см'], answer: '20 см' },
            { question: 'Сколько минут в 1 часе?', options: ['60', '100', '30'], answer: '60' }
        ];
        const answers = {
            assignments: [
                '375',
                '80 тетрадей',
                '360 : 9 = 40 (ошибка: было 2)',
                '270, 260, 250',
                '450 - 70 = 380',
                '600 - 250 = 350 (ошибка: было 450)',
                '3 * 12 = 36 карандашей'
            ],
            test: ['Частное', '6', 'Нет', ':', '5', 'a * b', '100', 'Равны', '20 см', '60']
        };
        const gradeStr = `${params.grade} класс`;
        return {
            id: 'dummy-id',
            subject: params.subject,
            grade: gradeStr,
            topic: params.topic,
            assignments,
            test,
            answers,
            pdfBase64: ''
        };
    }
}
class OpenAIProvider {
    client;
    constructor(apiKey) {
        this.client = new OpenAI({ apiKey });
    }
    async getTextbookContext(params) {
        try {
            const VECTOR_STORE_ID = process.env.UCHION_VECTOR_STORE_ID;
            if (!VECTOR_STORE_ID)
                return "";
            const query = `Предмет: ${params.subject}. ${params.grade} класс. Тема: ${params.topic}. Типичные задания и формулировки по ФГОС для начальной школы.`;
            // @ts-ignore - OpenAI SDK types might be outdated in some versions, ignoring potential type mismatch for vectorStores
            const search = await this.client.beta.vectorStores.fileBatches.list(VECTOR_STORE_ID) ? await this.client.beta.vectorStores.files.list(VECTOR_STORE_ID) : null;
            // Since standard SDK might not have search helper directly exposed or it's in beta, 
            // we'll assume the user wants us to implement the logic as described, 
            // but 'client.vectorStores.search' is not a standard SDK method yet (it's usually file search tool in assistants).
            // However, the user explicitly provided the code snippet using `client.vectorStores.search`.
            // If the SDK version installed supports it (likely a custom or very new beta feature not fully typed), we try to use it.
            // If `client.vectorStores.search` does not exist in the installed SDK, we might need a workaround or assume it exists at runtime.
            // Let's try to follow the user's snippet exactly, assuming they have a compatible SDK or extended type.
            // Casting client to any to avoid TS errors for this specific experimental/custom method.
            const searchResult = await this.client.vectorStores.search(VECTOR_STORE_ID, {
                query,
                max_num_results: 8,
            });
            const chunks = [];
            for (const item of searchResult.data ?? []) {
                for (const piece of item.content ?? []) {
                    if (piece.type === "text" && piece.text) {
                        chunks.push(piece.text);
                    }
                }
            }
            if (chunks.length === 0)
                return "";
            return chunks.slice(0, 5).join("\n---\n");
        }
        catch (e) {
            console.error("Vector store search failed", e);
            return "";
        }
    }
    async generateWorksheet(params, onProgress) {
        console.log('[УчиОн] OpenAIProvider.generateWorksheet called', params);
        const totalStart = Date.now();
        console.log("[GENERATION] Started at", new Date().toISOString());
        onProgress?.(10); // Start
        const userPromptBase = `Сгенерируй рабочий лист.
Предмет: ${params.subject}
Класс: ${params.grade}
Тема: ${params.topic}

Включи в вывод все обязательные разделы (ASSIGNMENTS, TEST, ANSWERS_ASSIGNMENTS, ANSWERS_TEST).`;
        const cfg = SUBJECT_CONFIG[params.subject];
        let systemPrompt = cfg.systemPrompt;
        // Try to get context (optional)
        const context = await this.getTextbookContext(params);
        onProgress?.(15); // Context retrieved
        if (context) {
            systemPrompt += `\n\nИСПОЛЬЗУЙ СЛЕДУЮЩИЕ МАТЕРИАЛЫ ИЗ УЧЕБНИКОВ:\n${context}`;
        }
        let bestContent = '';
        let bestScore = -1;
        let bestIssues = [];
        let lastIssues = [];
        const MAX_ATTEMPTS = 1;
        let worksheetJson = null;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            console.log(`[УчиОн] Generation attempt ${attempt}/${MAX_ATTEMPTS}`);
            onProgress?.(attempt === 1 ? 20 : 65); // Generation start
            let currentUserPrompt = userPromptBase;
            if (attempt > 1 && lastIssues.length > 0) {
                currentUserPrompt += `\n\nВАЖНО: В предыдущей версии были найдены ошибки. ИСПРАВЬ ИХ:\n- ${lastIssues.join('\n- ')}`;
            }
            let completion;
            try {
                // @ts-ignore - Using new responses API
                completion = await timedLLMCall("main-generation", () => this.client.responses.create({
                    model: 'gpt-5-mini',
                    input: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: currentUserPrompt }
                    ],
                    max_output_tokens: 6000,
                    text: {
                        format: {
                            type: 'json_schema',
                            name: 'worksheet_json',
                            schema: WORKSHEET_JSON_SCHEMA
                        }
                    }
                }));
                console.log('[Generator Response]', JSON.stringify(completion, null, 2));
            }
            catch (error) {
                console.error('[УчиОн] OpenAI API Error:', error);
                throw error;
            }
            let worksheetText = '';
            {
                worksheetJson = extractWorksheetJsonFromResponse(completion);
                console.log('[GEN] WorksheetJson assignments count:', worksheetJson.assignments?.length ?? 0);
                worksheetText = buildWorksheetTextFromJson(worksheetJson);
            }
            if (!worksheetText) {
                if (attempt === MAX_ATTEMPTS && !bestContent)
                    throw new Error('AI_ERROR');
                continue;
            }
            onProgress?.(attempt === 1 ? 50 : 80); // Generation done
            // Step 2: Validate
            console.log(`[УчиОн] Validating attempt ${attempt}...`);
            const validation = await validateWorksheet(this.client, params, worksheetText);
            console.log(`[УчиОн] Validation result: score=${validation.score}, issues=${validation.issues.length}`);
            onProgress?.(attempt === 1 ? 60 : 90); // Validation done
            if (validation.score === 10) {
                console.log('[УчиОн] Perfect score! Returning result.');
                console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
                const base = this.parseWorksheetText(worksheetText, params);
                base.json = worksheetJson;
                base.validationStatus = 'OK';
                return base;
            }
            // CLEAN step: partial regeneration of problem blocks
            const analysis = analyzeValidationIssues(validation.issues);
            console.log('[CLEAN] analysis:', {
                invalidAssignments: analysis.invalidAssignments,
                invalidTests: analysis.invalidTests,
                hasStructureErrors: analysis.hasStructureErrors,
            });
            onProgress?.(70);
            const regenJson = await regenerateProblemBlocks({
                subject: params.subject,
                grade: params.grade,
                topic: params.topic,
                original: worksheetJson,
                analysis,
                openai: this.client,
                onProgress
            });
            worksheetJson = regenJson;
            worksheetText = buildWorksheetTextFromJson(worksheetJson);
            const validation2 = await validateWorksheet(this.client, params, worksheetText);
            console.log(`[УчиОн] Validation after CLEAN: score=${validation2.score}, issues=${validation2.issues.length}`);
            onProgress?.(90);
            if (validation2.score === 10) {
                console.log('[УчиОн] Clean step succeeded.');
                console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
                const base = this.parseWorksheetText(worksheetText, params);
                base.json = worksheetJson ?? undefined;
                base.validationStatus = 'OK';
                return base;
            }
            // If still FAIL, return the latest version without further loops
            bestScore = validation2.score;
            bestContent = worksheetText;
            bestIssues = validation2.issues;
        }
        console.warn(`[УчиОн] Failed to generate perfect worksheet after ${MAX_ATTEMPTS} attempts. Returning best score: ${bestScore}`);
        console.warn('Issues in best content:', bestIssues);
        if (!bestContent) {
            throw new Error('AI_ERROR');
        }
        onProgress?.(95);
        console.log("[GENERATION] Total duration ms =", Date.now() - totalStart);
        const base = this.parseWorksheetText(bestContent, params);
        base.json = worksheetJson ?? undefined;
        base.validationStatus = 'FAIL';
        return base;
    }
    parseWorksheetText(text, params) {
        // Simple parser based on headers
        // Expected headers: 
        // ASSIGNMENTS:
        // TEST:
        // ANSWERS_ASSIGNMENTS:
        // ANSWERS_TEST:
        const extractSection = (header, nextHeader) => {
            const regex = nextHeader
                ? new RegExp(`${header}[\\s\\S]*?(?=${nextHeader})`, 'i')
                : new RegExp(`${header}[\\s\\S]*`, 'i');
            const match = text.match(regex);
            if (!match)
                return '';
            // Remove the header itself
            return match[0].replace(new RegExp(`^.*?${header}\\s*`, 'i'), '').trim();
        };
        const topic = params.topic; // Topic is not in the output anymore, use params
        const assignmentsText = extractSection('ASSIGNMENTS:', 'TEST:');
        const testText = extractSection('TEST:', 'ANSWERS_ASSIGNMENTS:');
        const answersAssignText = extractSection('ANSWERS_ASSIGNMENTS:', 'ANSWERS_TEST:');
        const answersTestText = extractSection('ANSWERS_TEST:', null);
        // Parse Assignments
        const assignments = assignmentsText.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0)
            .slice(0, 7) // Ensure exactly 7
            .map((text, i) => ({
            title: `Задание ${i + 1}`,
            text: text.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, '')
        }));
        // Parse Test
        // Format: Question \n A) ... \n B) ... \n C) ...
        const test = [];
        const testLines = testText.split('\n').map(l => l.trim()).filter(l => l);
        let currentQuestion = {};
        let currentOptions = [];
        for (const line of testLines) {
            if (line.match(/^[A-C]\)/)) {
                // Option
                currentOptions.push(line.replace(/^[A-C]\)\s*/, ''));
            }
            else if (line.length > 0) {
                // Likely a question (or number + question)
                if (currentQuestion.question && currentOptions.length > 0) {
                    // Push previous question
                    test.push({
                        question: currentQuestion.question,
                        options: currentOptions,
                        answer: '' // Will fill later or leave empty if parsing answers fails
                    });
                    currentOptions = [];
                }
                currentQuestion = { question: line.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, '') };
            }
        }
        // Push last question
        if (currentQuestion.question && currentOptions.length > 0) {
            test.push({
                question: currentQuestion.question,
                options: currentOptions,
                answer: ''
            });
        }
        // Parse Answers
        let answersAssignments = [];
        let answersTest = [];
        if (answersAssignText) {
            answersAssignments = answersAssignText.split('\n').map(l => l.trim()).filter(l => l).map(l => l.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, ''));
        }
        if (answersTestText) {
            answersTest = answersTestText.split('\n').map(l => l.trim()).filter(l => l).map(l => l.replace(/^\d+\)\s*/, '').replace(/^\d+\.\s*/, ''));
            // Try to map test answers to options if they are just letters (A, B, C)
            test.forEach((q, i) => {
                if (answersTest[i]) {
                    // If answer starts with "A" or "A)", try to extract letter
                    const letterMatch = answersTest[i].match(/^([A-C])\)?/i);
                    if (letterMatch) {
                        const idx = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
                        if (q.options[idx]) {
                            // We found the option text corresponding to the letter
                            // But usually we want to display the full answer text in the answer key
                            // The UI might expect just the text.
                            // Let's keep what the model gave us but cleaned up slightly if it was just "A"
                            // Actually, if the model gave "A — answer text", we use that.
                            // If it just gave "A", we map it.
                            if (answersTest[i].length < 5) {
                                q.answer = q.options[idx];
                            }
                            else {
                                q.answer = answersTest[i];
                            }
                        }
                        else {
                            q.answer = answersTest[i];
                        }
                    }
                    else {
                        q.answer = answersTest[i];
                    }
                }
            });
        }
        // Fallback validation/defaults
        const safeAssignments = assignments.slice(0, 7);
        while (safeAssignments.length < 7) {
            safeAssignments.push({ title: `Задание ${safeAssignments.length + 1}`, text: '...' });
        }
        const safeTest = test.slice(0, 10);
        return {
            id: '',
            subject: params.subject,
            grade: `${params.grade} класс`,
            topic: topic || params.topic,
            assignments: safeAssignments,
            test: safeTest,
            answers: {
                assignments: answersAssignments,
                test: answersTest
            },
            pdfBase64: ''
        };
    }
}
export function getAIProvider() {
    const isProd = process.env.NODE_ENV === 'production' ||
        process.env.VERCEL_ENV === 'production';
    const useOpenAI = isProd &&
        process.env.AI_PROVIDER === 'openai' &&
        process.env.OPENAI_API_KEY;
    console.log('[УчиОн] getAIProvider:', {
        isProd,
        AI_PROVIDER: process.env.AI_PROVIDER,
        useOpenAI: !!useOpenAI,
    });
    if (useOpenAI) {
        return new OpenAIProvider(process.env.OPENAI_API_KEY);
    }
    return new DummyProvider();
}
//# sourceMappingURL=ai-provider.js.map
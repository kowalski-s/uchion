import { SUBJECT_CONFIG } from './prompts.js';
import { trackAICall } from '../alerts/generation-alerts.js';
// Timeout for OpenAI calls (2 minutes)
const AI_CALL_TIMEOUT_MS = 120_000;
export async function timedLLMCall(label, call) {
    const start = Date.now();
    console.log(`[LLM][START] ${label}`);
    // Create a timeout promise
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('AI_TIMEOUT'));
        }, AI_CALL_TIMEOUT_MS);
    });
    try {
        // Race between the actual call and the timeout
        const res = await Promise.race([call(), timeoutPromise]);
        const end = Date.now();
        console.log(`[LLM][END] ${label}`, {
            duration_ms: end - start,
            timestamp: new Date().toISOString(),
            model: res?.model,
            usage: res?.usage ?? null,
        });
        // Track successful AI call
        trackAICall({ success: true, isTimeout: false }).catch((e) => console.error('[Alerts] Failed to track AI call:', e));
        return res;
    }
    catch (error) {
        const end = Date.now();
        const isTimeout = error instanceof Error && error.message === 'AI_TIMEOUT';
        console.error(`[LLM][ERROR] ${label}`, {
            duration_ms: end - start,
            timestamp: new Date().toISOString(),
            isTimeout,
            error: error instanceof Error ? error.message : String(error),
        });
        // Track failed AI call (timeout or other error)
        trackAICall({ success: false, isTimeout }).catch((e) => console.error('[Alerts] Failed to track AI call:', e));
        throw error;
    }
}
export function extractWorksheetJsonFromResponse(response) {
    // Chat Completions API format (standard)
    if (response.choices?.[0]?.message?.content) {
        let raw = response.choices[0].message.content.trim();
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            raw = raw.slice(firstBrace, lastBrace + 1);
        }
        if (!raw)
            throw new Error('Empty AI JSON response');
        return JSON.parse(raw);
    }
    // Responses API format (legacy OpenAI)
    const output = response.output?.[0];
    const content = output?.content?.[0];
    if (content && 'json' in content && content.json) {
        return content.json;
    }
    if (content && 'text' in content && content.text) {
        const textValue = typeof content.text === 'string' ? content.text : content.text.value;
        if (textValue) {
            let raw = textValue.trim();
            const firstBrace = raw.indexOf('{');
            const lastBrace = raw.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                raw = raw.slice(firstBrace, lastBrace + 1);
            }
            if (!raw)
                throw new Error('Empty AI JSON response');
            return JSON.parse(raw);
        }
    }
    if ('output_text' in response && typeof response.output_text === 'string' && response.output_text) {
        let raw = response.output_text.trim();
        const firstBrace = raw.indexOf('{');
        const lastBrace = raw.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            raw = raw.slice(firstBrace, lastBrace + 1);
            if (raw)
                return JSON.parse(raw);
        }
    }
    throw new Error('AI response did not contain JSON content');
}
export function extractTextFromResponse(response) {
    if (!response)
        return '';
    // Chat Completions API format (standard)
    if (response.choices?.[0]?.message?.content) {
        return response.choices[0].message.content;
    }
    // Responses API format (legacy OpenAI)
    if (typeof response.output_text === 'string')
        return response.output_text;
    const output = response.output;
    if (Array.isArray(output)) {
        const first = output[0];
        const firstContent = first?.content?.[0];
        if (firstContent && typeof firstContent.json === 'object') {
            try {
                return JSON.stringify(firstContent.json);
            }
            catch { /* ignore parse errors */ }
        }
        const text = firstContent?.text;
        if (typeof text === 'string')
            return text;
        if (typeof text === 'object' && text?.value)
            return text.value;
    }
    return '';
}
export function parseValidatorOutput(outputText) {
    const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean);
    let status = 'FAIL';
    const issues = [];
    for (const line of lines) {
        if (line.startsWith('STATUS:')) {
            if (line.includes('OK'))
                status = 'OK';
            if (line.includes('FAIL'))
                status = 'FAIL';
        }
        else if (line.startsWith('-')) {
            issues.push(line);
        }
    }
    return { status, issues };
}
export function analyzeValidationIssues(issues) {
    const invalidAssignments = [];
    const invalidTests = [];
    let hasStructureErrors = false;
    for (const issue of issues) {
        const upper = issue.toUpperCase();
        if (upper.includes('[БЛОК]') || upper.includes('[BLOCK]') || upper.includes('STRUCTURE')) {
            hasStructureErrors = true;
        }
        const assignMatch = upper.match(/\[ASSIGNMENT\s+(\d+)\]/);
        if (assignMatch) {
            const idx = Number(assignMatch[1]);
            if (!Number.isNaN(idx))
                invalidAssignments.push(idx);
        }
        const testMatch = upper.match(/\[TEST\s+(\d+)\]/);
        if (testMatch) {
            const idx = Number(testMatch[1]);
            if (!Number.isNaN(idx))
                invalidTests.push(idx);
        }
    }
    return {
        hasStructureErrors,
        invalidAssignments: Array.from(new Set(invalidAssignments)).sort((a, b) => a - b),
        invalidTests: Array.from(new Set(invalidTests)).sort((a, b) => a - b),
    };
}
export function buildWorksheetTextFromJson(json) {
    const parts = [];
    parts.push('ASSIGNMENTS:');
    for (const a of json.assignments || [])
        parts.push(`${a.index}) ${a.text}`);
    parts.push('');
    parts.push('TEST:');
    for (const t of json.test || []) {
        parts.push(`${t.index}) ${t.question}`);
        parts.push(`A) ${t.options?.A ?? ''}`);
        parts.push(`B) ${t.options?.B ?? ''}`);
        parts.push(`C) ${t.options?.C ?? ''}`);
    }
    parts.push('');
    parts.push('ANSWERS_ASSIGNMENTS:');
    for (let i = 0; i < (json.answers?.assignments?.length ?? 0); i++) {
        const ans = json.answers.assignments[i];
        parts.push(`${i + 1}) ${ans}`);
    }
    parts.push('');
    parts.push('ANSWERS_TEST:');
    for (let i = 0; i < (json.answers?.test?.length ?? 0); i++) {
        const ans = json.answers.test[i];
        parts.push(`${i + 1}) ${ans} — правильный ответ`);
    }
    return parts.join('\n');
}
export async function validateWorksheet(openaiClient, params, content) {
    try {
        const completion = await timedLLMCall('validator', () => openaiClient.chat.completions.create({
            model: process.env.AI_MODEL_VALIDATION || 'gpt-4.1-mini',
            messages: [
                { role: 'system', content: SUBJECT_CONFIG[params.subject].validatorPrompt },
                { role: 'user', content: `Предмет: ${params.subject}\nКласс: ${params.grade}\nТема: ${params.topic}\n\n${content}` },
            ],
            max_tokens: 600,
        }));
        const responseContent = extractTextFromResponse(completion);
        if (!responseContent)
            return { score: 0, issues: ['Validator: empty response'] };
        const statusMatch = responseContent.match(/STATUS:\s*(OK|FAIL)/i);
        const status = statusMatch ? statusMatch[1].toUpperCase() : 'FAIL';
        let issues = [];
        const issuesBlockMatch = responseContent.match(/ISSUES:\s*[\r\n]+([\s\S]*)/i);
        if (issuesBlockMatch) {
            const block = issuesBlockMatch[1];
            issues = block
                .split(/\r?\n/)
                .map(l => l.trim())
                .filter(l => l.startsWith('- '))
                .map(l => l.replace(/^\-\s*/, ''));
        }
        const score = status === 'OK' ? 10 : issues.length > 0 ? Math.max(1, 10 - Math.min(issues.length, 9)) : 5;
        return { score, issues };
    }
    catch (error) {
        console.error('Validator error:', error);
        return { score: 0, issues: ['Validator exception'] };
    }
}
export async function regenerateProblemBlocks(params) {
    const { subject, grade, topic, original, analysis, openai, onProgress } = params;
    if (analysis.hasStructureErrors)
        return original;
    const needAssignments = analysis.invalidAssignments.length > 0;
    const needTests = analysis.invalidTests.length > 0;
    if (!needAssignments && !needTests)
        return original;
    onProgress?.(75);
    const partial = {};
    if (needAssignments)
        partial.assignments = (original.assignments || []).filter(a => analysis.invalidAssignments.includes(a.index));
    if (needTests)
        partial.test = (original.test || []).filter(t => analysis.invalidTests.includes(t.index));
    const systemPrompt = SUBJECT_CONFIG[subject].systemPrompt;
    const userParts = [];
    userParts.push(`Ты уже сгенерировал рабочий лист по теме "${topic}" для ${grade} класса (предмет: ${subject}).`);
    userParts.push('Валидатор нашёл ошибки в некоторых заданиях и/или вопросах теста. Нужно ПЕРЕГЕНЕРИРОВАТЬ ТОЛЬКО проблемные элементы, сохраняя формат WorksheetJson.');
    if (needAssignments)
        userParts.push(`Проблемные задания (assignments) с индексами: ${analysis.invalidAssignments.join(', ')}.`);
    if (needTests)
        userParts.push(`Проблемные вопросы теста (test) с индексами: ${analysis.invalidTests.join(', ')}.`);
    userParts.push('Вот фрагмент текущего WorksheetJson с проблемными элементами (assignments/test):');
    userParts.push(JSON.stringify(partial, null, 2));
    userParts.push('Твоя задача: вернуть НОВЫЕ версии только этих элементов в формате JSON со структурой:');
    userParts.push(`{ "assignments": [ { "index": number, "type": "theory" | "apply" | "error" | "creative", "text": string } ], "test": [ { "index": number, "question": string, "options": { "A": string, "B": string, "C": string } } ] }`);
    userParts.push('Не изменяй индексы. Верни только поля, которые ты перегенерировал. Без комментариев, без текста вне JSON.');
    const userPrompt = userParts.join('\n\n');
    const regenerationResponse = await timedLLMCall('regen-problem-blocks', () => openai.chat.completions.create({
        model: process.env.AI_MODEL_VALIDATION || 'gpt-4.1-mini',
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
    }));
    const regenText = extractTextFromResponse(regenerationResponse);
    let patch = {};
    try {
        patch = JSON.parse(regenText);
    }
    catch (e) {
        console.error('[REGEN] Failed to parse blocks patch JSON', e);
        return original;
    }
    const updated = {
        ...original,
        assignments: (original.assignments || []).map(a => {
            const replacement = patch.assignments?.find(pa => pa.index === a.index) ?? null;
            return replacement ? { ...a, ...replacement } : a;
        }),
        test: (original.test || []).map(t => {
            const replacement = patch.test?.find(pt => pt.index === t.index) ?? null;
            return replacement ? { ...t, ...replacement } : t;
        }),
    };
    onProgress?.(85);
    return updated;
}
//# sourceMappingURL=validator.js.map
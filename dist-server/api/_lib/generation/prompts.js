import { getSubjectConfig, getGradeConfig, getTaskType, getDifficulty, getFormatVariant, } from './config/index.js';
// =============================================================================
// Block 1: Role and Context
// =============================================================================
const BASE_ROLE_PROMPT = `
Ты - опытный методист и составитель учебных материалов для российских школ.

Твоя задача - создавать качественные задания для рабочих листов, которые:
- Соответствуют российской школьной программе (ФГОС)
- Подходят по сложности для указанного класса
- Имеют однозначные правильные ответы
- Используют понятные формулировки для возраста ученика

Все задания на русском языке.
`.trim();
// =============================================================================
// Block 2: Subject
// =============================================================================
function getSubjectBlock(subjectId) {
    const config = getSubjectConfig(subjectId);
    if (!config)
        return '';
    // Если systemPrompt заполнен - используем его
    if (config.systemPrompt) {
        return `ПРЕДМЕТ: ${config.name}\n\n${config.systemPrompt}`;
    }
    // Базовые блоки по предметам (пока systemPrompt пустой)
    const basePrompts = {
        math: `
ПРЕДМЕТ: Математика (1-6 класс)

Особенности:
- Все вычисления должны быть корректными и проверяемыми
- Числа соответствуют уровню класса
- Текстовые задачи на реальные жизненные ситуации
- Ответы - конкретные числа или выражения
    `.trim(),
        algebra: `
ПРЕДМЕТ: Алгебра (7-11 класс)

Особенности:
- Строгая математическая запись
- Уравнения и выражения записывать корректно
- Ответы могут быть числами, выражениями или множествами
- Использовать стандартные обозначения (x, y, a, b)
    `.trim(),
        geometry: `
ПРЕДМЕТ: Геометрия (7-11 класс)

Особенности:
- Чёткие геометрические формулировки
- Если нужен чертёж - описать словами условие
- Теоремы применять строго по программе класса
- Обозначения точек заглавными буквами (A, B, C)
    `.trim(),
        russian: `
ПРЕДМЕТ: Русский язык (1-11 класс)

Особенности:
- Примеры только из современного литературного языка
- Все примеры орфографически и пунктуационно верны
- Термины соответствуют классу
- Никакого сленга и устаревшей лексики
    `.trim(),
    };
    return basePrompts[subjectId] || `ПРЕДМЕТ: ${config.name}`;
}
// =============================================================================
// Block 3: Grade and Topics
// =============================================================================
function getGradeBlock(subjectId, grade) {
    const config = getGradeConfig(subjectId, grade);
    if (!config)
        return `КЛАСС: ${grade}`;
    const topicsList = config.topics.map((t) => `- ${t}`).join('\n');
    return `
КЛАСС: ${grade}

${config.promptHint}

Темы программы этого класса:
${topicsList}

Используй понятия и термины, соответствующие этому классу.
  `.trim();
}
// =============================================================================
// Block 4: User Topic
// =============================================================================
function getTopicBlock(topic) {
    return `
ТЕМА ЗАДАНИЯ: ${topic}

Все задания должны быть строго по этой теме.
Если тема выходит за рамки указанного класса - всё равно создай задания, но адаптируй сложность.
  `.trim();
}
// =============================================================================
// Block 5: Task Types
// =============================================================================
function getTaskTypesBlock(taskTypes, formatId, variantIndex) {
    const variant = getFormatVariant(formatId, variantIndex);
    if (!variant) {
        return 'СОЗДАЙ ЗАДАНИЯ по указанным типам.';
    }
    let instructions = 'СОЗДАЙ ЗАДАНИЯ:\n\n';
    // Если есть тестовые вопросы
    if (variant.testQuestions > 0) {
        instructions += `ТЕСТОВАЯ ЧАСТЬ (${variant.testQuestions} вопросов):\n`;
        instructions += `Используй типы: единственный выбор (single_choice), множественный выбор (multiple_choice)\n\n`;
    }
    // Если есть открытые задания
    if (variant.openTasks > 0) {
        instructions += `ЗАДАНИЯ С РАЗВЁРНУТЫМ ОТВЕТОМ (${variant.openTasks} заданий):\n`;
        instructions += `Используй типы: открытый вопрос (open_question), соотнесение (matching), вставка пропусков (fill_blank)\n\n`;
    }
    // Инструкции по каждому типу
    instructions += 'ИНСТРУКЦИИ ПО ТИПАМ:\n\n';
    for (const typeId of taskTypes) {
        const taskType = getTaskType(typeId);
        if (taskType) {
            instructions += `${taskType.name.toUpperCase()} (${typeId}):\n`;
            instructions += `${taskType.promptInstruction}\n\n`;
        }
    }
    return instructions.trim();
}
// =============================================================================
// Block 6: Difficulty
// =============================================================================
function getDifficultyBlock(level) {
    const config = getDifficulty(level);
    return `
${config.promptModifier}
  `.trim();
}
// =============================================================================
// Block 7: Output Format
// =============================================================================
function getFormatBlock() {
    return `
ФОРМАТ ОТВЕТА:

Верни ТОЛЬКО валидный JSON без текста до или после:

{
  "tasks": [
    {
      "type": "single_choice",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "..."
    },
    {
      "type": "multiple_choice",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correctIndices": [0, 2],
      "explanation": "..."
    },
    {
      "type": "open_question",
      "question": "...",
      "correctAnswer": "...",
      "acceptableVariants": ["...", "..."],
      "explanation": "..."
    },
    {
      "type": "matching",
      "instruction": "Соотнеси...",
      "leftColumn": ["...", "...", "..."],
      "rightColumn": ["...", "...", "..."],
      "correctPairs": [[0, 1], [1, 0], [2, 2]]
    },
    {
      "type": "fill_blank",
      "textWithBlanks": "Текст с ___(1)___ пропусками ___(2)___",
      "blanks": [
        {"position": 1, "correctAnswer": "...", "acceptableVariants": ["..."]},
        {"position": 2, "correctAnswer": "..."}
      ]
    }
  ]
}

ВАЖНО: Никакого markdown, никакого текста - только JSON.
  `.trim();
}
// =============================================================================
// Block 8: Anti-Patterns
// =============================================================================
const ANTI_PATTERNS_PROMPT = `
ЗАПРЕЩЕНО:

- Повторять одинаковые или похожие задания
- Давать задания не по указанной теме
- Создавать задания с неоднозначным ответом
- Делать все правильные ответы на одной позиции (первый или последний)
- Использовать одинаковые числа в разных заданиях
- Писать слишком длинные формулировки
- Добавлять пояснения вне JSON
- Оставлять пустые или null значения
`.trim();
// =============================================================================
// Main Functions
// =============================================================================
/**
 * Собрать финальный промпт из всех блоков
 */
export function buildPrompt(params) {
    const blocks = [
        BASE_ROLE_PROMPT,
        getSubjectBlock(params.subject),
        getGradeBlock(params.subject, params.grade),
        getTopicBlock(params.topic),
        getTaskTypesBlock(params.taskTypes, params.format, params.variantIndex),
        getDifficultyBlock(params.difficulty),
        getFormatBlock(),
        ANTI_PATTERNS_PROMPT,
    ];
    return blocks.filter(Boolean).join('\n\n---\n\n');
}
/**
 * Получить только системный промпт (роль + предмет)
 */
export function buildSystemPrompt(subjectId) {
    return [BASE_ROLE_PROMPT, getSubjectBlock(subjectId)].join('\n\n');
}
/**
 * Получить user prompt (остальные блоки)
 */
export function buildUserPrompt(params) {
    const blocks = [
        getGradeBlock(params.subject, params.grade),
        getTopicBlock(params.topic),
        getTaskTypesBlock(params.taskTypes, params.format, params.variantIndex),
        getDifficultyBlock(params.difficulty),
        getFormatBlock(),
        ANTI_PATTERNS_PROMPT,
    ];
    return blocks.filter(Boolean).join('\n\n---\n\n');
}
/**
 * Получить количество заданий из варианта формата
 */
export function getTaskCounts(formatId, variantIndex) {
    const variant = getFormatVariant(formatId, variantIndex);
    if (!variant) {
        return { openTasks: 5, testQuestions: 10 };
    }
    return {
        openTasks: variant.openTasks,
        testQuestions: variant.testQuestions,
    };
}
/**
 * Получить рекомендуемые типы заданий для формата
 */
export function getRecommendedTaskTypes(formatId) {
    switch (formatId) {
        case 'test_only':
            return ['single_choice', 'multiple_choice'];
        case 'open_only':
            return ['open_question', 'matching', 'fill_blank'];
        case 'test_and_open':
        default:
            return ['single_choice', 'multiple_choice', 'open_question', 'matching', 'fill_blank'];
    }
}
//# sourceMappingURL=prompts.js.map
import { getSubjectConfig, getGradeConfig, getTaskType, getDifficultyPrompt, getFormatVariant, } from './config/index.js';
import { distributeOpenTasks, distributeTestTasks } from './config/task-distribution.js';
import { sanitizeUserInput } from './sanitize.js';
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
    const safeTopic = sanitizeUserInput(topic);
    return `
ТЕМА ЗАДАНИЯ: <user_topic>${safeTopic}</user_topic>

Все задания должны быть строго по этой теме.
Если тема выходит за рамки указанного класса - всё равно создай задания, но адаптируй сложность.
  `.trim();
}
// =============================================================================
// Block 5: Task Types
// =============================================================================
function formatDistributionLine(d) {
    const taskType = getTaskType(d.type);
    const name = taskType?.name ?? d.type;
    return `- Создай РОВНО ${d.count} ${d.count === 1 ? 'задание' : d.count < 5 ? 'задания' : 'заданий'} типа ${d.type} (${name})`;
}
function getTaskTypesBlock(taskTypes, formatId, variantIndex) {
    const variant = getFormatVariant(formatId, variantIndex);
    if (!variant) {
        return 'СОЗДАЙ ЗАДАНИЯ по указанным типам.';
    }
    const totalTasks = variant.testQuestions + variant.openTasks;
    // Calculate exact distribution per type
    const testDist = distributeTestTasks(variant.testQuestions, taskTypes);
    const openDist = distributeOpenTasks(variant.openTasks, taskTypes);
    const allDist = [...testDist, ...openDist];
    let instructions = `
═══════════════════════════════════════════════════════════════
КРИТИЧЕСКИ ВАЖНО: ТОЧНОЕ КОЛИЧЕСТВО ЗАДАНИЙ КАЖДОГО ТИПА
═══════════════════════════════════════════════════════════════

Ты ОБЯЗАН создать РОВНО ${totalTasks} заданий. Не ${totalTasks - 1}, не ${totalTasks + 1}, а ИМЕННО ${totalTasks}.

ТОЧНОЕ РАСПРЕДЕЛЕНИЕ ПО ТИПАМ:
`;
    // Test part
    if (testDist.length > 0) {
        instructions += `\nТЕСТОВАЯ ЧАСТЬ (${variant.testQuestions} шт.):\n`;
        for (const d of testDist) {
            instructions += `${formatDistributionLine(d)}\n`;
        }
    }
    // Open part
    if (openDist.length > 0) {
        instructions += `\nЗАДАНИЯ С РАЗВЁРНУТЫМ ОТВЕТОМ (${variant.openTasks} шт.):\n`;
        for (const d of openDist) {
            instructions += `${formatDistributionLine(d)}\n`;
        }
    }
    // Shuffle instruction
    if (testDist.length > 1) {
        instructions += `\nПОРЯДОК ТЕСТОВЫХ ЗАДАНИЙ: Перемешай задания разных типов в случайном порядке внутри тестовой части. НЕ группируй по типу — чередуй single_choice и multiple_choice произвольно.\n`;
    }
    if (openDist.length > 1) {
        instructions += `\nПОРЯДОК ОТКРЫТЫХ ЗАДАНИЙ: Перемешай задания разных типов в случайном порядке внутри открытой части. НЕ группируй по типу — чередуй open_question, matching и fill_blank произвольно.\n`;
    }
    instructions += `
КОНТРОЛЬНАЯ ПРОВЕРКА (сверься перед ответом):
В финальном JSON массив "tasks" должен содержать РОВНО ${totalTasks} элементов.
Подсчитай количество каждого типа — оно ОБЯЗАНО совпадать:
${allDist.map((d) => `  ✓ ${d.type}: РОВНО ${d.count} шт.`).join('\n')}
Если хотя бы один тип имеет неверное количество — ИСПРАВЬ перед выдачей ответа.

`;
    // Per-type instructions (only for types that have count > 0)
    instructions += 'ИНСТРУКЦИИ ПО ТИПАМ:\n\n';
    for (const d of allDist) {
        const taskType = getTaskType(d.type);
        if (taskType) {
            instructions += `${taskType.name.toUpperCase()} (${d.type}) — РОВНО ${d.count} шт.:\n`;
            instructions += `${taskType.promptInstruction}\n\n`;
        }
    }
    instructions += `ВАЖНО: Соблюдай ТОЧНОЕ количество заданий каждого типа. Не пропускай ни один тип. Перемешай порядок заданий внутри каждого блока.`;
    return instructions.trim();
}
// =============================================================================
// Block 6: Difficulty
// =============================================================================
function getDifficultyBlock(level, subject, grade) {
    return getDifficultyPrompt(level, subject, grade);
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
        getDifficultyBlock(params.difficulty, params.subject, params.grade),
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
        getDifficultyBlock(params.difficulty, params.subject, params.grade),
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
import { SingleChoiceSchema, MultipleChoiceSchema, OpenQuestionSchema, MatchingSchema, FillBlankSchema, } from '../config/task-types.js';
import { getGradeConfig } from '../config/index.js';
// =============================================================================
// Main validation function
// =============================================================================
export function validateWorksheet(tasks, subject, grade) {
    const errors = [];
    const warnings = [];
    const seenQuestions = new Set();
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        // 1. Schema validation (Zod)
        validateSchema(task, i, errors);
        // 2. Type-specific validation
        switch (task.type) {
            case 'single_choice':
                validateSingleChoice(task, i, errors, warnings);
                break;
            case 'multiple_choice':
                validateMultipleChoice(task, i, errors, warnings);
                break;
            case 'open_question':
                validateOpenQuestion(task, i, errors);
                break;
            case 'matching':
                validateMatching(task, i, errors);
                break;
            case 'fill_blank':
                validateFillBlank(task, i, errors);
                break;
        }
        // 3. Cross-task duplicate question check
        const questionText = extractQuestionText(task);
        if (questionText) {
            const normalized = questionText.trim().toLowerCase();
            if (normalized.length >= 10) {
                if (seenQuestions.has(normalized)) {
                    errors.push({
                        taskIndex: i,
                        field: 'question',
                        message: `Дубликат вопроса: "${questionText.slice(0, 50)}..."`,
                        code: 'DUPLICATE_QUESTIONS',
                    });
                }
                else {
                    seenQuestions.add(normalized);
                }
            }
        }
        // 4. Question minimum length
        if (questionText && questionText.trim().length > 0 && questionText.trim().length < 10) {
            errors.push({
                taskIndex: i,
                field: 'question',
                message: `Вопрос слишком короткий (${questionText.trim().length} символов, минимум 10)`,
                code: 'QUESTION_TOO_SHORT',
            });
        }
    }
    // 5. Math-specific number range checks
    if (['math', 'algebra', 'geometry'].includes(subject)) {
        validateMathNumbers(tasks, subject, grade, errors, warnings);
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
// =============================================================================
// Schema validation
// =============================================================================
function validateSchema(task, index, errors) {
    const schemaMap = {
        single_choice: SingleChoiceSchema,
        multiple_choice: MultipleChoiceSchema,
        open_question: OpenQuestionSchema,
        matching: MatchingSchema,
        fill_blank: FillBlankSchema,
    };
    const schema = schemaMap[task.type];
    if (!schema) {
        errors.push({
            taskIndex: index,
            field: 'type',
            message: `Неизвестный тип задания: ${task.type}`,
            code: 'SCHEMA_INVALID',
        });
        return;
    }
    const result = schema.safeParse(task);
    if (!result.success) {
        for (const issue of result.error.issues) {
            errors.push({
                taskIndex: index,
                field: issue.path.join('.') || 'root',
                message: issue.message,
                code: 'SCHEMA_INVALID',
            });
        }
    }
}
// =============================================================================
// Single choice validation
// =============================================================================
function validateSingleChoice(task, index, errors, warnings) {
    const options = task.options || [];
    const correctIndex = task.correctIndex;
    // correctIndex within bounds
    if (correctIndex !== undefined && (correctIndex < 0 || correctIndex >= options.length)) {
        errors.push({
            taskIndex: index,
            field: 'correctIndex',
            message: `correctIndex (${correctIndex}) вне диапазона [0, ${options.length - 1}]`,
            code: 'INVALID_INDEX',
        });
    }
    // Empty options
    for (let j = 0; j < options.length; j++) {
        if (!options[j] || options[j].trim() === '') {
            errors.push({
                taskIndex: index,
                field: `options[${j}]`,
                message: `Пустой вариант ответа`,
                code: 'EMPTY_FIELD',
            });
        }
    }
    // Duplicate options
    checkDuplicateOptions(options, index, errors);
    // Warning: few options
    if (options.length === 3) {
        warnings.push({
            taskIndex: index,
            field: 'options',
            message: 'Только 3 варианта ответа (рекомендуется 4)',
            code: 'FEW_OPTIONS',
        });
    }
}
// =============================================================================
// Multiple choice validation
// =============================================================================
function validateMultipleChoice(task, index, errors, warnings) {
    const options = task.options || [];
    const correctIndices = task.correctIndices || [];
    // All indices within bounds
    for (const idx of correctIndices) {
        if (idx < 0 || idx >= options.length) {
            errors.push({
                taskIndex: index,
                field: 'correctIndices',
                message: `correctIndices содержит индекс ${idx} вне диапазона [0, ${options.length - 1}]`,
                code: 'INVALID_INDEX',
            });
        }
    }
    // Duplicate indices
    const uniqueIndices = new Set(correctIndices);
    if (uniqueIndices.size !== correctIndices.length) {
        errors.push({
            taskIndex: index,
            field: 'correctIndices',
            message: 'Дубликаты в correctIndices',
            code: 'DUPLICATE_INDICES',
        });
    }
    // Empty options
    for (let j = 0; j < options.length; j++) {
        if (!options[j] || options[j].trim() === '') {
            errors.push({
                taskIndex: index,
                field: `options[${j}]`,
                message: 'Пустой вариант ответа',
                code: 'EMPTY_FIELD',
            });
        }
    }
    // Duplicate options
    checkDuplicateOptions(options, index, errors);
}
// =============================================================================
// Open question validation
// =============================================================================
function validateOpenQuestion(task, index, errors) {
    if (!task.correctAnswer || task.correctAnswer.trim() === '') {
        errors.push({
            taskIndex: index,
            field: 'correctAnswer',
            message: 'Пустой правильный ответ',
            code: 'EMPTY_FIELD',
        });
    }
    if (!task.question || task.question.trim() === '') {
        errors.push({
            taskIndex: index,
            field: 'question',
            message: 'Пустой вопрос',
            code: 'EMPTY_FIELD',
        });
    }
}
// =============================================================================
// Matching validation
// =============================================================================
function validateMatching(task, index, errors) {
    const left = task.leftColumn || [];
    const right = task.rightColumn || [];
    const pairs = task.correctPairs || [];
    // Column lengths must match
    if (left.length !== right.length) {
        errors.push({
            taskIndex: index,
            field: 'leftColumn/rightColumn',
            message: `Длины столбцов не совпадают: левый=${left.length}, правый=${right.length}`,
            code: 'COLUMN_LENGTH_MISMATCH',
        });
    }
    // Must have pairs for all left items
    if (pairs.length !== left.length) {
        errors.push({
            taskIndex: index,
            field: 'correctPairs',
            message: `Количество пар (${pairs.length}) не совпадает с количеством элементов (${left.length})`,
            code: 'INCOMPLETE_PAIRS',
        });
    }
    // Validate pair indices
    const usedLeft = new Set();
    const usedRight = new Set();
    for (const [l, r] of pairs) {
        if (l < 0 || l >= left.length) {
            errors.push({
                taskIndex: index,
                field: 'correctPairs',
                message: `Левый индекс ${l} вне диапазона [0, ${left.length - 1}]`,
                code: 'INVALID_PAIR_INDEX',
            });
        }
        if (r < 0 || r >= right.length) {
            errors.push({
                taskIndex: index,
                field: 'correctPairs',
                message: `Правый индекс ${r} вне диапазона [0, ${right.length - 1}]`,
                code: 'INVALID_PAIR_INDEX',
            });
        }
        if (usedLeft.has(l)) {
            errors.push({
                taskIndex: index,
                field: 'correctPairs',
                message: `Дублирующийся левый индекс ${l} в парах`,
                code: 'DUPLICATE_PAIRS',
            });
        }
        if (usedRight.has(r)) {
            errors.push({
                taskIndex: index,
                field: 'correctPairs',
                message: `Дублирующийся правый индекс ${r} в парах`,
                code: 'DUPLICATE_PAIRS',
            });
        }
        usedLeft.add(l);
        usedRight.add(r);
    }
    // Duplicate items in columns
    checkDuplicateOptions(left, index, errors, 'leftColumn');
    checkDuplicateOptions(right, index, errors, 'rightColumn');
}
// =============================================================================
// Fill blank validation
// =============================================================================
function validateFillBlank(task, index, errors) {
    const text = task.textWithBlanks || '';
    const blanks = task.blanks || [];
    // Find markers in text: ___(1)___, ___(2)___, etc.
    const markerRegex = /___\((\d+)\)___/g;
    const foundMarkers = new Set();
    let match;
    while ((match = markerRegex.exec(text)) !== null) {
        foundMarkers.add(parseInt(match[1], 10));
    }
    // Count mismatch
    if (foundMarkers.size !== blanks.length) {
        errors.push({
            taskIndex: index,
            field: 'textWithBlanks/blanks',
            message: `Маркеров в тексте: ${foundMarkers.size}, объектов blanks: ${blanks.length}`,
            code: 'BLANK_MARKER_MISMATCH',
        });
    }
    // Each blank must have corresponding marker
    for (const blank of blanks) {
        if (!foundMarkers.has(blank.position)) {
            errors.push({
                taskIndex: index,
                field: `blanks[${blank.position}]`,
                message: `Маркер ___(${blank.position})___ не найден в тексте`,
                code: 'MISSING_BLANK',
            });
        }
        if (!blank.correctAnswer || blank.correctAnswer.trim() === '') {
            errors.push({
                taskIndex: index,
                field: `blanks[${blank.position}].correctAnswer`,
                message: 'Пустой ответ для пропуска',
                code: 'EMPTY_FIELD',
            });
        }
    }
    // Each marker must have corresponding blank object
    for (const pos of foundMarkers) {
        if (!blanks.find(b => b.position === pos)) {
            errors.push({
                taskIndex: index,
                field: `blanks`,
                message: `Для маркера ___(${pos})___ нет объекта blank`,
                code: 'MISSING_BLANK',
            });
        }
    }
}
// =============================================================================
// Math-specific number range checks
// =============================================================================
function validateMathNumbers(tasks, subject, grade, errors, warnings) {
    const gradeConfig = getGradeConfig(subject, grade);
    if (!gradeConfig)
        return;
    const maxNumber = gradeConfig.constraints.limits?.maxNumber;
    if (typeof maxNumber !== 'number')
        return;
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const textToCheck = gatherTaskText(task);
        // Extract all numbers from task text
        const numbers = extractNumbers(textToCheck);
        for (const num of numbers) {
            if (Math.abs(num) > maxNumber) {
                warnings.push({
                    taskIndex: i,
                    field: 'content',
                    message: `Число ${num} превышает лимит для ${grade} класса (макс: ${maxNumber})`,
                    code: 'POSSIBLE_NUMBER_OVERFLOW',
                });
                break; // one warning per task is enough
            }
        }
    }
}
// =============================================================================
// Helpers
// =============================================================================
function checkDuplicateOptions(items, index, errors, fieldName = 'options') {
    const normalized = items.map(s => s.trim().toLowerCase());
    const seen = new Set();
    for (let j = 0; j < normalized.length; j++) {
        if (normalized[j] && seen.has(normalized[j])) {
            errors.push({
                taskIndex: index,
                field: fieldName,
                message: `Дубликат варианта: "${items[j]}"`,
                code: 'DUPLICATE_OPTIONS',
            });
        }
        if (normalized[j]) {
            seen.add(normalized[j]);
        }
    }
}
function extractQuestionText(task) {
    switch (task.type) {
        case 'single_choice':
        case 'multiple_choice':
        case 'open_question':
            return task.question || '';
        case 'matching':
            return task.instruction || '';
        case 'fill_blank':
            return task.textWithBlanks || '';
        default:
            return '';
    }
}
function gatherTaskText(task) {
    const parts = [];
    if (task.question)
        parts.push(task.question);
    if (task.options)
        parts.push(...task.options);
    if (task.correctAnswer)
        parts.push(task.correctAnswer);
    if (task.instruction)
        parts.push(task.instruction);
    if (task.leftColumn)
        parts.push(...task.leftColumn);
    if (task.rightColumn)
        parts.push(...task.rightColumn);
    if (task.textWithBlanks)
        parts.push(task.textWithBlanks);
    if (task.blanks)
        parts.push(...task.blanks.map(b => b.correctAnswer));
    return parts.join(' ');
}
function extractNumbers(text) {
    // Match integers and decimals, including negative
    const matches = text.match(/-?\d+([.,]\d+)?/g) || [];
    return matches.map(m => parseFloat(m.replace(',', '.'))).filter(n => !isNaN(n));
}
//# sourceMappingURL=deterministic.js.map
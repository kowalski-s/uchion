import { z } from 'zod';
// =============================================================================
// Worksheet Formats Configuration
// =============================================================================
export const worksheetFormats = {
    open_only: {
        id: 'open_only',
        name: 'Только задания',
        description: 'Задания с развёрнутым ответом',
        variants: [
            { openTasks: 5, testQuestions: 0, generations: 1 },
            { openTasks: 10, testQuestions: 0, generations: 2, label: '+Профи' },
            { openTasks: 15, testQuestions: 0, generations: 3, label: '+Профи' },
        ],
    },
    test_only: {
        id: 'test_only',
        name: 'Только тест',
        description: 'Тестовые вопросы с выбором ответа',
        variants: [
            { openTasks: 0, testQuestions: 10, generations: 1 },
            { openTasks: 0, testQuestions: 15, generations: 2, label: '+Профи' },
            { openTasks: 0, testQuestions: 20, generations: 3, label: '+Профи' },
        ],
    },
    test_and_open: {
        id: 'test_and_open',
        name: 'Тест + задания',
        description: 'Комбинация теста и заданий с развёрнутым ответом',
        variants: [
            { openTasks: 5, testQuestions: 10, generations: 1 },
            { openTasks: 10, testQuestions: 15, generations: 2, label: '+Профи' },
            { openTasks: 15, testQuestions: 20, generations: 3, label: '+Профи' },
        ],
    },
};
// =============================================================================
// Zod Schema
// =============================================================================
export const WorksheetFormatIdSchema = z.enum(['open_only', 'test_only', 'test_and_open']);
// =============================================================================
// Helper Functions
// =============================================================================
/**
 * Получить конфигурацию формата по ID
 */
export function getWorksheetFormat(id) {
    const config = worksheetFormats[id];
    if (!config) {
        throw new Error(`Unknown worksheet format: ${id}`);
    }
    return config;
}
/**
 * Получить все форматы
 */
export function getAllWorksheetFormats() {
    return Object.values(worksheetFormats);
}
/**
 * Получить вариант формата
 */
export function getFormatVariant(formatId, variantIndex) {
    const format = worksheetFormats[formatId];
    return format?.variants[variantIndex];
}
/**
 * Рассчитать стоимость в генерациях
 */
export function calculateGenerationCost(formatId, variantIndex) {
    const variant = getFormatVariant(formatId, variantIndex);
    return variant?.generations ?? 1;
}
/**
 * Проверить доступность варианта для пользователя
 */
export function isVariantAvailable(generationsCost, userGenerationsLeft) {
    return userGenerationsLeft >= generationsCost;
}
/**
 * Проверить, является ли строка валидным ID формата
 */
export function isValidWorksheetFormat(id) {
    return id in worksheetFormats;
}
/**
 * Получить формат по умолчанию
 */
export function getDefaultFormat() {
    return 'test_and_open';
}
/**
 * Получить вариант по умолчанию
 */
export function getDefaultVariantIndex() {
    return 0;
}
//# sourceMappingURL=worksheet-formats.js.map
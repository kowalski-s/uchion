import { z } from 'zod';
export const ValidatorResponseSchema = z.object({
    score: z.number().min(1).max(10),
    issues: z.array(z.string()),
});
export const WORKSHEET_JSON_SCHEMA = {
    type: 'object',
    properties: {
        assignments: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    type: { type: 'string', enum: ['theory', 'apply', 'error', 'creative'] },
                    text: { type: 'string' },
                },
                required: ['index', 'type', 'text'],
                additionalProperties: false,
            },
        },
        test: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    question: { type: 'string' },
                    options: {
                        type: 'object',
                        properties: { A: { type: 'string' }, B: { type: 'string' }, C: { type: 'string' } },
                        required: ['A', 'B', 'C'],
                        additionalProperties: false,
                    },
                },
                required: ['index', 'question', 'options'],
                additionalProperties: false,
            },
        },
        answers: {
            type: 'object',
            properties: {
                assignments: { type: 'array', items: { type: 'string' } },
                test: { type: 'array', items: { type: 'string', enum: ['A', 'B', 'C'] } },
            },
            required: ['assignments', 'test'],
            additionalProperties: false,
        },
    },
    required: ['assignments', 'test', 'answers'],
    additionalProperties: false,
};
export const WORKSHEET_BLOCKS_PATCH_SCHEMA = {
    type: 'object',
    properties: {
        assignments: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    type: { type: 'string', enum: ['theory', 'apply', 'error', 'creative'] },
                    text: { type: 'string' },
                },
                required: ['index', 'type', 'text'],
                additionalProperties: false,
            },
        },
        test: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    index: { type: 'integer' },
                    question: { type: 'string' },
                    options: {
                        type: 'object',
                        properties: { A: { type: 'string' }, B: { type: 'string' }, C: { type: 'string' } },
                        required: ['A', 'B', 'C'],
                        additionalProperties: false,
                    },
                },
                required: ['index', 'question', 'options'],
                additionalProperties: false,
            },
        },
    },
    additionalProperties: false,
};
//# sourceMappingURL=schema.js.map
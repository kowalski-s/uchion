/**
 * Sanitize user input before embedding into LLM prompts.
 * Prevents prompt injection attacks via topic, custom theme, etc.
 */
export function sanitizeUserInput(input) {
    let sanitized = input;
    // Remove control characters and newlines
    sanitized = sanitized.replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ');
    // Remove prompt/markdown delimiters
    sanitized = sanitized.replace(/[-]{3,}/g, '');
    sanitized = sanitized.replace(/[=]{3,}/g, '');
    sanitized = sanitized.replace(/[#]{2,}/g, '');
    // Remove injection phrases (case-insensitive)
    const injectionPatterns = [
        /ignore\s+(all\s+)?previous\s+instructions?/gi,
        /disregard\s+(all\s+)?previous/gi,
        /forget\s+(all\s+)?previous/gi,
        /игнорируй\s+(все\s+)?предыдущие/gi,
        /забудь\s+(все\s+)?предыдущие/gi,
        /не\s+обращай\s+внимания\s+на\s+предыдущие/gi,
        /\bsystem\s*:/gi,
        /\bassistant\s*:/gi,
        /\buser\s*:/gi,
    ];
    for (const pattern of injectionPatterns) {
        sanitized = sanitized.replace(pattern, '');
    }
    // Collapse multiple spaces and trim
    sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();
    return sanitized;
}
//# sourceMappingURL=sanitize.js.map
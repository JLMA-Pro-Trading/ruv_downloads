import { ZodError } from 'zod';
/**
 * Validate data against a Zod schema
 */
export function validate(schema, data) {
    try {
        const validated = schema.parse(data);
        return {
            success: true,
            data: validated,
        };
    }
    catch (error) {
        if (error instanceof ZodError) {
            return {
                success: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
            };
        }
        return {
            success: false,
            errors: ['Unknown validation error'],
        };
    }
}
/**
 * Validate data and throw on error
 */
export function validateOrThrow(schema, data) {
    const result = validate(schema, data);
    if (!result.success) {
        throw new Error(`Validation failed:\n${result.errors?.join('\n')}`);
    }
    return result.data;
}
/**
 * Sanitize and validate prompt input
 */
export function sanitizePrompt(prompt) {
    return prompt
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 10000); // Max length
}
/**
 * Validate model name format
 */
export function isValidModelName(model) {
    const validProviders = ['gemini', 'claude', 'openrouter', 'openai', 'gpt'];
    return validProviders.some(provider => model.toLowerCase().includes(provider));
}
/**
 * Validate API key format
 */
export function isValidAPIKey(key) {
    return key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key);
}
//# sourceMappingURL=validation.js.map
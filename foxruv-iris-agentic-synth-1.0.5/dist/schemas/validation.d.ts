import { ZodSchema } from 'zod';
/**
 * Validation result type
 */
export interface ValidationResult<T> {
    success: boolean;
    data?: T;
    errors?: string[];
}
/**
 * Validate data against a Zod schema
 */
export declare function validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T>;
/**
 * Validate data and throw on error
 */
export declare function validateOrThrow<T>(schema: ZodSchema<T>, data: unknown): T;
/**
 * Sanitize and validate prompt input
 */
export declare function sanitizePrompt(prompt: string): string;
/**
 * Validate model name format
 */
export declare function isValidModelName(model: string): boolean;
/**
 * Validate API key format
 */
export declare function isValidAPIKey(key: string): boolean;
//# sourceMappingURL=validation.d.ts.map
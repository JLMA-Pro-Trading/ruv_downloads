/**
 * Retry wrapper for Supabase operations with exponential backoff
 *
 * Handles transient network failures gracefully with:
 * - Configurable retry attempts
 * - Exponential backoff delay
 * - Timeout support
 * - Error classification (permanent vs transient)
 */
const DEFAULT_OPTIONS = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    timeoutMs: 30000,
    isRetryable: (error) => {
        // Retry on network errors and timeouts
        if (error.message?.includes('fetch failed'))
            return true;
        if (error.message?.includes('ETIMEDOUT'))
            return true;
        if (error.message?.includes('ECONNREFUSED'))
            return true;
        if (error.message?.includes('ENOTFOUND'))
            return true;
        // Retry on specific Supabase error codes
        const retryableCodes = ['PGRST301', 'PGRST504', '429', '503', '504'];
        if (error.code && retryableCodes.includes(error.code))
            return true;
        // Don't retry on authentication or authorization errors
        if (error.code && ['PGRST301', '401', '403'].includes(error.code))
            return false;
        return false;
    }
};
/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt, initialDelay, maxDelay) {
    const delay = initialDelay * Math.pow(2, attempt);
    // Add jitter (±25%) to prevent thundering herd
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.min(delay + jitter, maxDelay);
}
/**
 * Wrap an async operation with timeout
 */
async function withTimeout(operation, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([operation(), timeoutPromise]);
    }
    finally {
        clearTimeout(timeoutId);
    }
}
/**
 * Execute an async operation with retry logic and exponential backoff
 *
 * @param operation - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise with operation result
 * @throws Error if all retries exhausted
 *
 * @example
 * ```typescript
 * const result = await withRetry(async () => {
 *   const { data, error } = await supabase.from('table').select();
 *   if (error) throw error;
 *   return data;
 * }, { maxRetries: 5, timeoutMs: 60000 });
 * ```
 */
export async function withRetry(operation, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError;
    for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
        try {
            // Wrap operation with timeout
            return await withTimeout(operation, opts.timeoutMs);
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!opts.isRetryable(error)) {
                console.warn(`Non-retryable error encountered:`, error.message);
                throw error;
            }
            // Don't retry on last attempt
            if (attempt === opts.maxRetries - 1) {
                break;
            }
            // Calculate backoff delay
            const delay = calculateDelay(attempt, opts.initialDelayMs, opts.maxDelayMs);
            console.warn(`Supabase operation failed (attempt ${attempt + 1}/${opts.maxRetries}):`, error.message, `- Retrying in ${Math.round(delay)}ms`);
            await sleep(delay);
        }
    }
    throw new Error(`Operation failed after ${opts.maxRetries} attempts. Last error: ${lastError.message}`);
}
/**
 * Create a retry-enabled wrapper for a Supabase client method
 *
 * @example
 * ```typescript
 * const retrySelect = createRetryWrapper();
 * const { data, error } = await retrySelect(() =>
 *   supabase.from('table').select()
 * );
 * ```
 */
export function createRetryWrapper(options = {}) {
    return async (operation) => {
        return withRetry(operation, options);
    };
}
/**
 * Decorator for adding retry logic to class methods
 *
 * @example
 * ```typescript
 * class MyService {
 *   @Retryable({ maxRetries: 5 })
 *   async fetchData() {
 *     const { data, error } = await supabase.from('table').select();
 *     if (error) throw error;
 *     return data;
 *   }
 * }
 * ```
 */
export function Retryable(options = {}) {
    return function (_target, _propertyKey, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = async function (...args) {
            return withRetry(() => originalMethod.apply(this, args), options);
        };
        return descriptor;
    };
}

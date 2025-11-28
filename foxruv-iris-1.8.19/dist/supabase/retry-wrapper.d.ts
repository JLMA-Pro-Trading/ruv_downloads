/**
 * Retry wrapper for Supabase operations with exponential backoff
 *
 * Handles transient network failures gracefully with:
 * - Configurable retry attempts
 * - Exponential backoff delay
 * - Timeout support
 * - Error classification (permanent vs transient)
 */
export interface RetryOptions {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;
    /** Initial delay in milliseconds (default: 1000) */
    initialDelayMs?: number;
    /** Maximum delay in milliseconds (default: 10000) */
    maxDelayMs?: number;
    /** Request timeout in milliseconds (default: 30000) */
    timeoutMs?: number;
    /** Custom function to determine if error is retryable */
    isRetryable?: (error: any) => boolean;
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
export declare function withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
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
export declare function createRetryWrapper(options?: RetryOptions): <T>(operation: () => Promise<T>) => Promise<T>;
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
export declare function Retryable(options?: RetryOptions): (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
//# sourceMappingURL=retry-wrapper.d.ts.map
/**
 * Auto-Instrumentation Decorator for @foxruv/iris Telemetry
 * ---------------------------------------------------------
 * Provides both TypeScript decorator and wrapper patterns for
 * automatic telemetry tracking of async functions.
 *
 * Features:
 * - Automatic latency measurement
 * - Success/failure tracking
 * - Confidence extraction from return values
 * - Non-blocking telemetry (fire-and-forget)
 * - AgentDB-first storage with Supabase sync
 *
 * Usage:
 * ```typescript
 * // Decorator pattern (TypeScript with experimentalDecorators)
 * @withTelemetry({ expertId: 'mean-reversion-trader' })
 * async function makeTrade(data) { ... }
 *
 * // Wrapper pattern (JavaScript/TypeScript)
 * const trackedFn = withTelemetry(
 *   { expertId: 'mean-reversion-trader' },
 *   async (data) => { ... }
 * );
 * ```
 */
export interface TelemetryOptions {
    /** Unique identifier for the expert/agent being tracked */
    expertId: string;
    /** Version string for the expert (default: '1.0.0') */
    version?: string;
    /** Project identifier (default: 'default') */
    project?: string;
    /** Custom metadata to include with every event */
    metadata?: Record<string, unknown>;
    /**
     * Path to extract confidence from result (e.g., 'confidence', 'data.score')
     * If not provided, looks for 'confidence' at the root level
     */
    confidencePath?: string;
    /**
     * Custom success evaluator. By default, any non-thrown result is success.
     * Return true for success, false for failure.
     */
    successEvaluator?: (result: unknown) => boolean;
    /**
     * Whether to include function arguments in metadata (default: false)
     * Be careful with sensitive data
     */
    includeArgs?: boolean;
    /**
     * Whether to include the result in metadata (default: false)
     * Be careful with large objects
     */
    includeResult?: boolean;
}
/**
 * TypeScript Method Decorator Pattern
 *
 * @example
 * class TradeExecutor {
 *   @withTelemetry({ expertId: 'mean-reversion-trader' })
 *   async executeTrade(data: TradeData) {
 *     return { success: true, confidence: 0.85 }
 *   }
 * }
 */
export declare function withTelemetry(options: TelemetryOptions): MethodDecorator;
/**
 * Wrapper Pattern for standalone functions
 *
 * @example
 * const trackedAnalyze = withTelemetry(
 *   { expertId: 'market-analyzer', version: '2.0.0' },
 *   async (symbol: string) => {
 *     return { trend: 'bullish', confidence: 0.75 }
 *   }
 * )
 */
export declare function withTelemetry<T extends (...args: any[]) => Promise<any>>(options: TelemetryOptions, fn: T): T;
/**
 * Creates a pre-configured withTelemetry function with default options.
 * Useful for creating project-specific telemetry wrappers.
 *
 * @example
 * const tradingTelemetry = createTelemetryWrapper({
 *   project: 'trading-bot',
 *   version: '3.0.0',
 * })
 *
 * @tradingTelemetry({ expertId: 'momentum-trader' })
 * async function analyzeMarket() { ... }
 */
export declare function createTelemetryWrapper(defaultOptions: Partial<TelemetryOptions>): typeof withTelemetry;
/**
 * Wraps multiple functions with the same telemetry options.
 *
 * @example
 * const { analyze, execute, report } = wrapWithTelemetry(
 *   { expertId: 'trading-system', project: 'algo-trader' },
 *   { analyze: analyzeMarket, execute: executeTrade, report: generateReport }
 * )
 */
export declare function wrapWithTelemetry<T extends Record<string, (...args: any[]) => Promise<any>>>(options: TelemetryOptions, functions: T): T;
export default withTelemetry;
//# sourceMappingURL=with-telemetry.d.ts.map
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

import { randomUUID } from 'crypto'
import { telemetryEmitter } from '../telemetry/emitter-singleton.js'

// ============================================================================
// Types
// ============================================================================

export interface TelemetryOptions {
  /** Unique identifier for the expert/agent being tracked */
  expertId: string
  /** Version string for the expert (default: '1.0.0') */
  version?: string
  /** Project identifier (default: 'default') */
  project?: string
  /** Custom metadata to include with every event */
  metadata?: Record<string, unknown>
  /**
   * Path to extract confidence from result (e.g., 'confidence', 'data.score')
   * If not provided, looks for 'confidence' at the root level
   */
  confidencePath?: string
  /**
   * Custom success evaluator. By default, any non-thrown result is success.
   * Return true for success, false for failure.
   */
  successEvaluator?: (result: unknown) => boolean
  /**
   * Whether to include function arguments in metadata (default: false)
   * Be careful with sensitive data
   */
  includeArgs?: boolean
  /**
   * Whether to include the result in metadata (default: false)
   * Be careful with large objects
   */
  includeResult?: boolean
}

interface TelemetryEvent {
  project: string
  expert_id: string
  version: string
  run_id: string
  confidence: number
  latency_ms: number
  outcome: 'success' | 'failure'
  metadata: Record<string, unknown>
  timestamp: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Safely extracts a value from an object using a dot-notation path
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined

  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

/**
 * Extracts confidence value from a result object
 */
function extractConfidence(result: unknown, confidencePath?: string): number {
  if (result === null || result === undefined) return 0.5

  // Try specified path first
  if (confidencePath) {
    const value = getNestedValue(result, confidencePath)
    if (typeof value === 'number' && value >= 0 && value <= 1) {
      return value
    }
  }

  // Try common confidence field names
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>

    // Direct confidence field
    if (typeof obj.confidence === 'number') {
      return Math.min(1, Math.max(0, obj.confidence))
    }

    // Score field (often 0-1 or 0-100)
    if (typeof obj.score === 'number') {
      const score = obj.score
      return score > 1 ? score / 100 : Math.min(1, Math.max(0, score))
    }

    // Probability field
    if (typeof obj.probability === 'number') {
      return Math.min(1, Math.max(0, obj.probability))
    }
  }

  // Default confidence for successful execution
  return 0.5
}

/**
 * Non-blocking telemetry recording
 */
function recordTelemetry(event: TelemetryEvent): void {
  // Fire and forget - don't await, don't block
  telemetryEmitter.record(event).catch(() => {
    // Silently ignore errors - telemetry should never break the app
  })
}

/**
 * Sanitizes args for safe logging (removes functions, circular refs)
 */
function sanitizeForLogging(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[max depth]'

  if (value === null || value === undefined) return value
  if (typeof value === 'function') return '[function]'
  if (typeof value === 'symbol') return value.toString()
  if (typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.slice(0, 10).map(v => sanitizeForLogging(v, depth + 1))
  }

  const result: Record<string, unknown> = {}
  const entries = Object.entries(value as Record<string, unknown>).slice(0, 20)
  for (const [k, v] of entries) {
    // Skip sensitive-looking fields
    if (/password|secret|token|key|auth/i.test(k)) {
      result[k] = '[redacted]'
    } else {
      result[k] = sanitizeForLogging(v, depth + 1)
    }
  }
  return result
}

// ============================================================================
// Core Implementation
// ============================================================================

/**
 * Creates a telemetry-wrapped version of an async function
 */
function wrapFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: TelemetryOptions,
  methodName?: string
): T {
  const {
    expertId,
    version = '1.0.0',
    project = 'default',
    metadata: baseMetadata = {},
    confidencePath,
    successEvaluator,
    includeArgs = false,
    includeResult = false,
  } = options

  const wrapped = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
    const startTime = performance.now()
    const runId = randomUUID()
    const fnName = methodName || fn.name || 'anonymous'

    try {
      const result = await fn.apply(this, args)

      // Determine success
      const isSuccess = successEvaluator ? successEvaluator(result) : true
      const confidence = extractConfidence(result, confidencePath)

      // Build metadata
      const eventMetadata: Record<string, unknown> = {
        ...baseMetadata,
        function: fnName,
        argsCount: args.length,
      }

      if (includeArgs && args.length > 0) {
        eventMetadata.args = sanitizeForLogging(args)
      }

      if (includeResult && result !== undefined) {
        eventMetadata.result = sanitizeForLogging(result)
      }

      // Record telemetry (non-blocking)
      recordTelemetry({
        project,
        expert_id: expertId,
        version,
        run_id: runId,
        confidence,
        latency_ms: Math.round(performance.now() - startTime),
        outcome: isSuccess ? 'success' : 'failure',
        metadata: eventMetadata,
        timestamp: new Date().toISOString(),
      })

      return result
    } catch (error) {
      // Record failure telemetry (non-blocking)
      const eventMetadata: Record<string, unknown> = {
        ...baseMetadata,
        function: fnName,
        argsCount: args.length,
        error: error instanceof Error ? error.message : String(error),
        errorType: error instanceof Error ? error.name : 'Unknown',
      }

      if (includeArgs && args.length > 0) {
        eventMetadata.args = sanitizeForLogging(args)
      }

      recordTelemetry({
        project,
        expert_id: expertId,
        version,
        run_id: runId,
        confidence: 0,
        latency_ms: Math.round(performance.now() - startTime),
        outcome: 'failure',
        metadata: eventMetadata,
        timestamp: new Date().toISOString(),
      })

      // Re-throw to preserve original behavior
      throw error
    }
  } as T

  // Preserve function name for debugging
  Object.defineProperty(wrapped, 'name', {
    value: `withTelemetry(${fn.name || 'anonymous'})`,
    configurable: true,
  })

  return wrapped
}

// ============================================================================
// Public API - Overloaded withTelemetry
// ============================================================================

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
export function withTelemetry(options: TelemetryOptions): MethodDecorator

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
export function withTelemetry<T extends (...args: any[]) => Promise<any>>(
  options: TelemetryOptions,
  fn: T
): T

/**
 * Implementation that handles both patterns
 */
export function withTelemetry<T extends (...args: any[]) => Promise<any>>(
  options: TelemetryOptions,
  fn?: T
): MethodDecorator | T {
  // Wrapper pattern: withTelemetry(options, fn)
  if (typeof fn === 'function') {
    return wrapFunction(fn, options)
  }

  // Decorator pattern: @withTelemetry(options)
  return function (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value

    if (typeof originalMethod !== 'function') {
      throw new Error(
        `@withTelemetry can only be applied to methods, not ${typeof originalMethod}`
      )
    }

    descriptor.value = wrapFunction(
      originalMethod,
      options,
      String(propertyKey)
    )

    return descriptor
  }
}

// ============================================================================
// Factory for Pre-configured Telemetry
// ============================================================================

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
export function createTelemetryWrapper(
  defaultOptions: Partial<TelemetryOptions>
): typeof withTelemetry {
  function configuredWithTelemetry<T extends (...args: any[]) => Promise<any>>(
    options: TelemetryOptions,
    fn?: T
  ): MethodDecorator | T {
    const mergedOptions: TelemetryOptions = {
      ...defaultOptions,
      ...options,
      metadata: {
        ...defaultOptions.metadata,
        ...options.metadata,
      },
    }

    if (typeof fn === 'function') {
      return wrapFunction(fn, mergedOptions)
    }

    return function (
      _target: object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ): PropertyDescriptor {
      const originalMethod = descriptor.value

      if (typeof originalMethod !== 'function') {
        throw new Error(
          `@withTelemetry can only be applied to methods, not ${typeof originalMethod}`
        )
      }

      descriptor.value = wrapFunction(
        originalMethod,
        mergedOptions,
        String(propertyKey)
      )

      return descriptor
    }
  }

  return configuredWithTelemetry as typeof withTelemetry
}

// ============================================================================
// Convenience: Wrap multiple functions at once
// ============================================================================

/**
 * Wraps multiple functions with the same telemetry options.
 *
 * @example
 * const { analyze, execute, report } = wrapWithTelemetry(
 *   { expertId: 'trading-system', project: 'algo-trader' },
 *   { analyze: analyzeMarket, execute: executeTrade, report: generateReport }
 * )
 */
export function wrapWithTelemetry<
  T extends Record<string, (...args: any[]) => Promise<any>>
>(options: TelemetryOptions, functions: T): T {
  const wrapped = {} as T

  for (const [name, fn] of Object.entries(functions)) {
    ;(wrapped as Record<string, unknown>)[name] = wrapFunction(
      fn,
      options,
      name
    )
  }

  return wrapped
}

// ============================================================================
// Default Export
// ============================================================================

export default withTelemetry

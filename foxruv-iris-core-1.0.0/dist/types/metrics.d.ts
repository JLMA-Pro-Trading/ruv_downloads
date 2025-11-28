/**
 * Performance Metrics Types
 *
 * Defines performance tracking and measurement types for model providers
 * and expert agents. Used for monitoring, optimization, and health checks.
 *
 * @module @iris/core/types/metrics
 * @version 1.0.0
 */
import type { ModelProvider } from './providers.js';
/**
 * Performance Metrics for Model Providers
 *
 * Tracks latency, success rate, and quality across multiple requests
 * to enable provider comparison and optimization.
 */
export interface PerformanceMetrics {
    /** Provider being tracked */
    provider: ModelProvider;
    /** Model name */
    model: string;
    /** Average request latency in milliseconds */
    averageLatencyMs: number;
    /** Total number of requests made */
    totalRequests: number;
    /** Success rate (0.0 - 1.0) */
    successRate: number;
    /** Optional quality score (0.0 - 1.0) based on evaluation metrics */
    qualityScore?: number;
}
//# sourceMappingURL=metrics.d.ts.map
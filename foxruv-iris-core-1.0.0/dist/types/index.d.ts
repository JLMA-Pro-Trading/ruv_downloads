/**
 * @iris/core/types - Core Type Definitions
 *
 * Centralized type exports for the IRIS federated learning system.
 * Organized by domain with zero circular dependencies.
 *
 * ## Type Organization
 *
 * - **providers**: Model providers, signatures, LM configurations
 * - **metrics**: Performance tracking and measurement types
 * - **events**: Event structures, severity levels, notifiers
 * - **config**: IRIS and project configuration types
 * - **reports**: Evaluation reports and rotation recommendations
 * - **notifications**: Digest structures and notification configs
 *
 * ## Dependency Graph
 *
 * ```
 * Layer 1 (No dependencies):
 *   - ModelProvider, Signature, LMProviderConfig
 *   - IrisEventSeverity, IrisEventType
 *
 * Layer 2 (Layer 1 only):
 *   - PerformanceMetrics → ModelProvider
 *   - IrisEvent
 *
 * Layer 3 (Layer 2 only):
 *   - IrisNotifier → IrisEvent
 *
 * Layer 4 (Layer 3 only):
 *   - IrisPrimeConfig → IrisNotifier
 *   - IrisReport, CrossProjectReport
 *   - DailyDigest, WhatsAppNotificationConfig
 * ```
 *
 * @module @iris/core/types
 * @version 1.0.0
 */
/**
 * Language model provider identifiers
 */
export type { ModelProvider } from './providers.js';
/**
 * LM provider configuration for flexible provider selection
 */
export type { LMProviderConfig } from './providers.js';
/**
 * Signature definition for expert agent input/output structures
 */
export type { Signature } from './providers.js';
/**
 * Performance metrics for model provider tracking and comparison
 */
export type { PerformanceMetrics } from './metrics.js';
/**
 * Event severity levels: info, warning, critical
 */
export type { IrisEventSeverity } from './events.js';
/**
 * Event type categories for IRIS operations
 */
export type { IrisEventType } from './events.js';
/**
 * Standard IRIS event structure
 */
export type { IrisEvent } from './events.js';
/**
 * Notifier interface for custom notification handlers
 */
export type { IrisNotifier } from './events.js';
/**
 * Per-project configuration for automation and thresholds
 */
export type { ProjectConfig } from './config.js';
/**
 * Global IRIS orchestrator configuration
 */
export type { IrisPrimeConfig } from './config.js';
/**
 * Health status classification levels
 */
export type { HealthStatus } from './reports.js';
/**
 * Expert rotation recommendation structure
 */
export type { RotationRecommendation } from './reports.js';
/**
 * Comprehensive project evaluation report
 */
export type { IrisReport } from './reports.js';
/**
 * Cross-project evaluation summary
 */
export type { CrossProjectReport } from './reports.js';
/**
 * Daily digest structure for aggregated reporting
 */
export type { DailyDigest } from './notifications.js';
/**
 * WhatsApp notification configuration
 */
export type { WhatsAppNotificationConfig } from './notifications.js';
//# sourceMappingURL=index.d.ts.map
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
export {};
//# sourceMappingURL=index.js.map
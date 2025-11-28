/**
 * Configuration Types
 *
 * Defines configuration structures for IRIS orchestration and project settings.
 * Controls automation, thresholds, and operational parameters.
 *
 * @module @iris/core/types/config
 * @version 1.0.0
 */
import type { IrisNotifier } from './events.js';
/**
 * Project Configuration
 *
 * Per-project settings for IRIS automation and thresholds.
 * Controls when experts are automatically retrained or promoted.
 */
export interface ProjectConfig {
    /** Unique project identifier */
    projectId: string;
    /** Enable automatic expert retraining on drift */
    autoRetrain: boolean;
    /** Enable automatic prompt promotion when better versions available */
    autoPromote: boolean;
    /** Accuracy drop percentage (0.0-1.0) to trigger retraining */
    retrainingThreshold: number;
    /** Accuracy improvement percentage (0.0-1.0) required for promotion */
    promotionThreshold: number;
    /** Minimum evaluations required before promotion/rotation decisions */
    minEvaluations: number;
}
/**
 * IRIS Prime Configuration
 *
 * Global configuration for the IRIS orchestrator instance.
 * Defines database paths, scheduling, logging, and notification settings.
 */
export interface IrisPrimeConfig {
    /** Base path for IRIS databases (default: ./data/iris) */
    dbBasePath?: string;
    /** Default auto-retrain setting for projects (default: false) */
    defaultAutoRetrain?: boolean;
    /** Default auto-promote setting for projects (default: false) */
    defaultAutoPromote?: boolean;
    /** Evaluation schedule interval in milliseconds (default: 24 hours) */
    scheduleIntervalMs?: number;
    /** Path for IRIS logs (default: ./logs) */
    logPath?: string;
    /** Notification handlers for IRIS events */
    notifiers?: IrisNotifier[];
}
//# sourceMappingURL=config.d.ts.map
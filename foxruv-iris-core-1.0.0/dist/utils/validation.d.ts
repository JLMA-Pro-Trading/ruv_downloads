/**
 * Validation utilities for Iris Core
 * @module @iris/core/utils/validation
 */
import type { ProjectConfig, IrisOrchestratorConfig } from '../types.js';
/**
 * Validate project configuration
 */
export declare function validateProjectConfig(config: Partial<ProjectConfig>): void;
/**
 * Validate orchestrator configuration
 */
export declare function validateOrchestratorConfig(config: IrisOrchestratorConfig): void;
/**
 * Validate version string format
 */
export declare function validateVersionFormat(version: string): boolean;
//# sourceMappingURL=validation.d.ts.map
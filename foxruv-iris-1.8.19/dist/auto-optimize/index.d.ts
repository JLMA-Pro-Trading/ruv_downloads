/**
 * Iris Auto-Optimization Module
 *
 * The core self-improvement feature:
 * - Tracks AI function performance via telemetry
 * - Detects when optimization is needed
 * - Automatically triggers DSPy/Ax optimization
 *
 * @module auto-optimize
 */
export { type TelemetryRecord, type OptimizationTrigger, type AutoTriggerConfig, recordTelemetry, getTelemetryForTarget, getAllTargets, ensureTelemetryDir, calculateMetrics, shouldTriggerOptimization, checkAllTargets, logOptimizationTrigger, runAutoTriggerCheck, recordAndCheck } from './auto-trigger.js';
//# sourceMappingURL=index.d.ts.map
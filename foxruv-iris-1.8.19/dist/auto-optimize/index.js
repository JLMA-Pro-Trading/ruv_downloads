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
export { 
// Telemetry
recordTelemetry, getTelemetryForTarget, getAllTargets, ensureTelemetryDir, 
// Trigger logic
calculateMetrics, shouldTriggerOptimization, checkAllTargets, logOptimizationTrigger, 
// CLI integration
runAutoTriggerCheck, recordAndCheck } from './auto-trigger.js';

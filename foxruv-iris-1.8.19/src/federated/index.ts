/**
 * Federated Learning System - Main Entry Point
 *
 * @module Federated
 */

export { FederatedControlPlane, type ControlPlaneConfig, type ControlPlaneMetrics } from './FederatedControlPlane.js';
export { ScheduledJobs, type ScheduleConfig, type JobExecution } from './ScheduledJobs.js';
export { ProjectConnector, type ProjectConfig, type DeliveryResult, type PatternDeployment } from './ProjectConnector.js';

// Re-export from existing modules
export { AICouncil } from '../council/AICouncil.js';
export type { CouncilDecision } from '../council/types/index.js';
// Testing types not yet implemented - commented out
// export { PatternTestRunner } from '../testing/PatternTestRunner.js';
// export type { TestResult } from '../testing/types.js';

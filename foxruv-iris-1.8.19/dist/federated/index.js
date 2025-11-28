/**
 * Federated Learning System - Main Entry Point
 *
 * @module Federated
 */
export { FederatedControlPlane } from './FederatedControlPlane.js';
export { ScheduledJobs } from './ScheduledJobs.js';
export { ProjectConnector } from './ProjectConnector.js';
// Re-export from existing modules
export { AICouncil } from '../council/AICouncil.js';
// Testing types not yet implemented - commented out
// export { PatternTestRunner } from '../testing/PatternTestRunner.js';
// export type { TestResult } from '../testing/types.js';

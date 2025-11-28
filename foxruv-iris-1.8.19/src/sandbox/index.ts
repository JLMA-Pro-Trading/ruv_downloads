/**
 * E2B Sandbox Module
 * Exports sandbox integration utilities
 */

export {
  E2BSandboxManager,
  createE2BSandboxManager,
  getDefaultE2BSandboxManager,
  resetDefaultInstance,
} from './e2b-integration.js';

export type {
  E2BSandboxConfig,
  PromptVariantTest,
  SandboxTestResult,
  BatchTestRequest,
  BatchTestResults,
} from './e2b-integration.js';

/**
 * Expert signature management utilities
 *
 * Manages expert prompt signatures with versioning and optimization tracking:
 * - Store and load optimized expert prompts
 * - Track signature versions and upgrades
 * - Manage active/inactive versions
 * - Performance metrics per signature
 *
 * Signatures represent the optimized prompts that define how an expert agent
 * behaves. This module enables prompt evolution tracking and A/B testing.
 *
 * @example
 * ```typescript
 * // Store a new expert signature
 * await storeExpertSignature(
 *   'TheScout',
 *   'v1.1.0',
 *   'You are an expert NFL scout...',
 *   { fields: [...] },
 *   {
 *     performanceMetrics: { accuracy: 0.88 },
 *     setActive: true
 *   }
 * );
 *
 * // Load the active signature
 * const active = await loadActiveExpertSignature('TheScout');
 *
 * // Track an upgrade
 * await recordSignatureUpgrade(
 *   'TheScout',
 *   'v1.0.0',
 *   'v1.1.0',
 *   'Improved prediction accuracy by 6%',
 *   { accuracyImprovement: 0.06 }
 * );
 * ```
 */
import { ExpertSignature, SignatureVersion } from './types.js';
/**
 * Store an optimized expert signature with version tracking
 *
 * Saves a new or updated expert prompt signature. Optionally deactivates
 * previous versions when setting as active. This enables clean version
 * management and A/B testing capabilities.
 *
 * @param expertId - Unique identifier for the expert
 * @param version - Semantic version (e.g., 'v1.0.0', 'v2.1.0')
 * @param prompt - The expert's system prompt text
 * @param signature - DSPy signature definition
 * @param options - Optional configuration
 * @param options.performanceMetrics - Metrics for this signature version
 * @param options.metadata - Additional metadata
 * @param options.setActive - Set as active version (default: true)
 * @returns The stored signature record
 * @throws Error if storage fails
 *
 * @example
 * ```typescript
 * const signature = await storeExpertSignature(
 *   'TheAnalyst',
 *   'v2.0.0',
 *   'You are an expert NFL analyst with 20 years of experience...',
 *   {
 *     inputs: { teamStats: 'string', matchup: 'string' },
 *     outputs: { prediction: 'string', confidence: 'number' }
 *   },
 *   {
 *     performanceMetrics: {
 *       accuracy: 0.91,
 *       avgConfidence: 0.87,
 *       avgLatency: 1250
 *     },
 *     metadata: {
 *       trainingDate: '2024-11-15',
 *       modelUsed: 'claude-3-5-sonnet'
 *     },
 *     setActive: true
 *   }
 * );
 * ```
 */
export declare function storeExpertSignature(expertId: string, version: string, prompt: string, signature: Record<string, any>, options?: {
    performanceMetrics?: Record<string, any>;
    metadata?: Record<string, any>;
    setActive?: boolean;
}): Promise<ExpertSignature>;
/**
 * Load the active expert signature for a given expert
 */
export declare function loadActiveExpertSignature(expertId: string): Promise<ExpertSignature | null>;
/**
 * Load a specific version of an expert signature
 */
export declare function loadExpertSignatureVersion(expertId: string, version: string): Promise<ExpertSignature | null>;
/**
 * Get all versions of an expert signature
 */
export declare function getSignatureHistory(expertId: string): Promise<ExpertSignature[]>;
/**
 * Track a signature version upgrade
 */
export declare function recordSignatureUpgrade(expertId: string, fromVersion: string, toVersion: string, changelog: string, improvementMetrics?: Record<string, any>): Promise<SignatureVersion>;
/**
 * Get signature version history for an expert
 */
export declare function getSignatureVersionHistory(expertId: string): Promise<SignatureVersion[]>;
//# sourceMappingURL=signatures.d.ts.map
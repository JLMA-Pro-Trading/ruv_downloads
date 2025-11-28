#!/usr/bin/env node
/**
 * Agent Booster - Morph LLM Compatible API
 *
 * Drop-in replacement for Morph LLM with 52x better performance
 */
export interface MorphApplyRequest {
    /** Original code to modify */
    code: string;
    /** Edit instruction or snippet to apply */
    edit: string;
    /** Programming language (e.g., 'javascript', 'typescript', 'python') */
    language?: string;
}
export interface MorphApplyResponse {
    /** Modified code after applying the edit (Morph-compatible) */
    output: string;
    /** Whether the edit was successful (Morph-compatible) */
    success: boolean;
    /** Latency in milliseconds (Morph-compatible) */
    latency: number;
    /** Token usage (Morph-compatible) */
    tokens: {
        input: number;
        output: number;
    };
    /** Confidence score (0-1) - Agent Booster extension */
    confidence: number;
    /** Strategy used for merging - Agent Booster extension */
    strategy: string;
}
export interface AgentBoosterConfig {
    /** Minimum confidence threshold (0-1). Default: 0.5 */
    confidenceThreshold?: number;
    /** Maximum chunks to analyze. Default: 100 */
    maxChunks?: number;
}
/**
 * Agent Booster - Morph-compatible code editor
 *
 * @example
 * ```typescript
 * const booster = new AgentBooster();
 * const result = await booster.apply({
 *   code: 'function add(a, b) { return a + b; }',
 *   edit: 'function add(a: number, b: number): number { return a + b; }',
 *   language: 'typescript'
 * });
 * console.log(result.code); // Modified code
 * ```
 */
export declare class AgentBooster {
    private config;
    private wasmInstance;
    constructor(config?: AgentBoosterConfig);
    /**
     * Apply a code edit (100% Morph-compatible API)
     *
     * @param request - Apply request
     * @returns Modified code in Morph-compatible format
     */
    apply(request: MorphApplyRequest): Promise<MorphApplyResponse>;
    /**
     * Batch apply multiple edits
     *
     * @param requests - Array of apply requests
     * @returns Array of results
     */
    batchApply(requests: MorphApplyRequest[]): Promise<MorphApplyResponse[]>;
    private getConfidence;
    private getStrategy;
    private getMergedCode;
    private strategyToString;
}
/**
 * Convenience function for single apply operation
 *
 * @param request - Apply request
 * @returns Modified code with metadata
 */
export declare function apply(request: MorphApplyRequest): Promise<MorphApplyResponse>;
export default AgentBooster;
//# sourceMappingURL=index.d.ts.map
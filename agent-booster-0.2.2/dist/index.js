#!/usr/bin/env node
"use strict";
/**
 * Agent Booster - Morph LLM Compatible API
 *
 * Drop-in replacement for Morph LLM with 52x better performance
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentBooster = void 0;
exports.apply = apply;
const path = __importStar(require("path"));
// Load WASM module
const wasmPath = path.join(__dirname, '../wasm/agent_booster_wasm.js');
let AgentBoosterWasm;
try {
    AgentBoosterWasm = require(wasmPath);
}
catch (e) {
    throw new Error(`Failed to load WASM module from ${wasmPath}: ${e}`);
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
class AgentBooster {
    constructor(config = {}) {
        this.config = {
            confidenceThreshold: config.confidenceThreshold || 0.5,
            maxChunks: config.maxChunks || 100,
        };
        // Initialize WASM instance
        this.wasmInstance = new AgentBoosterWasm.AgentBoosterWasm();
    }
    /**
     * Apply a code edit (100% Morph-compatible API)
     *
     * @param request - Apply request
     * @returns Modified code in Morph-compatible format
     */
    async apply(request) {
        const startTime = Date.now();
        try {
            // Validate input - detect vague instructions
            if (!request.edit || request.edit.trim().length === 0) {
                throw new Error('Edit instruction cannot be empty. Provide specific code snippet or transformation.');
            }
            // Detect vague/non-code instructions
            const vaguePhrases = [
                'make it better', 'improve', 'optimize', 'fix', 'refactor',
                'add feature', 'implement', 'create', 'design', 'build',
                'handle', 'manage', 'process', 'support'
            ];
            const isVague = vaguePhrases.some(phrase => request.edit.toLowerCase().includes(phrase) &&
                !request.edit.includes('{') && // No code blocks
                !request.edit.includes('function') && // No function def
                !request.edit.includes('const') && // No variable def
                !request.edit.includes('class') // No class def
            );
            if (isVague) {
                throw new Error(`Vague instruction detected: "${request.edit}". Agent Booster requires specific code snippets, not high-level instructions. Use an LLM for vague tasks.`);
            }
            // Call WASM module with confidence threshold
            const result = this.wasmInstance.apply_edit(request.code, request.edit, request.language || 'javascript', this.config.confidenceThreshold);
            const latency = Date.now() - startTime;
            // Debug: Log WASM result structure
            if (process.env.DEBUG_AGENT_BOOSTER) {
                console.log('WASM result:', {
                    type: typeof result,
                    confidence: result.confidence,
                    strategy: result.strategy,
                    merged_code_length: result.merged_code?.length,
                });
            }
            // Convert WASM result to Morph-compatible format
            const confidence = this.getConfidence(result);
            const strategy = this.getStrategy(result);
            const mergedCode = this.getMergedCode(result);
            // Calculate token estimates (WASM doesn't track tokens, so we estimate)
            const inputTokens = Math.ceil(request.code.length / 4);
            const outputTokens = Math.ceil(mergedCode.length / 4);
            return {
                // Morph-compatible fields
                output: mergedCode,
                success: confidence > this.config.confidenceThreshold,
                latency: latency,
                tokens: {
                    input: inputTokens,
                    output: outputTokens,
                },
                // Agent Booster extensions (don't break Morph compatibility)
                confidence: confidence,
                strategy: this.strategyToString(strategy),
            };
        }
        catch (error) {
            // Return failure in Morph-compatible format
            const latency = Date.now() - startTime;
            // Debug: Log error
            if (process.env.DEBUG_AGENT_BOOSTER) {
                console.error('Error in apply():', error.message || error);
            }
            return {
                output: request.code,
                success: false,
                latency: latency,
                tokens: { input: 0, output: 0 },
                confidence: 0,
                strategy: 'failed',
            };
        }
    }
    /**
     * Batch apply multiple edits
     *
     * @param requests - Array of apply requests
     * @returns Array of results
     */
    async batchApply(requests) {
        return Promise.all(requests.map(req => this.apply(req)));
    }
    // Helper methods to extract data from WASM result
    getConfidence(result) {
        if (typeof result === 'object' && result !== null) {
            if (typeof result.confidence === 'number')
                return result.confidence;
            if (typeof result.get_confidence === 'function')
                return result.get_confidence();
        }
        return 0.5;
    }
    getStrategy(result) {
        if (typeof result === 'object' && result !== null) {
            if (typeof result.strategy === 'number')
                return result.strategy;
            if (typeof result.strategy === 'string')
                return result.strategy;
            if (typeof result.get_strategy === 'function')
                return result.get_strategy();
        }
        return 2; // Default to InsertAfter
    }
    getMergedCode(result) {
        if (typeof result === 'object' && result !== null) {
            if (typeof result.merged_code === 'string')
                return result.merged_code;
            if (typeof result.get_merged_code === 'function')
                return result.get_merged_code();
            if (typeof result.code === 'string')
                return result.code;
        }
        return '';
    }
    strategyToString(strategy) {
        if (typeof strategy === 'string')
            return strategy;
        const strategies = {
            0: 'exact_replace',
            1: 'fuzzy_replace',
            2: 'insert_after',
            3: 'insert_before',
            4: 'append',
        };
        return strategies[strategy] || 'unknown';
    }
}
exports.AgentBooster = AgentBooster;
/**
 * Convenience function for single apply operation
 *
 * @param request - Apply request
 * @returns Modified code with metadata
 */
async function apply(request) {
    const booster = new AgentBooster();
    return booster.apply(request);
}
// Default export
exports.default = AgentBooster;
//# sourceMappingURL=index.js.map
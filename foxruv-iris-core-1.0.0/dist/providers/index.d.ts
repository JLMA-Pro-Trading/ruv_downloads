/**
 * @iris/core/providers
 *
 * Language Model Provider System
 * Pure Node.js implementation with no external dependencies
 *
 * Exports:
 * - ClaudeProvider: Anthropic Claude API wrapper
 * - Qwen3Provider: OpenAI-compatible local model wrapper
 * - LMProviderManager: Multi-provider manager with performance tracking
 * - Types: All provider types and interfaces
 * - Factory functions: getLMProvider, resetLMProvider
 */
export { ClaudeProvider } from './claude.js';
export { Qwen3Provider } from './qwen.js';
export { LMProviderManager, getLMProvider, resetLMProvider } from './manager.js';
export type { Signature } from './claude.js';
export type { ModelProvider, LMProviderConfig, PerformanceMetrics } from './manager.js';
import { ClaudeProvider } from './claude.js';
import { Qwen3Provider } from './qwen.js';
import { LMProviderManager, getLMProvider, resetLMProvider } from './manager.js';
declare const _default: {
    ClaudeProvider: typeof ClaudeProvider;
    Qwen3Provider: typeof Qwen3Provider;
    LMProviderManager: typeof LMProviderManager;
    getLMProvider: typeof getLMProvider;
    resetLMProvider: typeof resetLMProvider;
};
export default _default;
//# sourceMappingURL=index.d.ts.map
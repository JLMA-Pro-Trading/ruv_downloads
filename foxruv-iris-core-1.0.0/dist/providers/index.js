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
// ============================================================================
// Providers
// ============================================================================
export { ClaudeProvider } from './claude.js';
export { Qwen3Provider } from './qwen.js';
export { LMProviderManager, getLMProvider, resetLMProvider } from './manager.js';
// ============================================================================
// Re-export for convenience
// ============================================================================
import { ClaudeProvider } from './claude.js';
import { Qwen3Provider } from './qwen.js';
import { LMProviderManager, getLMProvider, resetLMProvider } from './manager.js';
export default {
    ClaudeProvider,
    Qwen3Provider,
    LMProviderManager,
    getLMProvider,
    resetLMProvider
};
//# sourceMappingURL=index.js.map
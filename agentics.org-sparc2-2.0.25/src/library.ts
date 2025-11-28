/**
 * SPARC 2.0 Library Mode
 *
 * This file provides a library-only version of SPARC2 without CLI output
 */

// Re-export everything from index.ts except the CLI
export { SPARC2Agent } from "./agent/agent.ts";
export type { AgentOptions, FileToProcess, ModificationResult } from "./agent/agent.ts";

// Agent Types
export type {
  AgentConfig,
  AgentContext,
  AgentFlow,
  AgentStep,
  Assistant,
  AssistantOptions,
  ChatCompletionOptions,
  ChatMessage,
  CompletionOptions,
  LLMProvider,
  RawAgentConfig,
  ToolDefinition,
  ToolFunction,
} from "./agent/types.ts";

// Providers
export { OpenAIProvider } from "./agent/providers/openai-provider.ts";
export type { OpenAIProviderOptions } from "./agent/providers/openai-provider.ts";

export { OpenRouterProvider } from "./agent/providers/openrouter-provider.ts";
export type { OpenRouterProviderOptions } from "./agent/providers/openrouter-provider.ts";

export { MockProvider } from "./agent/providers/mock-provider.ts";
export type { MockProviderOptions } from "./agent/providers/mock-provider.ts";

export { ProviderFactory } from "./agent/providers/provider-factory.ts";

// Config
export { loadConfig } from "./config.ts";
export type { SPARCConfig } from "./config.ts";

// Edge Function
export { handleRequest } from "./edge/edge.ts";

// CORS
export { applyCorsHeaders, corsHeaders } from "./_shared/cors.ts";

// Diff Tracking
export { computeDiff } from "./diff/diffTracker.ts";
export type { DiffHunk, DiffResult } from "./diff/diffTracker.ts";

// Git Integration
export {
  createCheckpoint,
  createCommit,
  getCurrentBranch,
  isRepoClean,
  rollbackChanges,
} from "./git/gitIntegration.ts";

// Vector Store
export { indexDiffEntry, searchDiffEntries } from "./vector/vectorStore.ts";
export type { DiffEntry } from "./vector/vectorStore.ts";

// Code Interpreter
export { executeCode } from "./sandbox/codeInterpreter.ts";
export type {
  CodeInterpreterOptions,
  ExecutionResult,
  RunCodeOptions,
  Sandbox,
} from "./sandbox/codeInterpreter.ts";

// Logger
export { logMessage } from "./logger.ts";
export type { LogEntry, LogLevel } from "./logger.ts";

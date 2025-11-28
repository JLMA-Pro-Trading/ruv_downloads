/**
 * Types for the SPARC2 Agent Framework
 */

/**
 * Chat message for LLM interactions
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  tool_calls?: any[];
  name?: string;
}

/**
 * Options for completions
 */
export interface CompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Options for chat completions
 */
export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  tools?: any[];
}

/**
 * Assistant definition
 */
export interface Assistant {
  id: string;
  provider: string;
  name: string;
  model: string;
}

/**
 * Options for creating an assistant
 */
export interface AssistantOptions {
  name: string;
  description?: string;
  model?: string;
  instructions?: string;
  tools?: ToolDefinition[];
}

/**
 * Tool definition for assistants
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: any;
}

/**
 * Tool function type
 */
export type ToolFunction = (args: any, context: AgentContext) => Promise<string>;

/**
 * Agent step in a flow
 */
export interface AgentStep {
  name: string;
  provider: LLMProvider;
  model?: string;
  description?: string;
  systemPrompt?: string;
  useAssistant?: boolean;
  assistantInstructions?: string;
  tools?: string[];
}

/**
 * Agent flow definition
 */
export interface AgentFlow {
  name: string;
  description?: string;
  steps: Record<string, AgentStep>;
  transitions: Record<string, string>;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  name: string;
  description?: string;
  defaultFlow: string;
  providers: Record<string, LLMProvider>;
  flows: Record<string, AgentFlow>;
}

/**
 * Raw agent configuration from TOML
 */
export interface RawAgentConfig {
  agent: {
    name: string;
    description?: string;
    default_flow: string;
  };
  providers: Record<string, any>;
  flows: Record<string, any>;
}

/**
 * Agent context for sharing data between steps
 */
export interface AgentContext {
  input?: string;
  output?: string;
  files?: FileToProcess[];
  [key: string]: any;
}

/**
 * File to be processed by the agent
 */
export interface FileToProcess {
  path: string;
  originalContent: string;
  newContent?: string;
}

/**
 * Result of a code modification
 */
export interface ModificationResult {
  path: string;
  originalContent: string;
  newContent: string;
  diff: string;
  commitHash?: string;
}

/**
 * LLM Provider interface
 */
export interface LLMProvider {
  /**
   * Get the provider name
   */
  getName(): string;

  /**
   * Get a completion from the LLM
   * @param prompt The prompt to send to the LLM
   * @param options Options for the completion
   */
  getCompletion(prompt: string, options?: CompletionOptions): Promise<string>;

  /**
   * Get a chat completion from the LLM
   * @param messages The messages to send to the LLM
   * @param options Options for the chat completion
   */
  getChatCompletion(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatMessage>;

  /**
   * Check if the provider supports assistants
   */
  supportsAssistants(): boolean;

  /**
   * Create an assistant (if supported)
   * @param options Options for the assistant
   */
  createAssistant?(options: AssistantOptions): Promise<Assistant>;
}

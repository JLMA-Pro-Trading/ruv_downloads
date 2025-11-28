export interface ToolCall {
    id?: string;
    function: {
        name: string;
        arguments: string;
    };
}
export interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content: string;
    name?: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
}
export interface Tool {
    name: string;
    description: string;
    parameters: object;
    execute: (params: any) => Promise<any>;
}
export interface Guardrail {
    check: (msgs: Message[], context: Context) => Promise<boolean>;
    onFailure: (msgs: Message[], context: Context) => void;
}
export interface Agent {
    name: string;
    instructions: string;
    tools: Tool[];
    model: string;
    input_guardrails?: Guardrail[];
}
export interface UserPreferences {
    language: string;
    notifications: boolean;
    theme: string;
}
export interface AuthInfo {
    userId?: string;
    sessionId?: string;
    permissions?: string[];
}
export interface AgentState {
    preferences: UserPreferences;
    auth: AuthInfo;
    workflow_id?: string;
    collected_info: Record<string, boolean>;
    previous_actions: string[];
    resources: Record<string, any>;
    memory: Record<string, any>;
}
export interface Context {
    conversation: Message[];
    state: AgentState;
    parent?: Context;
    addMessage(message: Message): void;
    getConversationHistory(): Message[];
    setState<K extends keyof AgentState>(key: K, value: AgentState[K]): void;
    getState<K extends keyof AgentState>(key: K): AgentState[K] | undefined;
    setResource(key: string, value: any): void;
    getResource(key: string): any;
    remember(key: string, value: any): void;
    recall(key: string): any;
    trackAction(action: string): void;
    getActions(): string[];
    markCollected(field: string): void;
    isCollected(field: string): boolean;
    initializeWorkflow(): void;
    getWorkflowId(): string | undefined;
}
export interface AgentRunConfig {
    run_name?: string;
    tracing_disabled?: boolean;
    trace_non_openai_generations?: boolean;
}
export interface StreamEvent {
    delta: string;
    type: "partial" | "tool_call" | "final";
}
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (params: any, context: Context) => Promise<any>;
}
export interface MCPServerConfig {
    name: string;
    version: string;
    openai: {
        apiKey: string;
        defaultModel: string;
    };
    tracing?: {
        enabled: boolean;
        level: 'debug' | 'info' | 'error';
    };
    tools: {
        enabled: string[];
        config: Record<string, any>;
    };
    guardrails: {
        enabled: boolean;
        rules: Guardrail[];
    };
}
export interface MCPRequest {
    jsonrpc: '2.0';
    id: string | number;
    method: string;
    params: any;
}
export interface MCPResponse {
    jsonrpc: '2.0';
    id: string | number;
    result?: any;
    error?: {
        code: number;
        message: string;
    };
}
export interface MCPStreamResponse {
    type: string;
    content: string;
    done: boolean;
}
export interface MCPStreamEvent {
    type: string;
    content: string;
    metadata?: Record<string, any>;
}
export interface ResourceHandler {
    get: (params: any) => Promise<any>;
    watch?: (params: any, onChange: () => void) => Promise<() => void>;
}
export interface Resource {
    uri: string;
    name: string;
    description?: string;
    mimeType?: string;
    handler: ResourceHandler;
}
export interface Span {
    id: string;
    name: string;
    startTime: number;
    endTime?: number;
    metadata?: Record<string, any>;
}
export interface Trace {
    id: string;
    spans: Span[];
    metadata: Record<string, any>;
}

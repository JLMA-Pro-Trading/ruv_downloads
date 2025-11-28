/**
 * Prompt Boost Command
 *
 * Manages the prompt injection and shadow improvement features:
 * - inject: Always prepend "using agentic-flow AND AgentDB"
 * - shadow: Run local model to improve prompts, log but don't send
 */
export interface PromptBoostConfig {
    enabled: boolean;
    engine: 'agentic-flow' | 'claude-flow';
    alwaysInjectEngine: boolean;
    experimentalImprove: {
        enabled: boolean;
        shadowMode: boolean;
        localModel: string;
        modelName: string;
        endpoint: string;
        cloudVerify: {
            enabled: boolean;
            model: string;
            batchSize: number;
            minConfidence: number;
        };
    };
}
export declare function runPromptBoostStatus(projectPath: string): Promise<void>;
export declare function runPromptBoostOn(projectPath: string): Promise<void>;
export declare function runPromptBoostOff(projectPath: string): Promise<void>;
export declare function runPromptBoostShadow(projectPath: string, enable: boolean): Promise<void>;
export declare function runPromptBoostSetModel(projectPath: string, model: string, options: {
    endpoint?: string;
    type?: string;
}): Promise<void>;
export declare function runPromptBoostReview(projectPath: string): Promise<void>;
/**
 * Log an experiment (called by the hook)
 */
export declare function logExperiment(projectPath: string, original: string, improved: string | null, context?: Record<string, any>): void;
/**
 * Generate the injection text based on config
 */
export declare function getInjectionText(config: PromptBoostConfig): string;
/**
 * Call local model to improve prompt (for shadow mode)
 * Supports: LM Studio (OpenAI-compatible), Ollama, vLLM
 */
export declare function improvePromptWithLocalModel(prompt: string, config: PromptBoostConfig): Promise<string | null>;
//# sourceMappingURL=prompt-boost.d.ts.map
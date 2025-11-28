/**
 * LLMCouncilAdvisor
 * -----------------
 * Optional AI-driven council helper that sends telemetry/metric snapshots
 * to an LLM endpoint (e.g., OpenAI-compatible) to get recommendations.
 *
 * This is opt-in: requires AI_COUNCIL_ENDPOINT (and optionally AI_COUNCIL_API_KEY).
 */
export interface CouncilAdvice {
    recommendations: string[];
    rationale?: string;
    raw?: any;
}
export interface LLMCouncilConfig {
    endpoint?: string;
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
}
export declare class LLMCouncilAdvisor {
    private readonly endpoint?;
    private readonly apiKey?;
    private readonly model;
    private readonly timeoutMs;
    constructor(config?: LLMCouncilConfig);
    isEnabled(): boolean;
    proposeDecisions(metricsSnapshot: any): Promise<CouncilAdvice | null>;
}
//# sourceMappingURL=LLMCouncilAdvisor.d.ts.map
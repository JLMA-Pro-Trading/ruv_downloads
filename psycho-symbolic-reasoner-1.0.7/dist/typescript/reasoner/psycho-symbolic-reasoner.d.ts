/**
 * Main Psycho-Symbolic Reasoner implementation
 * Integrates WASM modules for graph reasoning, planning, and extraction
 */
interface KnowledgeTriple {
    id: string;
    subject: string;
    predicate: string;
    object: string;
    confidence: number;
    metadata?: Record<string, any>;
    timestamp: number;
}
interface ReasoningStep {
    step: number;
    description: string;
    confidence: number;
    duration_ms: number;
    details?: any;
}
interface ReasoningResult {
    query: string;
    result: string;
    confidence: number;
    steps: ReasoningStep[];
    metadata: {
        depth_used: number;
        processing_time_ms: number;
        nodes_explored: number;
        reasoning_type: string;
    };
}
export declare class PsychoSymbolicReasoner {
    private knowledgeGraph;
    private entityIndex;
    private predicateIndex;
    private reasoningCache;
    private startTime;
    constructor();
    /**
     * Initialize with base knowledge about psycho-symbolic reasoning
     */
    private initializeBaseKnowledge;
    /**
     * Add knowledge triple to the graph
     */
    addKnowledge(subject: string, predicate: string, object: string, metadata?: Record<string, any>): KnowledgeTriple;
    /**
     * Helper to add to index
     */
    private addToIndex;
    /**
     * Query the knowledge graph
     */
    queryKnowledgeGraph(query: string, filters?: Record<string, any>, limit?: number): any;
    /**
     * Perform psycho-symbolic reasoning
     */
    reason(query: string, context?: Record<string, any>, depth?: number): Promise<ReasoningResult>;
    /**
     * Extract entities from query
     */
    private extractEntities;
    /**
     * Traverse graph starting from entities
     */
    private traverseGraph;
    /**
     * Apply inference rules
     */
    private applyInferenceRules;
    /**
     * Synthesize final result
     */
    private synthesizeResult;
    /**
     * Determine reasoning type from query
     */
    private determineReasoningType;
    /**
     * Analyze reasoning path
     */
    analyzeReasoningPath(query: string, showSteps?: boolean, includeConfidence?: boolean): any;
    /**
     * Get health status
     */
    getHealthStatus(detailed?: boolean): any;
}
export declare function getReasoner(): PsychoSymbolicReasoner;
export {};
//# sourceMappingURL=psycho-symbolic-reasoner.d.ts.map
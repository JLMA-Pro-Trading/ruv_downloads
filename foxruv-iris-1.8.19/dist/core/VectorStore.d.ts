/**
 * Vector Store - Simple wrapper around AgentDB
 * This is a placeholder - actual implementation should use AgentDB
 */
export interface Vector {
    id: string;
    vector: number[];
    metadata: Record<string, any>;
}
export declare class VectorStore {
    private readonly store;
    private readonly persistPath?;
    private readonly agentdb;
    constructor(config: {
        dimension: number;
        metric?: string;
        persistPath?: string;
    });
    initialize(): Promise<void>;
    insert(_vectors: Vector[]): Promise<void>;
    retrieve(_ids: string[]): Promise<Vector[]>;
    search(_query: number[], _limit: number): Promise<Vector[]>;
    private persist;
}
//# sourceMappingURL=VectorStore.d.ts.map
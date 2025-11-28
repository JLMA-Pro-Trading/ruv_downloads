/**
 * AgentDB Configuration
 *
 * Configuration types and defaults for AgentDB integration
 */
export interface AgentDBConfig {
    /**
     * Vector dimension for embeddings
     */
    vectorDimension: number;
    /**
     * Index type for vector search
     */
    indexType: 'hnsw' | 'flat' | 'ivf';
    /**
     * HNSW-specific parameters
     */
    hnswParams?: {
        m: number;
        efConstruction: number;
        efSearch: number;
    };
    /**
     * IVF-specific parameters
     */
    ivfParams?: {
        nlist: number;
        nprobe: number;
    };
    /**
     * Enable MCP (Model Context Protocol) integration
     */
    mcpEnabled: boolean;
    /**
     * Frontier memory features
     */
    frontierMemory: {
        /**
         * Enable causal reasoning
         */
        causalReasoning: boolean;
        /**
         * Enable reflexion memory with self-critique
         */
        reflexionMemory: boolean;
        /**
         * Enable skill library with semantic search
         */
        skillLibrary: boolean;
        /**
         * Enable automated learning system
         */
        automatedLearning: boolean;
    };
    /**
     * Storage configuration
     */
    storage: {
        /**
         * Storage path for persistent data
         */
        path: string;
        /**
         * Enable in-memory mode (no persistence)
         */
        inMemory: boolean;
        /**
         * Auto-save interval in milliseconds
         */
        autoSaveInterval?: number;
    };
    /**
     * Performance tuning
     */
    performance: {
        /**
         * Maximum number of concurrent operations
         */
        maxConcurrency: number;
        /**
         * Cache size for search results
         */
        cacheSize: number;
        /**
         * Enable batch operations
         */
        batchEnabled: boolean;
    };
}
/**
 * Default AgentDB configuration
 */
export declare const DEFAULT_AGENTDB_CONFIG: AgentDBConfig;
/**
 * Merge user config with defaults
 */
export declare function mergeConfig(userConfig: Partial<AgentDBConfig>): AgentDBConfig;

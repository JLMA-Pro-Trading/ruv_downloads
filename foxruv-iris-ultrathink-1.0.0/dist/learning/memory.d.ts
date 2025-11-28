/**
 * AgentDB Memory System
 *
 * Persistent storage and retrieval for MCP metadata:
 * - Server and tool metadata with vector embeddings
 * - Generation template caching
 * - Version control for wrappers
 * - Semantic search for tools and patterns
 *
 * Uses AgentDB's vector search and HNSW indexing
 */
import type { MCPServerMetadata, MCPToolMetadata, GenerationTemplate, WrapperVersion, SearchQuery, SearchResult } from './types.js';
export declare class MCPMemorySystem {
    private db;
    private vectorSearch;
    private hnswIndex;
    private embedder;
    private batchOps;
    private cache;
    private cacheExpiry;
    constructor(dbPath?: string, embeddingModel?: string, vectorDimensions?: number);
    /**
     * Initialize database schema
     */
    private initializeSchema;
    /**
     * Store MCP server metadata
     */
    storeServerMetadata(server: MCPServerMetadata): Promise<void>;
    /**
     * Generate embedding for a tool
     */
    private generateToolEmbedding;
    /**
     * Get server metadata by ID or name
     */
    getServer(idOrName: string): Promise<MCPServerMetadata | null>;
    /**
     * Get tools by IDs
     */
    private getToolsByIds;
    /**
     * Search for tools using semantic search
     */
    searchTools(query: SearchQuery): Promise<SearchResult<MCPToolMetadata>[]>;
    /**
     * Get tool by ID
     */
    getTool(id: string): Promise<MCPToolMetadata | null>;
    /**
     * Store generation template
     */
    storeTemplate(template: GenerationTemplate): Promise<void>;
    /**
     * Get template by ID
     */
    getTemplate(id: string): Promise<GenerationTemplate | null>;
    /**
     * Search templates
     */
    searchTemplates(query: string, limit?: number): Promise<SearchResult<GenerationTemplate>[]>;
    /**
     * Store wrapper version
     */
    storeWrapperVersion(version: WrapperVersion): Promise<void>;
    /**
     * Get wrapper versions for a server
     */
    getWrapperVersions(serverId: string): Promise<WrapperVersion[]>;
    /**
     * Get latest non-deprecated wrapper version
     */
    getLatestWrapperVersion(serverId: string): Promise<WrapperVersion | null>;
    /**
     * Update template usage
     */
    updateTemplateUsage(templateId: string, success: boolean): Promise<void>;
    /**
     * Get all servers
     */
    getAllServers(): Promise<MCPServerMetadata[]>;
    /**
     * Clear cache
     */
    clearCache(): void;
    /**
     * Vacuum database to optimize storage
     */
    vacuum(): Promise<void>;
    /**
     * Export memory data
     */
    exportData(outputPath: string): Promise<void>;
    private rowToTool;
    private matchesFilters;
    private generateSearchReason;
    private cosineSimilarity;
}
//# sourceMappingURL=memory.d.ts.map
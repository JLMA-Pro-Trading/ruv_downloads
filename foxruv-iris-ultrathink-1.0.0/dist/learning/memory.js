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
import { WASMVectorSearch, HNSWIndex, EmbeddingService, BatchOperations, createDatabase } from 'agentdb';
export class MCPMemorySystem {
    db;
    vectorSearch;
    hnswIndex;
    embedder;
    batchOps;
    cache = new Map();
    cacheExpiry = 300000; // 5 minutes
    constructor(dbPath = './ultrathink-memory.db', embeddingModel = 'transformer', vectorDimensions = 384) {
        this.db = createDatabase(dbPath);
        this.embedder = new EmbeddingService(embeddingModel);
        this.vectorSearch = new WASMVectorSearch(this.db, {
            enableWASM: true,
            enableSIMD: true,
            batchSize: 100,
            indexThreshold: 1000
        });
        this.hnswIndex = new HNSWIndex(this.db, {
            dimension: vectorDimensions,
            M: 16,
            efConstruction: 200,
            efSearch: 100,
            metric: 'cosine',
            maxElements: 100000,
            persistIndex: false,
            rebuildThreshold: 0.1
        });
        this.batchOps = new BatchOperations(this.db, this.embedder);
        this.initializeSchema();
    }
    /**
     * Initialize database schema
     */
    initializeSchema() {
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        version TEXT NOT NULL,
        description TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        tools TEXT NOT NULL,
        added INTEGER NOT NULL,
        last_updated INTEGER NOT NULL,
        status TEXT NOT NULL,
        embedding BLOB
      );

      CREATE INDEX IF NOT EXISTS idx_servers_name ON mcp_servers(name);
      CREATE INDEX IF NOT EXISTS idx_servers_status ON mcp_servers(status);

      CREATE TABLE IF NOT EXISTS mcp_tools (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        input_schema TEXT NOT NULL,
        output_schema TEXT,
        examples TEXT NOT NULL,
        tags TEXT NOT NULL,
        category TEXT,
        complexity TEXT NOT NULL,
        reliability REAL NOT NULL,
        avg_latency REAL NOT NULL,
        embedding BLOB,
        FOREIGN KEY (server_id) REFERENCES mcp_servers(id)
      );

      CREATE INDEX IF NOT EXISTS idx_tools_server ON mcp_tools(server_id);
      CREATE INDEX IF NOT EXISTS idx_tools_name ON mcp_tools(name);
      CREATE INDEX IF NOT EXISTS idx_tools_category ON mcp_tools(category);

      CREATE TABLE IF NOT EXISTS generation_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        version TEXT NOT NULL,
        server_id TEXT NOT NULL,
        tool_ids TEXT NOT NULL,
        template TEXT NOT NULL,
        variables TEXT NOT NULL,
        created INTEGER NOT NULL,
        last_used INTEGER NOT NULL,
        use_count INTEGER NOT NULL,
        success_rate REAL NOT NULL,
        embedding BLOB,
        FOREIGN KEY (server_id) REFERENCES mcp_servers(id)
      );

      CREATE INDEX IF NOT EXISTS idx_templates_server ON generation_templates(server_id);
      CREATE INDEX IF NOT EXISTS idx_templates_success ON generation_templates(success_rate);

      CREATE TABLE IF NOT EXISTS wrapper_versions (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        version TEXT NOT NULL,
        code TEXT NOT NULL,
        metadata TEXT NOT NULL,
        created INTEGER NOT NULL,
        deprecated INTEGER NOT NULL DEFAULT 0,
        deprecation_reason TEXT,
        FOREIGN KEY (server_id) REFERENCES mcp_servers(id)
      );

      CREATE INDEX IF NOT EXISTS idx_versions_server ON wrapper_versions(server_id);
      CREATE INDEX IF NOT EXISTS idx_versions_deprecated ON wrapper_versions(deprecated);

      CREATE TABLE IF NOT EXISTS semantic_cache (
        query_hash TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        result_type TEXT NOT NULL,
        result TEXT NOT NULL,
        embedding BLOB NOT NULL,
        created INTEGER NOT NULL,
        accessed INTEGER NOT NULL,
        access_count INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_cache_created ON semantic_cache(created);
    `);
    }
    /**
     * Store MCP server metadata
     */
    async storeServerMetadata(server) {
        const embedding = await this.embedder.embed(`${server.name}: ${server.description}. Capabilities: ${server.capabilities.join(', ')}`);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO mcp_servers (
        id, name, version, description, capabilities, tools,
        added, last_updated, status, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(server.id, server.name, server.version, server.description, JSON.stringify(server.capabilities), JSON.stringify(server.tools.map(t => t.id)), server.added, server.lastUpdated, server.status, Buffer.from(new Float32Array(embedding).buffer));
        // Store tools in a transaction for better performance
        const insertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO mcp_tools (
        id, server_id, name, description, input_schema, output_schema,
        examples, tags, category, complexity, reliability, avg_latency
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const insertMany = this.db.transaction((tools) => {
            for (const tool of tools) {
                insertStmt.run(tool.id, tool.server_id, tool.name, tool.description, tool.input_schema, tool.output_schema, tool.examples, tool.tags, tool.category, tool.complexity, tool.reliability, tool.avg_latency);
            }
        });
        insertMany(server.tools.map(tool => ({
            id: tool.id,
            server_id: server.id,
            name: tool.name,
            description: tool.description,
            input_schema: JSON.stringify(tool.inputSchema),
            output_schema: tool.outputSchema ? JSON.stringify(tool.outputSchema) : null,
            examples: JSON.stringify(tool.examples),
            tags: JSON.stringify(tool.tags),
            category: tool.category || null,
            complexity: tool.complexity,
            reliability: tool.reliability,
            avg_latency: tool.avgLatency,
        })));
        // Generate embeddings for tools
        for (const tool of server.tools) {
            await this.generateToolEmbedding(tool);
        }
        this.cache.delete(`server:${server.id}`);
    }
    /**
     * Generate embedding for a tool
     */
    async generateToolEmbedding(tool) {
        const embeddingText = `
      Tool: ${tool.name}
      Description: ${tool.description}
      Category: ${tool.category || 'general'}
      Tags: ${tool.tags.join(', ')}
      Complexity: ${tool.complexity}
    `.trim();
        const embedding = await this.embedder.embed(embeddingText);
        this.db.prepare(`
      UPDATE mcp_tools SET embedding = ? WHERE id = ?
    `).run(Buffer.from(new Float32Array(embedding).buffer), tool.id);
    }
    /**
     * Get server metadata by ID or name
     */
    async getServer(idOrName) {
        const cacheKey = `server:${idOrName}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        const row = this.db.prepare(`
      SELECT * FROM mcp_servers
      WHERE id = ? OR name = ?
    `).get(idOrName, idOrName);
        if (!row)
            return null;
        const toolIds = JSON.parse(row.tools);
        const tools = await this.getToolsByIds(toolIds);
        const server = {
            id: row.id,
            name: row.name,
            version: row.version,
            description: row.description,
            capabilities: JSON.parse(row.capabilities),
            tools,
            added: row.added,
            lastUpdated: row.last_updated,
            status: row.status,
        };
        this.cache.set(cacheKey, server);
        return server;
    }
    /**
     * Get tools by IDs
     */
    async getToolsByIds(ids) {
        if (ids.length === 0)
            return [];
        const placeholders = ids.map(() => '?').join(',');
        const rows = this.db.prepare(`
      SELECT * FROM mcp_tools WHERE id IN (${placeholders})
    `).all(...ids);
        return rows.map((row) => this.rowToTool(row));
    }
    /**
     * Search for tools using semantic search
     */
    async searchTools(query) {
        const queryEmbedding = await this.embedder.embed(query.query);
        // Use HNSW for fast approximate search
        const results = await this.hnswIndex.search(queryEmbedding, query.limit || 10);
        // Get tool metadata for results
        const tools = [];
        for (const result of results) {
            const tool = await this.getTool(String(result.id));
            if (!tool)
                continue;
            // Apply filters
            if (query.filters && !this.matchesFilters(tool, query.filters)) {
                continue;
            }
            tools.push({
                item: tool,
                score: result.similarity,
                reason: this.generateSearchReason(tool, query.query, result.similarity),
            });
        }
        return tools;
    }
    /**
     * Get tool by ID
     */
    async getTool(id) {
        const cacheKey = `tool:${id}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        const row = this.db.prepare(`
      SELECT * FROM mcp_tools WHERE id = ?
    `).get(id);
        if (!row)
            return null;
        const tool = this.rowToTool(row);
        this.cache.set(cacheKey, tool);
        return tool;
    }
    /**
     * Store generation template
     */
    async storeTemplate(template) {
        const embedding = await this.embedder.embed(`${template.name}: ${template.description}. Template for ${template.toolIds.join(', ')}`);
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO generation_templates (
        id, name, description, version, server_id, tool_ids,
        template, variables, created, last_used, use_count,
        success_rate, embedding
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(template.id, template.name, template.description, template.version, template.serverId, JSON.stringify(template.toolIds), template.template, JSON.stringify(template.variables), template.created, template.lastUsed, template.useCount, template.successRate, Buffer.from(new Float32Array(embedding).buffer));
        this.cache.delete(`template:${template.id}`);
    }
    /**
     * Get template by ID
     */
    async getTemplate(id) {
        const cacheKey = `template:${id}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        const row = this.db.prepare(`
      SELECT * FROM generation_templates WHERE id = ?
    `).get(id);
        if (!row)
            return null;
        const template = {
            id: row.id,
            name: row.name,
            description: row.description,
            version: row.version,
            serverId: row.server_id,
            toolIds: JSON.parse(row.tool_ids),
            template: row.template,
            variables: JSON.parse(row.variables),
            created: row.created,
            lastUsed: row.last_used,
            useCount: row.use_count,
            successRate: row.success_rate,
        };
        this.cache.set(cacheKey, template);
        return template;
    }
    /**
     * Search templates
     */
    async searchTemplates(query, limit = 10) {
        const queryEmbedding = await this.embedder.embed(query);
        const rows = this.db.prepare(`
      SELECT * FROM generation_templates
      ORDER BY success_rate DESC, use_count DESC
      LIMIT ?
    `).all(limit * 2); // Get more for filtering
        const results = [];
        for (const row of rows) {
            if (!row.embedding)
                continue;
            const template = {
                id: row.id,
                name: row.name,
                description: row.description,
                version: row.version,
                serverId: row.server_id,
                toolIds: JSON.parse(row.tool_ids),
                template: row.template,
                variables: JSON.parse(row.variables),
                created: row.created,
                lastUsed: row.last_used,
                useCount: row.use_count,
                successRate: row.success_rate,
            };
            // Calculate similarity
            const templateEmbedding = new Float32Array(row.embedding.buffer);
            const similarity = this.cosineSimilarity(Array.from(queryEmbedding), Array.from(templateEmbedding));
            results.push({
                item: template,
                score: similarity,
                reason: `${(similarity * 100).toFixed(1)}% match. Success rate: ${template.successRate.toFixed(1)}%`,
            });
        }
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    /**
     * Store wrapper version
     */
    async storeWrapperVersion(version) {
        const stmt = this.db.prepare(`
      INSERT INTO wrapper_versions (
        id, server_id, version, code, metadata, created,
        deprecated, deprecation_reason
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        stmt.run(version.id, version.serverId, version.version, version.code, JSON.stringify(version.metadata), version.created, version.deprecated ? 1 : 0, version.deprecationReason || null);
    }
    /**
     * Get wrapper versions for a server
     */
    async getWrapperVersions(serverId) {
        const rows = this.db.prepare(`
      SELECT * FROM wrapper_versions
      WHERE server_id = ?
      ORDER BY created DESC
    `).all(serverId);
        return rows.map((row) => ({
            id: row.id,
            serverId: row.server_id,
            version: row.version,
            code: row.code,
            metadata: JSON.parse(row.metadata),
            created: row.created,
            deprecated: row.deprecated === 1,
            deprecationReason: row.deprecation_reason || undefined,
        }));
    }
    /**
     * Get latest non-deprecated wrapper version
     */
    async getLatestWrapperVersion(serverId) {
        const row = this.db.prepare(`
      SELECT * FROM wrapper_versions
      WHERE server_id = ? AND deprecated = 0
      ORDER BY created DESC
      LIMIT 1
    `).get(serverId);
        if (!row)
            return null;
        return {
            id: row.id,
            serverId: row.server_id,
            version: row.version,
            code: row.code,
            metadata: JSON.parse(row.metadata),
            created: row.created,
            deprecated: false,
        };
    }
    /**
     * Update template usage
     */
    async updateTemplateUsage(templateId, success) {
        const template = await this.getTemplate(templateId);
        if (!template)
            return;
        const newUseCount = template.useCount + 1;
        const newSuccessRate = success
            ? (template.successRate * template.useCount + 100) / newUseCount
            : (template.successRate * template.useCount) / newUseCount;
        this.db.prepare(`
      UPDATE generation_templates
      SET last_used = ?,
          use_count = ?,
          success_rate = ?
      WHERE id = ?
    `).run(Date.now(), newUseCount, newSuccessRate, templateId);
        this.cache.delete(`template:${templateId}`);
    }
    /**
     * Get all servers
     */
    async getAllServers() {
        const rows = this.db.prepare(`
      SELECT * FROM mcp_servers
      WHERE status = 'active'
      ORDER BY last_updated DESC
    `).all();
        const servers = [];
        for (const row of rows) {
            const toolIds = JSON.parse(row.tools);
            const tools = await this.getToolsByIds(toolIds);
            servers.push({
                id: row.id,
                name: row.name,
                version: row.version,
                description: row.description,
                capabilities: JSON.parse(row.capabilities),
                tools,
                added: row.added,
                lastUpdated: row.last_updated,
                status: row.status,
            });
        }
        return servers;
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    /**
     * Vacuum database to optimize storage
     */
    async vacuum() {
        this.db.exec('VACUUM');
    }
    /**
     * Export memory data
     */
    async exportData(outputPath) {
        const data = {
            servers: this.db.prepare('SELECT * FROM mcp_servers').all(),
            tools: this.db.prepare('SELECT * FROM mcp_tools').all(),
            templates: this.db.prepare('SELECT * FROM generation_templates').all(),
            versions: this.db.prepare('SELECT * FROM wrapper_versions').all(),
            exportedAt: Date.now(),
        };
        const fs = await import('fs/promises');
        await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    }
    // ========== Helper Methods ==========
    rowToTool(row) {
        return {
            id: row.id,
            serverId: row.server_id,
            name: row.name,
            description: row.description,
            inputSchema: JSON.parse(row.input_schema),
            outputSchema: row.output_schema ? JSON.parse(row.output_schema) : undefined,
            examples: JSON.parse(row.examples),
            tags: JSON.parse(row.tags),
            category: row.category || undefined,
            complexity: row.complexity,
            reliability: row.reliability,
            avgLatency: row.avg_latency,
        };
    }
    matchesFilters(tool, filters) {
        for (const filter of filters) {
            const value = tool[filter.field];
            switch (filter.operator) {
                case 'eq':
                    if (value !== filter.value)
                        return false;
                    break;
                case 'ne':
                    if (value === filter.value)
                        return false;
                    break;
                case 'contains':
                    if (typeof value === 'string' && !value.includes(filter.value))
                        return false;
                    if (Array.isArray(value) && !value.includes(filter.value))
                        return false;
                    break;
                case 'in':
                    if (!Array.isArray(filter.value) || !filter.value.includes(value))
                        return false;
                    break;
            }
        }
        return true;
    }
    generateSearchReason(tool, query, score) {
        return `${(score * 100).toFixed(1)}% semantic match for "${query}". Category: ${tool.category || 'general'}`;
    }
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
//# sourceMappingURL=memory.js.map
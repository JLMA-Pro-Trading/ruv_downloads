"use strict";
/**
 * AgentDB Configuration
 *
 * Configuration types and defaults for AgentDB integration
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_AGENTDB_CONFIG = void 0;
exports.mergeConfig = mergeConfig;
/**
 * Default AgentDB configuration
 */
exports.DEFAULT_AGENTDB_CONFIG = {
    vectorDimension: 768,
    indexType: 'hnsw',
    hnswParams: {
        m: 16,
        efConstruction: 200,
        efSearch: 50,
    },
    mcpEnabled: true,
    frontierMemory: {
        causalReasoning: true,
        reflexionMemory: true,
        skillLibrary: true,
        automatedLearning: true,
    },
    storage: {
        path: './data/agentdb',
        inMemory: false,
        autoSaveInterval: 60000, // 1 minute
    },
    performance: {
        maxConcurrency: 10,
        cacheSize: 1000,
        batchEnabled: true,
    },
};
/**
 * Merge user config with defaults
 */
function mergeConfig(userConfig) {
    const config = Object.assign(Object.assign(Object.assign({}, exports.DEFAULT_AGENTDB_CONFIG), userConfig), { frontierMemory: Object.assign(Object.assign({}, exports.DEFAULT_AGENTDB_CONFIG.frontierMemory), userConfig.frontierMemory), storage: Object.assign(Object.assign({}, exports.DEFAULT_AGENTDB_CONFIG.storage), userConfig.storage), performance: Object.assign(Object.assign({}, exports.DEFAULT_AGENTDB_CONFIG.performance), userConfig.performance) });
    if (userConfig.hnswParams) {
        config.hnswParams = Object.assign(Object.assign({}, exports.DEFAULT_AGENTDB_CONFIG.hnswParams), userConfig.hnswParams);
    }
    if (userConfig.ivfParams) {
        config.ivfParams = Object.assign({}, userConfig.ivfParams);
    }
    return config;
}
//# sourceMappingURL=config.js.map
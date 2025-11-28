/**
 * UltraThink MCP Server - Module Exports
 *
 * This file provides programmatic access to the MCP server
 * for testing and integration purposes.
 *
 * @module index
 */
export { server, config, initState } from './server.js';
export { ensureInitialized, getHealthStatus } from './server.js';
export { allTools, swarmTools, agentTools, taskTools, learningTools, memoryTools, healthTools } from './tools.js';
export { handlers } from './handlers.js';
export * from './types.js';
import { server as serverInstance } from './server.js';
export default serverInstance;
//# sourceMappingURL=index.d.ts.map
#!/usr/bin/env node
/**
 * UltraThink MCP Server
 *
 * Standalone Model Context Protocol server with:
 * - Agentic-Flow integration for swarm coordination
 * - AgentDB integration for pattern learning and memory
 * - Modular tool system for extensibility
 * - Health monitoring and metrics
 *
 * Design Philosophy:
 * - MCP tools are called programmatically (not directly by Claude)
 * - Results are loaded into model context as text
 * - Keeps heavy operations OUT of Claude's direct context
 * - Claude gets the RESULTS, not the direct MCP connection
 *
 * @module server
 * @author UltraThink Team
 * @license MIT
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { ServerConfig, HealthStatus } from './types.js';
declare const config: ServerConfig;
interface InitializationState {
    initialized: boolean;
    agenticFlow: boolean;
    agentdb: boolean;
    startTime: Date;
}
declare const initState: InitializationState;
declare function ensureInitialized(): Promise<void>;
declare const server: Server<{
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
            progressToken?: string | number | undefined;
        } | undefined;
    } | undefined;
}, {
    method: string;
    params?: {
        [x: string]: unknown;
        _meta?: {
            [x: string]: unknown;
        } | undefined;
    } | undefined;
}, {
    [x: string]: unknown;
    _meta?: {
        [x: string]: unknown;
    } | undefined;
}>;
declare function getHealthStatus(): Promise<HealthStatus>;
export { server, config, initState };
export { ensureInitialized, getHealthStatus };
export default server;
//# sourceMappingURL=server.d.ts.map
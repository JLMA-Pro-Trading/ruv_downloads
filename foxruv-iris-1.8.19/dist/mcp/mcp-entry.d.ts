#!/usr/bin/env node
/**
 * MCP Server Entry Point
 *
 * This wrapper suppresses stdout BEFORE any imports to ensure clean MCP protocol.
 * The MCP protocol requires stdout to contain ONLY JSON-RPC messages.
 */
declare const originalLog: {
    (...data: any[]): void;
    (message?: any, ...optionalParams: any[]): void;
};
declare function main(): Promise<void>;
//# sourceMappingURL=mcp-entry.d.ts.map
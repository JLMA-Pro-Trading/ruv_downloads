#!/usr/bin/env node
/**
 * CLI Application class
 */
declare class PsychoSymbolicReasonerCLI {
    private program;
    private server?;
    private isShuttingDown;
    constructor();
    /**
     * Setup CLI commands and options
     */
    private setupCommands;
    /**
     * Start the MCP server
     */
    private startServer;
    /**
     * Handle config command
     */
    private handleConfigCommand;
    /**
     * Perform health check
     */
    private healthCheck;
    /**
     * Setup graceful shutdown handling
     */
    private setupGracefulShutdown;
    /**
     * Run the CLI application
     */
    run(argv?: string[]): Promise<void>;
}
export { PsychoSymbolicReasonerCLI };
//# sourceMappingURL=index.d.ts.map
/**
 * MCP Wrapper Generator
 * Universal tool for generating TypeScript wrappers for MCP servers
 *
 * @package ultrathink
 * @standalone Fully standalone implementation with agentic-flow coordination and agentdb tracking
 */
import { GeneratorOptions, GeneratorResult } from './types.js';
export declare class MCPWrapperGenerator {
    private projectRoot;
    private detector;
    private templateGen;
    private writer;
    private tracking;
    constructor(projectRoot?: string);
    /**
     * Generate MCP wrappers
     */
    generate(options?: GeneratorOptions): Promise<GeneratorResult>;
    /**
     * Generate wrapper for a single server
     */
    private generateServerWrapper;
    /**
     * Generate main index file
     */
    private generateIndexFile;
    /**
     * Generate server-specific index
     */
    private generateServerIndex;
    /**
     * Generate server README
     */
    private generateServerReadme;
    /**
     * Generate example usage code
     */
    private generateExampleUsage;
    /**
     * Generate example parameters
     */
    private generateExampleParams;
    /**
     * Create template context
     */
    private createContext;
    /**
     * Finalize result with tracking data
     */
    private finalizeResult;
    /**
     * Create coordination event handler for agentic-flow integration
     */
    private createCoordinationHandler;
    /**
     * Create tracking record handler for agentdb integration
     */
    private createTrackingHandler;
    /**
     * Emit coordination event
     */
    private emitCoordination;
}
/**
 * Generate MCP wrappers (convenience function)
 */
export declare function generateMCPWrappers(options?: GeneratorOptions): Promise<GeneratorResult>;
export * from './types.js';
export { MCPDetector } from './detector.js';
export { TemplateGenerator } from './templates.js';
export { FileWriter } from './writer.js';
//# sourceMappingURL=index.d.ts.map
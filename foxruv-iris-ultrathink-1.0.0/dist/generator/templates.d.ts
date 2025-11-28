/**
 * Code Generation Templates
 * Templates for frontend (fetch) and backend (node) MCP wrappers
 *
 * @package ultrathink
 * @standalone Fully standalone implementation
 */
import { TemplateContext } from './types.js';
export declare class TemplateGenerator {
    /**
     * Generate frontend wrapper (uses fetch API)
     */
    generateFrontendWrapper(context: TemplateContext): string;
    /**
     * Generate backend wrapper (uses Node.js stdio)
     */
    generateBackendWrapper(context: TemplateContext): string;
    /**
     * Generate TypeScript types
     */
    generateTypes(context: TemplateContext): string;
    /**
     * Generate index file
     */
    generateIndex(serverNames: string[]): string;
    /**
     * Generate frontend methods
     */
    private generateFrontendMethods;
    /**
     * Generate backend methods
     */
    private generateBackendMethods;
    /**
     * Generate parameter types
     */
    private generateParamsType;
    /**
     * Generate tool types
     */
    private generateToolTypes;
    /**
     * Convert JSON schema to TypeScript type
     */
    private schemaToType;
    /**
     * Convert server name to class name
     */
    toClassName(name: string): string;
    /**
     * Convert to PascalCase
     */
    private toPascalCase;
    /**
     * Convert to method name (camelCase)
     */
    private toMethodName;
}
//# sourceMappingURL=templates.d.ts.map
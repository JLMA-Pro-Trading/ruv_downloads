/**
 * Enhanced foxruv-agent init with .iris folder and context-aware CLAUDE.md
 */
export interface EnhancedInitOptions {
    createFoxruvFolder?: boolean;
    createContexts?: boolean;
    installDefaultMcps?: boolean;
    enableAgentDB?: boolean;
    enableSupabase?: boolean;
    createGeminiMd?: boolean;
    createClaudeContexts?: boolean;
}
export declare function runEnhancedInit(projectRoot: string, options?: EnhancedInitOptions): Promise<void>;
//# sourceMappingURL=init-enhanced.d.ts.map
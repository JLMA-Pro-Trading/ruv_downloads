/**
 * Execution configuration commands
 *
 * Manage smart defaults for agentic-flow + AgentDB
 */
/**
 * Show current execution configuration
 */
export declare function runConfigShow(): Promise<void>;
/**
 * Interactive configuration wizard
 */
export declare function runConfigWizard(): Promise<void>;
/**
 * Quick toggle commands
 */
export declare function runConfigToggle(setting: 'agentic-flow' | 'agentdb' | 'learning' | 'caching', enable?: boolean): Promise<void>;
/**
 * Reset to defaults
 */
export declare function runConfigReset(): Promise<void>;
/**
 * Set swarm topology
 */
export declare function runConfigTopology(topology: 'mesh' | 'hierarchical' | 'ring' | 'star'): Promise<void>;
//# sourceMappingURL=execution-config.d.ts.map
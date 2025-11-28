/**
 * Command Interceptor
 *
 * Automatically wraps all CLI commands with agentic-flow + AgentDB
 * Based on .iris/config/settings.json preferences
 */
/**
 * Intercept and execute command with smart defaults
 */
export declare function interceptCommand(commandName: string, commandFn: (...args: any[]) => Promise<any>, ...args: any[]): Promise<any>;
/**
 * Decorator for auto-intercepting commands
 */
export declare function withSmartDefaults(commandFn: (...args: any[]) => Promise<any>): (...args: any[]) => Promise<any>;
/**
 * Check if smart execution is enabled
 */
export declare function isSmartExecutionEnabled(): Promise<boolean>;
/**
 * Display smart execution banner
 */
export declare function showSmartExecutionBanner(): Promise<void>;
//# sourceMappingURL=interceptor.d.ts.map
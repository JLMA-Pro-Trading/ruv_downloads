/**
 * Nova Medicina - Comprehensive CLI Help System
 *
 * Provides detailed help, examples, warnings, and interactive guidance
 * for the nova-medicina emergency medical analysis CLI.
 */
/**
 * Main help display
 */
export declare function showMainHelp(): void;
/**
 * Analyze command help
 */
export declare function showAnalyzeHelp(): void;
/**
 * Verify command help
 */
export declare function showVerifyHelp(): void;
/**
 * Provider command help
 */
export declare function showProviderHelp(): void;
/**
 * Config command help
 */
export declare function showConfigHelp(): void;
/**
 * Command suggestion for typos
 */
export declare function suggestCommand(input: string): string | null;
/**
 * Interactive tutorial mode
 */
export declare function runTutorial(): Promise<void>;
/**
 * Show context-sensitive help based on partial command
 */
export declare function showContextHelp(context: string[]): void;
/**
 * Display provider contact information
 */
export declare function showProviderContacts(providers: any[]): void;
/**
 * Export help system functions
 */
export declare const helpSystem: {
    showMainHelp: typeof showMainHelp;
    showAnalyzeHelp: typeof showAnalyzeHelp;
    showVerifyHelp: typeof showVerifyHelp;
    showProviderHelp: typeof showProviderHelp;
    showConfigHelp: typeof showConfigHelp;
    suggestCommand: typeof suggestCommand;
    runTutorial: typeof runTutorial;
    showContextHelp: typeof showContextHelp;
    showProviderContacts: typeof showProviderContacts;
    LOGO: string;
    SAFETY_WARNING: string;
};
export default helpSystem;
//# sourceMappingURL=help-system.d.ts.map
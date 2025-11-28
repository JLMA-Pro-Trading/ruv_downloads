import { DiscoveredExpert } from './code-scanner.js';
export interface InteractiveOptions {
    autoApprove?: boolean;
    dryRun?: boolean;
    verbose?: boolean;
}
export interface CodeChange {
    filePath: string;
    expertId: string;
    expertName: string;
    before: string;
    after: string;
    linesAdded: number;
    linesModified: number;
}
export interface InstrumentationDecision {
    approved: boolean;
    selectedExperts: string[];
    showChangesFirst: boolean;
}
export declare class InteractiveCLI {
    private options;
    private progressBar;
    constructor(options?: InteractiveOptions);
    /**
     * Present discovered experts with summary statistics
     */
    presentDiscoveries(discoveries: DiscoveredExpert[]): Promise<void>;
    /**
     * Ask user for instrumentation approval
     */
    askInstrumentationApproval(experts: DiscoveredExpert[]): Promise<InstrumentationDecision>;
    /**
     * Show code changes with diff view
     */
    showCodeChanges(changes: CodeChange[]): Promise<boolean>;
    /**
     * Confirm instrumentation before applying
     */
    confirmInstrumentation(): Promise<boolean>;
    /**
     * Show progress indicator
     */
    showProgress(message: string, current: number, total: number): Promise<void>;
    /**
     * Show a simple spinner for indeterminate progress
     */
    showSpinner(message: string): () => void;
    /**
     * Display success message
     */
    success(message: string): void;
    /**
     * Display error message
     */
    error(message: string, error?: Error): void;
    /**
     * Display warning message
     */
    warning(message: string): void;
    /**
     * Display info message
     */
    info(message: string): void;
    /**
     * Display final summary
     */
    displaySummary(summary: {
        totalScanned: number;
        totalInstrumented: number;
        filesModified: number;
        errors: number;
        skipped: number;
    }): void;
}
/**
 * Helper function to create a simple progress indicator
 */
export declare function createProgressIndicator(total: number, message?: string): {
    update: (current: number) => void;
    stop: () => void;
};
//# sourceMappingURL=interactive-cli.d.ts.map
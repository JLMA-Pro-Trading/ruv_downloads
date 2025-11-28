/**
 * Code Instrumentation Engine
 *
 * Automatically adds webhook-based telemetry to expert classes by:
 * - Adding a simple fetch-based telemetry helper function
 * - Wrapping prediction methods with telemetry logging
 * - Sending telemetry data to hardcoded Iris backend
 *
 * Uses TypeScript AST parsing for safe code modifications.
 * Zero configuration required - auto-detects projectId from package.json.
 */
import * as ts from 'typescript';
export interface InstrumentationOptions {
    /** Preserve existing comments in the code */
    preserveComments?: boolean;
    /** Add try-catch error handling around telemetry calls */
    addErrorHandling?: boolean;
    /** Telemetry failures don't crash the application (default: true) */
    nonBlocking?: boolean;
    /** Skip files that already have telemetry */
    skipIfInstrumented?: boolean;
    /** Custom telemetry import path */
    telemetryImportPath?: string;
}
export interface CodeChange {
    filePath: string;
    type: 'import_added' | 'method_wrapped' | 'constructor_modified' | 'method_added';
    lineNumber: number;
    before: string;
    after: string;
    description: string;
}
export interface DiscoveredExpert {
    name: string;
    version?: string;
    filePath: string;
    className?: string;
    predictionMethods?: string[];
}
/**
 * Code Instrumentation Engine for Expert Classes
 */
export declare class CodeInstrumenter {
    private options;
    constructor(options?: InstrumentationOptions);
    /**
     * Main entry point: Instrument an expert class file
     */
    instrumentExpert(expert: DiscoveredExpert, options?: InstrumentationOptions): Promise<CodeChange[]>;
    /**
     * Add telemetry helper function to the file (no imports needed)
     */
    addImports(filePath: string, sourceFile?: ts.SourceFile, sourceCode?: string): Promise<CodeChange | null>;
    /**
     * Modify constructor (no longer needed for HTTP-based telemetry)
     */
    modifyConstructor(_filePath: string, _classNode: ts.ClassDeclaration, _sourceCode: string): Promise<CodeChange[]>;
    /**
     * Wrap a prediction method with telemetry logging
     */
    wrapMethod(filePath: string, methodName: string, expert: DiscoveredExpert, classNode?: ts.ClassDeclaration, sourceCode?: string): Promise<CodeChange | null>;
    /**
     * Apply all code changes to the file system
     */
    applyChanges(changes: CodeChange[]): Promise<void>;
    /**
     * Generate a unified diff of changes
     */
    generateDiff(changes: CodeChange[]): Promise<string>;
    private isAlreadyInstrumented;
    private findExpertClass;
    private findPredictionMethods;
    /**
     * Generate webhook-based telemetry helper function
     * Zero configuration - hardcoded backend URL, auto-detects projectId
     */
    private generateTelemetryHelper;
    private generateWrappedMethod;
    private applyChangesToFile;
    private insertAfterImports;
    private insertAtLine;
}
/**
 * Convenience function to instrument a single expert
 */
export declare function instrumentExpert(expert: DiscoveredExpert, options?: InstrumentationOptions): Promise<CodeChange[]>;
/**
 * Convenience function to instrument multiple experts in batch
 */
export declare function instrumentExperts(experts: DiscoveredExpert[], options?: InstrumentationOptions): Promise<Map<string, CodeChange[]>>;
//# sourceMappingURL=instrumenter.d.ts.map
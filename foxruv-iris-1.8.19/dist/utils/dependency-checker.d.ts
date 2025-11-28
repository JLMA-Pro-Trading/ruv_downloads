/**
 * Dependency Checker
 *
 * Runtime detection of optional dependencies (ax-llm, dspy, agentdb, etc.)
 *
 * @module utils/dependency-checker
 * @version 1.0.0
 */
/**
 * Check if a Node.js package is available
 */
export declare function checkNodeDependency(packageName: string): Promise<boolean>;
/**
 * Check if a Python package is available
 * Checks .venv first, then falls back to system python
 */
export declare function checkPythonDependency(packageName: string): Promise<boolean>;
/**
 * Generic dependency check
 */
export declare function checkDependency(runtime: 'node' | 'python', packageName: string): Promise<boolean>;
/**
 * Detect all available dependencies for Iris
 */
export declare function detectAvailableDependencies(): Promise<{
    agentdb: boolean;
    agenticFlow: boolean;
    dspy: boolean;
    ax: boolean;
}>;
/**
 * Print dependency status to console
 */
export declare function printDependencyStatus(): Promise<void>;
//# sourceMappingURL=dependency-checker.d.ts.map
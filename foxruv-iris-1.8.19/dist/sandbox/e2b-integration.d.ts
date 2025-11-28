/**
 * E2B Sandbox Integration
 * Wraps @foxruv/e2b-runner for testing prompt variants in isolated environments
 */
/**
 * Configuration options for E2B Sandbox Manager
 */
export interface E2BSandboxConfig {
    /** E2B API key (defaults to process.env.E2B_API_KEY) */
    apiKey?: string;
    /** Maximum number of concurrent sandboxes */
    maxConcurrency?: number;
    /** Enable streaming output from sandboxes */
    enableStreaming?: boolean;
    /** AgentDB configuration */
    agentdb?: {
        enabled: boolean;
        cacheTTL?: number;
    };
    /** Timeout for sandbox operations in milliseconds */
    timeout?: number;
}
/**
 * Test configuration for prompt variant testing
 */
export interface PromptVariantTest {
    /** Expert ID whose prompt is being tested */
    expertId: string;
    /** Prompt version identifier */
    version: string;
    /** Context for the test */
    context: Record<string, any>;
    /** Expected output (optional, for validation) */
    expectedOutput?: any;
    /** Test metadata */
    metadata?: Record<string, any>;
}
/**
 * Result from a sandbox test execution
 */
export interface SandboxTestResult {
    /** Whether the test was successful */
    success: boolean;
    /** Output from the sandbox execution */
    output: any;
    /** Error message if test failed */
    error?: string;
    /** Execution time in milliseconds */
    executionTime: number;
    /** Resource usage metrics */
    metrics?: {
        confidence?: number;
        executionTime?: number;
        memoryUsage?: number;
        cpuTime?: number;
        networkCalls?: number;
    };
    /** Telemetry ID for tracking */
    telemetryId?: string;
}
/**
 * Batch test request
 */
export interface BatchTestRequest {
    tests: PromptVariantTest[];
    /** Run tests in parallel (default: true) */
    parallel?: boolean;
    /** Stop on first failure (default: false) */
    stopOnFailure?: boolean;
}
/**
 * Batch test results
 */
export interface BatchTestResults {
    /** Total number of tests */
    total: number;
    /** Number of successful tests */
    successful: number;
    /** Number of failed tests */
    failed: number;
    /** Individual test results */
    results: SandboxTestResult[];
    /** Total execution time in milliseconds */
    totalTime: number;
}
/**
 * E2B Sandbox Manager
 * Manages E2B sandboxes for testing prompt variants and logging telemetry
 */
export declare class E2BSandboxManager {
    private runner;
    private config;
    /**
     * Create a new E2B Sandbox Manager
     */
    constructor(config?: E2BSandboxConfig);
    /**
     * Test a prompt variant in an isolated E2B sandbox
     */
    testPromptVariant(expertId: string, version: string, context: Record<string, any>): Promise<SandboxTestResult>;
    /**
     * Run multiple tests in parallel
     */
    runBatch(batchRequest: BatchTestRequest): Promise<BatchTestResults>;
    /**
     * Get sandbox runner instance for advanced usage
     */
    getRunner(): any;
    /**
     * Cleanup and close all active sandboxes
     */
    cleanup(): Promise<void>;
}
/**
 * Factory function to create an E2B Sandbox Manager
 */
export declare function createE2BSandboxManager(config?: E2BSandboxConfig): E2BSandboxManager;
/**
 * Get or create the default E2B Sandbox Manager instance
 */
export declare function getDefaultE2BSandboxManager(config?: E2BSandboxConfig): E2BSandboxManager;
/**
 * Reset the default instance (useful for testing)
 */
export declare function resetDefaultInstance(): void;
//# sourceMappingURL=e2b-integration.d.ts.map
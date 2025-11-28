/**
 * E2B Sandbox Integration
 * Wraps @foxruv/e2b-runner for testing prompt variants in isolated environments
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Optional dependency - only import if available
let createE2BRunner;
try {
    const e2bModule = require('@foxruv/e2b-runner');
    createE2BRunner = e2bModule.createE2BRunner;
    // Types are available at runtime if module is installed
}
catch (error) {
    // Module not available - functions will check for this
    createE2BRunner = null;
}
import { getSupabase, getProjectId, getTenantId } from '../supabase/client.js';
import { saveReflexion } from '../supabase/reflexions.js';
/**
 * Simple agent adapter for prompt variant testing
 */
class PromptVariantAgent {
    role;
    promptText;
    constructor(role, promptText) {
        this.role = role;
        this.promptText = promptText;
    }
    async analyze(context) {
        // The E2B runner will execute this in a sandbox
        // For now, return the context and prompt for testing
        return {
            agent: this.role,
            role: this.role,
            timestamp: new Date(),
            analysis: `Prompt: ${this.promptText}\nContext: ${JSON.stringify(context)}`,
            keyFindings: ['Prompt variant test executed'],
            confidence: 0.8,
            supportingEvidence: [context],
            citations: [],
            executionTime: 0,
        };
    }
    getMetadata() {
        return {
            role: this.role,
            systemPrompt: this.promptText,
            model: 'claude-3-5-sonnet-20241022',
        };
    }
}
/**
 * E2B Sandbox Manager
 * Manages E2B sandboxes for testing prompt variants and logging telemetry
 */
export class E2BSandboxManager {
    runner;
    config;
    /**
     * Create a new E2B Sandbox Manager
     */
    constructor(config) {
        this.config = {
            apiKey: config?.apiKey || process.env.E2B_API_KEY,
            maxConcurrency: config?.maxConcurrency || 10,
            enableStreaming: config?.enableStreaming ?? true,
            timeout: config?.timeout || 60000, // 60 seconds default
            agentdb: {
                enabled: config?.agentdb?.enabled ?? true,
                cacheTTL: config?.agentdb?.cacheTTL || 3600,
            },
        };
        if (!this.config.apiKey) {
            throw new Error('E2B_API_KEY is required. Set it in environment or pass via config.');
        }
        if (!createE2BRunner) {
            throw new Error('@foxruv/e2b-runner is not installed. Install it to use E2BSandboxManager.');
        }
        this.runner = createE2BRunner({
            apiKey: this.config.apiKey,
            maxConcurrency: this.config.maxConcurrency,
            enableStreaming: this.config.enableStreaming,
            agentdb: this.config.agentdb,
        });
    }
    /**
     * Test a prompt variant in an isolated E2B sandbox
     */
    async testPromptVariant(expertId, version, context) {
        const startTime = Date.now();
        const supabase = getSupabase();
        const project = getProjectId();
        const tenantId = getTenantId();
        try {
            // Log test start to telemetry
            const { data: telemetryData, error: telemetryError } = await supabase
                .from('consensus_telemetry')
                .insert({
                tenant_id: tenantId,
                project,
                expert_id: expertId,
                event_type: 'sandbox_test_start',
                event_data: {
                    version,
                    context,
                    timestamp: new Date().toISOString(),
                },
            })
                .select()
                .single();
            if (telemetryError) {
                console.warn('Failed to log telemetry start:', telemetryError.message);
            }
            // Create a prompt variant agent
            const agent = new PromptVariantAgent(`expert-${expertId}`, context.prompt || 'Test prompt');
            // Execute in E2B sandbox
            const analysisContext = {
                sample: context.sample || {},
                clinical: context.clinical || {},
                episodic: context.episodic || [],
                claim: context.claim || {},
                options: context.options || {},
                literature: context.literature || {},
                domainKnowledge: context.domainKnowledge || {},
            };
            const result = await this.runner.run(agent, analysisContext);
            const executionTime = Date.now() - startTime;
            const success = result.confidence > 0.5;
            // Log test completion to telemetry
            const { error: telemetryEndError } = await supabase
                .from('consensus_telemetry')
                .insert({
                tenant_id: tenantId,
                project,
                expert_id: expertId,
                event_type: 'sandbox_test_complete',
                event_data: {
                    version,
                    success,
                    executionTime,
                    analysis: result.analysis,
                    confidence: result.confidence,
                    keyFindings: result.keyFindings,
                    timestamp: new Date().toISOString(),
                },
            });
            if (telemetryEndError) {
                console.warn('Failed to log telemetry end:', telemetryEndError.message);
            }
            // Save reflexion for learning
            try {
                await saveReflexion('sandbox_test', {
                    expertId,
                    version,
                    context,
                }, {
                    output: result.analysis,
                    executionTime,
                    confidence: result.confidence,
                }, success, {
                    expertId,
                    confidence: success ? 0.9 : 0.3,
                    impactScore: success ? 0.8 : 0.2,
                });
            }
            catch (reflexionError) {
                console.warn('Failed to save reflexion:', reflexionError);
            }
            return {
                success,
                output: result.analysis,
                executionTime,
                metrics: {
                    confidence: result.confidence,
                    executionTime: result.executionTime,
                },
                telemetryId: telemetryData?.id,
            };
        }
        catch (error) {
            const executionTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            // Log error to telemetry
            await supabase.from('consensus_telemetry').insert({
                tenant_id: tenantId,
                project,
                expert_id: expertId,
                event_type: 'sandbox_test_error',
                event_data: {
                    version,
                    error: errorMessage,
                    executionTime,
                    timestamp: new Date().toISOString(),
                },
            });
            // Save failed reflexion
            try {
                await saveReflexion('sandbox_test', {
                    expertId,
                    version,
                    context,
                }, {
                    error: errorMessage,
                    executionTime,
                }, false, {
                    expertId,
                    confidence: 0.1,
                    impactScore: 0.1,
                });
            }
            catch (reflexionError) {
                console.warn('Failed to save reflexion:', reflexionError);
            }
            return {
                success: false,
                output: null,
                error: errorMessage,
                executionTime,
            };
        }
    }
    /**
     * Run multiple tests in parallel
     */
    async runBatch(batchRequest) {
        const { tests, parallel = true, stopOnFailure = false } = batchRequest;
        const startTime = Date.now();
        const results = [];
        if (parallel) {
            // Execute all tests in parallel
            const promises = tests.map((test) => this.testPromptVariant(test.expertId, test.version, test.context));
            if (stopOnFailure) {
                // Execute sequentially but stop on first failure
                for (const promise of promises) {
                    const result = await promise;
                    results.push(result);
                    if (!result.success) {
                        break;
                    }
                }
            }
            else {
                // Execute all in parallel
                const batchResults = await Promise.allSettled(promises);
                for (const settledResult of batchResults) {
                    if (settledResult.status === 'fulfilled') {
                        results.push(settledResult.value);
                    }
                    else {
                        results.push({
                            success: false,
                            output: null,
                            error: settledResult.reason?.message || 'Unknown error',
                            executionTime: 0,
                        });
                    }
                }
            }
        }
        else {
            // Execute sequentially
            for (const test of tests) {
                const result = await this.testPromptVariant(test.expertId, test.version, test.context);
                results.push(result);
                if (stopOnFailure && !result.success) {
                    break;
                }
            }
        }
        const totalTime = Date.now() - startTime;
        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;
        // Log batch completion
        const supabase = getSupabase();
        const project = getProjectId();
        const tenantId = getTenantId();
        await supabase.from('consensus_telemetry').insert({
            tenant_id: tenantId,
            project,
            event_type: 'sandbox_batch_complete',
            event_data: {
                total: tests.length,
                successful,
                failed,
                totalTime,
                parallel,
                stopOnFailure,
                timestamp: new Date().toISOString(),
            },
        });
        return {
            total: tests.length,
            successful,
            failed,
            results,
            totalTime,
        };
    }
    /**
     * Get sandbox runner instance for advanced usage
     */
    getRunner() {
        return this.runner;
    }
    /**
     * Cleanup and close all active sandboxes
     */
    async cleanup() {
        if (this.runner && typeof this.runner.cleanup === 'function') {
            await this.runner.cleanup();
        }
    }
}
/**
 * Factory function to create an E2B Sandbox Manager
 */
export function createE2BSandboxManager(config) {
    return new E2BSandboxManager(config);
}
/**
 * Singleton instance (optional convenience export)
 */
let defaultInstance = null;
/**
 * Get or create the default E2B Sandbox Manager instance
 */
export function getDefaultE2BSandboxManager(config) {
    if (!defaultInstance) {
        defaultInstance = new E2BSandboxManager(config);
    }
    return defaultInstance;
}
/**
 * Reset the default instance (useful for testing)
 */
export function resetDefaultInstance() {
    defaultInstance = null;
}

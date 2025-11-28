/**
 * LOCAL TELEMETRY - Direct AgentDB Writer
 * Bypasses import issues, writes directly to AgentDB
 * WORKS WITH LOCAL-ONLY MODE (No Supabase required)
 */
interface TelemetryEvent {
    expertId: string;
    version?: string;
    runId?: string;
    confidence?: number;
    latencyMs?: number;
    outcome?: 'success' | 'failure';
    metadata?: Record<string, any>;
}
/**
 * Log telemetry directly to AgentDB (bypasses all imports)
 */
export declare function logTelemetryLocal(event: TelemetryEvent): Promise<void>;
/**
 * Decorator to automatically log telemetry for async functions
 */
export declare function withTelemetry(expertId: string, version?: string): (_target: any, propertyKey: string, descriptor: PropertyDescriptor) => PropertyDescriptor;
export {};
//# sourceMappingURL=iris-telemetry-local.d.ts.map
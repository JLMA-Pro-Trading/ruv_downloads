/**
 * Analytics and time-series data helpers
 * Provides trend analysis and visualization data for dashboards
 */
/**
 * Get health trends over time for a project
 * Returns time-series data for health score chart
 */
export declare function getHealthTrends(projectId: string, hours?: number): Promise<Array<{
    time: string;
    healthScore: number;
}>>;
/**
 * Get success rate trends over time
 * Returns time-series data for success rate chart
 */
export declare function getSuccessRateTrends(projectId: string, hours?: number): Promise<Array<{
    time: string;
    successRate: number;
}>>;
/**
 * Get latency trends over time
 * Returns time-series data for latency chart
 */
export declare function getLatencyTrends(projectId: string, hours?: number): Promise<Array<{
    time: string;
    avgLatency: number;
}>>;
/**
 * Get reflexion impact statistics
 * Returns reflexion usage and impact metrics
 */
export declare function getReflexionImpactStats(projectId: string): Promise<Array<{
    category: string;
    count: number;
    avg_impact: number;
}>>;
/**
 * Get token consumption trends over time
 * Returns time-series data for token usage chart
 */
export declare function getTokenConsumptionTrends(projectId: string, hours?: number): Promise<Array<{
    time: string;
    totalTokens: number;
    tokensIn: number;
    tokensOut: number;
    cost: number;
}>>;
/**
 * Get error distribution by type
 * Returns error categories and their frequencies
 */
export declare function getErrorDistribution(projectId: string, hours?: number): Promise<Array<{
    errorType: string;
    count: number;
    percentage: number;
}>>;
//# sourceMappingURL=analytics.d.ts.map
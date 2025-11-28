/**
 * Telemetry Aggregator
 *
 * Aggregates telemetry from GlobalMetrics into CouncilTelemetryInput format
 *
 * @module council/utils/telemetry-aggregator
 */
import type { CouncilTelemetryInput } from '../types/index.js';
import { GlobalMetricsCollector } from '../../telemetry/global-metrics.js';
import { PatternDiscovery } from '../../patterns/pattern-discovery.js';
/**
 * Aggregate telemetry for council analysis
 */
export declare function aggregateTelemetryForCouncil(projects: string[], timeWindow: {
    start: Date;
    end: Date;
}, metricsCollector: GlobalMetricsCollector, patternDiscovery?: PatternDiscovery): Promise<CouncilTelemetryInput>;
//# sourceMappingURL=telemetry-aggregator.d.ts.map
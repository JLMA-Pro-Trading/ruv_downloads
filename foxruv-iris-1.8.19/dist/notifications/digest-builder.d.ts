/**
 * Daily Digest Builder for IRIS
 *
 * Builds comprehensive daily summaries from IRIS evaluations
 * and formats them for WhatsApp delivery.
 *
 * @module digest-builder
 * @version 1.0.0
 */
import { type IrisPrime, type CrossProjectReport } from '../orchestrators/iris-prime.js';
import type { DailyDigest } from './types.js';
import type { IrisReport } from '../orchestrators/iris-prime.js';
/**
 * Build daily digest from IRIS evaluations
 *
 * @param projects - Optional list of project IDs to include
 * @param iris - Optional IRIS instance to reuse (avoids creating new instance)
 * @param crossReport - Optional pre-computed cross-project report (avoids re-evaluation)
 * @param reportCache - Optional cache of individual project reports (avoids re-evaluation)
 */
export declare function buildDailyDigest(projects?: string[], iris?: IrisPrime, crossReport?: CrossProjectReport, reportCache?: Map<string, IrisReport>): Promise<DailyDigest>;
/**
 * Format daily digest for WhatsApp
 */
export declare function formatDailyDigest(digest: DailyDigest): string;
/**
 * Format project status for WhatsApp
 */
export declare function formatProjectStatus(projectName: string, report: IrisReport): string;
/**
 * Format drift summary for WhatsApp
 */
export declare function formatDriftSummary(reports: IrisReport[]): string;
/**
 * Format pattern suggestions for WhatsApp
 */
export declare function formatPatternsSummary(patterns: any[]): string;
/**
 * Format multi-project status for WhatsApp
 */
export declare function formatMultiProjectStatus(reports: IrisReport[]): string;
//# sourceMappingURL=digest-builder.d.ts.map
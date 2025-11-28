/**
 * Reflexion bank utilities for storing and retrieving reasoning patterns
 */
import { ReflexionEntry } from './types.js';
/**
 * Save a reflexion (reasoning pattern) to the bank
 */
export declare function saveReflexion(reflexionType: string, context: Record<string, any>, outcome: Record<string, any>, success: boolean, options?: {
    expertId?: string;
    embedding?: number[];
    confidence?: number;
    impactScore?: number;
}): Promise<ReflexionEntry>;
/**
 * Find similar reflexions using vector similarity search
 */
export declare function findSimilarReflexions(_embedding: number[], options?: {
    reflexionType?: string;
    expertId?: string;
    successOnly?: boolean;
    limit?: number;
    minImpactScore?: number;
}): Promise<ReflexionEntry[]>;
/**
 * Get successful reflexions by type
 */
export declare function getSuccessfulReflexions(reflexionType: string, options?: {
    expertId?: string;
    minImpactScore?: number;
    limit?: number;
}): Promise<ReflexionEntry[]>;
/**
 * Mark a reflexion as reused (increments reuse_count)
 */
export declare function markReflexionReused(reflexionId: string): Promise<void>;
/**
 * Get reflexion statistics by type
 */
export declare function getReflexionStats(reflexionType?: string): Promise<{
    total: number;
    successRate: number;
    avgImpactScore: number;
    totalReuses: number;
    topReflexions: ReflexionEntry[];
}>;
//# sourceMappingURL=reflexions.d.ts.map
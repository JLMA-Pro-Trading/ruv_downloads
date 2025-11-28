/**
 * Generic Training Dataset Utilities
 *
 * Provides time-aware data splitting and leak-safe training utilities
 * applicable to any domain with temporal data (NFL, medical, financial, etc.)
 */
export interface TemporalExample {
    /** Timestamp or temporal ordering key (e.g., season * 1000 + week, or epoch timestamp) */
    temporal_key: number;
    /** Arbitrary data payload for the example */
    data: Record<string, any>;
}
export interface DatasetSplit<T = TemporalExample> {
    training: T[];
    validation: T[];
    metadata: {
        total_examples: number;
        training_size: number;
        validation_size: number;
        split_ratio: number;
        temporal_leakage_detected?: boolean;
        split_strategy?: string;
        [key: string]: any;
    };
}
export type SplitStrategy = 'random' | 'temporal' | 'rolling-window';
export interface TemporalSplitConfig {
    strategy: SplitStrategy;
    /** For random splits: train/validation ratio */
    splitRatio?: number;
    /** For temporal splits: train through this timestamp/key */
    trainThroughKey?: number;
    /** For rolling window: number of future keys to validate on */
    validationWindow?: number;
    /** Optional: minimum number of training examples */
    minTrainExamples?: number;
    /** Optional: minimum number of validation examples */
    minValidationExamples?: number;
    /** Optional: window size for rolling splits */
    windowSize?: number;
    /** Ensure no temporal leakage (default: true) */
    ensureNoLeakage?: boolean;
}
/**
 * Generic dataset builder with temporal-aware splitting
 */
export declare class DatasetBuilder<T extends TemporalExample = TemporalExample> {
    /**
     * Random shuffle (for non-temporal splits)
     */
    shuffleArray<U>(array: U[]): U[];
    /**
     * Sample from array
     */
    sampleArray<U>(array: U[], size: number): U[];
    /**
     * Build simple random split (NOT recommended for time-series)
     */
    buildRandomSplit(examples: T[], splitRatio?: number): DatasetSplit<T>;
    /**
     * Build temporal split (train on past, validate on future)
     * RECOMMENDED for time-series data
     */
    buildTemporalSplit(examples: T[], config: TemporalSplitConfig): DatasetSplit<T>;
    /**
     * Split by timestamp/key (train before cutoff, validate after)
     */
    private splitByTimestamp;
    /**
     * Split by rolling window (train through N, validate N+1 to N+k)
     */
    private splitByRollingWindow;
    /**
     * Detect temporal leakage: check if any validation data precedes training data
     */
    detectTemporalLeakage(training: T[], validation: T[]): boolean;
    /**
     * Calculate temporal statistics for a split
     */
    calculateTemporalStats(examples: T[]): {
        range: string;
        minKey: number;
        maxKey: number;
    };
}
/**
 * Balance dataset by outcome (equal correct/incorrect examples)
 */
export declare function balanceByOutcome<T extends TemporalExample>(examples: T[], outcomeKey?: string): T[];
/**
 * Balance dataset by categorical field
 */
export declare function balanceByCategory<T extends TemporalExample>(examples: T[], categoryKey: string): T[];
/**
 * Export dataset to JSONL format (one example per line)
 */
export declare function exportToJSONL<T>(examples: T[], outputPath: string): void;
/**
 * Export full dataset split to separate JSONL files
 */
export declare function exportSplitToJSONL<T>(split: DatasetSplit<T>, outputDir: string, prefix?: string): void;
//# sourceMappingURL=dataset-core.d.ts.map
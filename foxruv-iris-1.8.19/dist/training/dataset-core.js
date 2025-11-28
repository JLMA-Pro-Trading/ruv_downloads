/**
 * Generic Training Dataset Utilities
 *
 * Provides time-aware data splitting and leak-safe training utilities
 * applicable to any domain with temporal data (NFL, medical, financial, etc.)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
// ============================================================================
// Dataset Builder Utilities
// ============================================================================
/**
 * Generic dataset builder with temporal-aware splitting
 */
export class DatasetBuilder {
    /**
     * Random shuffle (for non-temporal splits)
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    /**
     * Sample from array
     */
    sampleArray(array, size) {
        const shuffled = this.shuffleArray(array);
        return shuffled.slice(0, size);
    }
    /**
     * Build simple random split (NOT recommended for time-series)
     */
    buildRandomSplit(examples, splitRatio = 0.8) {
        console.log(`⚠️  Using random split - not recommended for temporal data!`);
        const shuffled = this.shuffleArray([...examples]);
        const splitIndex = Math.floor(shuffled.length * splitRatio);
        return {
            training: shuffled.slice(0, splitIndex),
            validation: shuffled.slice(splitIndex),
            metadata: {
                total_examples: examples.length,
                training_size: splitIndex,
                validation_size: examples.length - splitIndex,
                split_ratio: splitRatio,
                split_strategy: 'random'
            }
        };
    }
    /**
     * Build temporal split (train on past, validate on future)
     * RECOMMENDED for time-series data
     */
    buildTemporalSplit(examples, config) {
        console.log(`Building temporal-aware split...`);
        console.log(`Strategy: ${config.strategy}`);
        // Sort by temporal key
        const sorted = [...examples].sort((a, b) => a.temporal_key - b.temporal_key);
        let training;
        let validation;
        if (config.strategy === 'rolling-window') {
            ({ training, validation } = this.splitByRollingWindow(sorted, config));
        }
        else if (config.strategy === 'temporal') {
            ({ training, validation } = this.splitByTimestamp(sorted, config));
        }
        else {
            throw new Error(`Invalid split strategy: ${config.strategy}`);
        }
        // Validate no temporal leakage
        const leakageDetected = config.ensureNoLeakage !== false
            ? this.detectTemporalLeakage(training, validation)
            : false;
        if (leakageDetected) {
            console.warn('⚠️  TEMPORAL LEAKAGE DETECTED: Validation data precedes training data!');
        }
        const trainStats = this.calculateTemporalStats(training);
        const valStats = this.calculateTemporalStats(validation);
        return {
            training,
            validation,
            metadata: {
                total_examples: examples.length,
                training_size: training.length,
                validation_size: validation.length,
                split_ratio: training.length / examples.length,
                split_strategy: config.strategy,
                temporal_leakage_detected: leakageDetected,
                train_temporal_range: trainStats.range,
                validation_temporal_range: valStats.range,
                split_config: config
            }
        };
    }
    /**
     * Split by timestamp/key (train before cutoff, validate after)
     */
    splitByTimestamp(examples, config) {
        const cutoffKey = config.trainThroughKey;
        if (!cutoffKey) {
            throw new Error('trainThroughKey is required for temporal split');
        }
        console.log(`Train through temporal key: ${cutoffKey}`);
        const training = examples.filter(ex => ex.temporal_key <= cutoffKey);
        const validation = examples.filter(ex => ex.temporal_key > cutoffKey);
        // Validate minimum examples
        if (config.minTrainExamples && training.length < config.minTrainExamples) {
            console.warn(`⚠️  Training set has ${training.length} examples, ` +
                `minimum required: ${config.minTrainExamples}`);
        }
        if (config.minValidationExamples && validation.length < config.minValidationExamples) {
            console.warn(`⚠️  Validation set has ${validation.length} examples, ` +
                `minimum required: ${config.minValidationExamples}`);
        }
        return { training, validation };
    }
    /**
     * Split by rolling window (train through N, validate N+1 to N+k)
     */
    splitByRollingWindow(examples, config) {
        const trainThroughKey = config.trainThroughKey;
        const validationWindow = config.validationWindow || 4;
        if (!trainThroughKey) {
            throw new Error('trainThroughKey is required for rolling window split');
        }
        const validationEndKey = trainThroughKey + validationWindow;
        console.log(`Train through key: ${trainThroughKey}`);
        console.log(`Validation keys: ${trainThroughKey + 1} to ${validationEndKey}`);
        let training = examples.filter(ex => ex.temporal_key <= trainThroughKey);
        const validation = examples.filter(ex => ex.temporal_key > trainThroughKey && ex.temporal_key <= validationEndKey);
        // Apply window size if specified
        if (config.windowSize && config.windowSize > 0) {
            const startKey = trainThroughKey - config.windowSize + 1;
            training = training.filter(ex => ex.temporal_key >= startKey);
            console.log(`Applying window size ${config.windowSize}: keys ${startKey}-${trainThroughKey}`);
        }
        return { training, validation };
    }
    /**
     * Detect temporal leakage: check if any validation data precedes training data
     */
    detectTemporalLeakage(training, validation) {
        if (training.length === 0 || validation.length === 0) {
            return false;
        }
        // Find latest training example
        const latestTrain = training.reduce((latest, ex) => ex.temporal_key > latest.temporal_key ? ex : latest, training[0]);
        // Find earliest validation example
        const earliestVal = validation.reduce((earliest, ex) => ex.temporal_key < earliest.temporal_key ? ex : earliest, validation[0]);
        // Leakage detected if validation data is earlier than training data
        return earliestVal.temporal_key < latestTrain.temporal_key;
    }
    /**
     * Calculate temporal statistics for a split
     */
    calculateTemporalStats(examples) {
        if (examples.length === 0) {
            return { range: 'N/A', minKey: 0, maxKey: 0 };
        }
        const keys = examples.map(ex => ex.temporal_key);
        const minKey = Math.min(...keys);
        const maxKey = Math.max(...keys);
        return {
            range: `${minKey}-${maxKey}`,
            minKey,
            maxKey
        };
    }
}
// ============================================================================
// Balancing Utilities
// ============================================================================
/**
 * Balance dataset by outcome (equal correct/incorrect examples)
 */
export function balanceByOutcome(examples, outcomeKey = 'is_correct') {
    const positive = examples.filter(ex => ex.data[outcomeKey] === true || ex.data[outcomeKey] === 1);
    const negative = examples.filter(ex => ex.data[outcomeKey] === false || ex.data[outcomeKey] === 0);
    const minSize = Math.min(positive.length, negative.length);
    const builder = new DatasetBuilder();
    const balancedPositive = builder.sampleArray(positive, minSize);
    const balancedNegative = builder.sampleArray(negative, minSize);
    return [...balancedPositive, ...balancedNegative];
}
/**
 * Balance dataset by categorical field
 */
export function balanceByCategory(examples, categoryKey) {
    // Group by category
    const groups = new Map();
    examples.forEach(ex => {
        const category = ex.data[categoryKey];
        if (!groups.has(category)) {
            groups.set(category, []);
        }
        groups.get(category).push(ex);
    });
    // Find minimum group size
    const minSize = Math.min(...Array.from(groups.values()).map(g => g.length));
    // Sample from each group
    const builder = new DatasetBuilder();
    const balanced = [];
    groups.forEach(group => {
        balanced.push(...builder.sampleArray(group, minSize));
    });
    return balanced;
}
// ============================================================================
// Export Utilities
// ============================================================================
/**
 * Export dataset to JSONL format (one example per line)
 */
export function exportToJSONL(examples, outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    const lines = examples.map(ex => JSON.stringify(ex));
    fs.writeFileSync(outputPath, lines.join('\n'));
    console.log(`Exported ${examples.length} examples to ${outputPath}`);
}
/**
 * Export full dataset split to separate JSONL files
 */
export function exportSplitToJSONL(split, outputDir, prefix = 'data') {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    const trainingPath = `${outputDir}/${prefix}-train.jsonl`;
    const validationPath = `${outputDir}/${prefix}-val.jsonl`;
    exportToJSONL(split.training, trainingPath);
    exportToJSONL(split.validation, validationPath);
    console.log(`\nDataset exported:`);
    console.log(`  Training: ${trainingPath}`);
    console.log(`  Validation: ${validationPath}`);
}

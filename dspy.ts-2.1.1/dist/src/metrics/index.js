"use strict";
/**
 * Metrics and Evaluation - DSPy.ts
 *
 * Common evaluation metrics for DSPy programs.
 * Compatible with DSPy Python metrics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.exactMatch = exactMatch;
exports.f1Score = f1Score;
exports.answerSimilarity = answerSimilarity;
exports.contains = contains;
exports.semanticSimilarity = semanticSimilarity;
exports.passAtK = passAtK;
exports.meanReciprocalRank = meanReciprocalRank;
exports.bleuScore = bleuScore;
exports.rougeL = rougeL;
exports.accuracy = accuracy;
exports.createMetric = createMetric;
exports.combinedMetric = combinedMetric;
exports.evaluate = evaluate;
/**
 * Exact match metric - checks if prediction exactly matches expected output
 */
function exactMatch(example, prediction, field) {
    if (field) {
        return example[field] === prediction[field] ? 1.0 : 0.0;
    }
    // Check all fields
    const exampleKeys = Object.keys(example);
    const matches = exampleKeys.filter((key) => example[key] === prediction[key]).length;
    return matches === exampleKeys.length ? 1.0 : 0.0;
}
/**
 * F1 score for token-level comparison
 */
function f1Score(expected, predicted) {
    const expectedTokens = new Set(tokenize(expected));
    const predictedTokens = new Set(tokenize(predicted));
    if (expectedTokens.size === 0 && predictedTokens.size === 0) {
        return 1.0;
    }
    if (expectedTokens.size === 0 || predictedTokens.size === 0) {
        return 0.0;
    }
    // Calculate intersection
    const intersection = new Set([...expectedTokens].filter((x) => predictedTokens.has(x)));
    const precision = intersection.size / predictedTokens.size;
    const recall = intersection.size / expectedTokens.size;
    if (precision + recall === 0) {
        return 0.0;
    }
    return (2 * precision * recall) / (precision + recall);
}
/**
 * Answer similarity metric (F1 score wrapper)
 */
function answerSimilarity(example, prediction) {
    if (!example.answer || !prediction.answer) {
        return 0.0;
    }
    return f1Score(example.answer, prediction.answer);
}
/**
 * Contains metric - checks if prediction contains expected substring
 */
function contains(example, prediction, field) {
    const expected = String(example[field]).toLowerCase();
    const predicted = String(prediction[field]).toLowerCase();
    return predicted.includes(expected) ? 1.0 : 0.0;
}
/**
 * Semantic similarity (simplified version using token overlap)
 * For production, use actual embedding-based similarity
 */
function semanticSimilarity(text1, text2) {
    return f1Score(text1, text2);
}
/**
 * Pass at K metric - checks if correct answer appears in top K predictions
 */
function passAtK(example, predictions, k, matchFn) {
    const topK = predictions.slice(0, k);
    return topK.some((pred) => matchFn(example, pred)) ? 1.0 : 0.0;
}
/**
 * Mean Reciprocal Rank (MRR)
 */
function meanReciprocalRank(example, predictions, matchFn) {
    for (let i = 0; i < predictions.length; i++) {
        if (matchFn(example, predictions[i])) {
            return 1.0 / (i + 1);
        }
    }
    return 0.0;
}
/**
 * BLEU score (simplified version)
 */
function bleuScore(reference, candidate, n = 4) {
    const refTokens = tokenize(reference);
    const candTokens = tokenize(candidate);
    if (candTokens.length === 0) {
        return 0.0;
    }
    let totalScore = 0;
    let weights = 0;
    for (let i = 1; i <= n; i++) {
        const refNgrams = getNgrams(refTokens, i);
        const candNgrams = getNgrams(candTokens, i);
        if (candNgrams.length === 0) {
            continue;
        }
        const matches = candNgrams.filter((ng) => refNgrams.includes(ng)).length;
        const precision = matches / candNgrams.length;
        totalScore += precision;
        weights++;
    }
    // Brevity penalty
    const bp = candTokens.length >= refTokens.length
        ? 1.0
        : Math.exp(1 - refTokens.length / candTokens.length);
    return bp * (totalScore / weights);
}
/**
 * Rouge-L score (Longest Common Subsequence)
 */
function rougeL(reference, candidate) {
    const refTokens = tokenize(reference);
    const candTokens = tokenize(candidate);
    const lcs = longestCommonSubsequence(refTokens, candTokens);
    if (refTokens.length === 0 || candTokens.length === 0) {
        return 0.0;
    }
    const precision = lcs / candTokens.length;
    const recall = lcs / refTokens.length;
    if (precision + recall === 0) {
        return 0.0;
    }
    return (2 * precision * recall) / (precision + recall);
}
/**
 * Accuracy metric for classification tasks
 */
function accuracy(examples, predictions) {
    if (examples.length !== predictions.length || examples.length === 0) {
        return 0.0;
    }
    const correct = examples.filter((ex, i) => ex.label === predictions[i].label).length;
    return correct / examples.length;
}
/**
 * Create a custom metric function
 */
function createMetric(metricFn) {
    return (example, prediction) => {
        const result = metricFn(example, prediction);
        return typeof result === 'boolean' ? (result ? 1.0 : 0.0) : result;
    };
}
/**
 * Combine multiple metrics with weights
 */
function combinedMetric(metrics) {
    return async (example, prediction, trace) => {
        let totalScore = 0;
        let totalWeight = 0;
        for (const { metric, weight } of metrics) {
            const score = await metric(example, prediction, trace);
            totalScore += score * weight;
            totalWeight += weight;
        }
        return totalWeight > 0 ? totalScore / totalWeight : 0.0;
    };
}
// Helper functions
function tokenize(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 0);
}
function getNgrams(tokens, n) {
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
        ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
}
function longestCommonSubsequence(seq1, seq2) {
    const m = seq1.length;
    const n = seq2.length;
    const dp = Array(m + 1)
        .fill(null)
        .map(() => Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (seq1[i - 1] === seq2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            }
            else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp[m][n];
}
/**
 * Evaluation helper - evaluate a program on a dataset
 */
async function evaluate(program, dataset, metric, options = {}) {
    var _a, _b, _c;
    const parallel = (_a = options.parallel) !== null && _a !== void 0 ? _a : false;
    const batchSize = (_b = options.batchSize) !== null && _b !== void 0 ? _b : 10;
    const verbose = (_c = options.verbose) !== null && _c !== void 0 ? _c : false;
    const predictions = [];
    const scores = [];
    if (parallel) {
        // Parallel evaluation
        const promises = dataset.map((example) => program.run(example));
        const results = await Promise.allSettled(promises);
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const example = dataset[i];
            if (result.status === 'fulfilled') {
                predictions.push(result.value);
                const score = await metric(example, result.value);
                scores.push(score);
                if (verbose) {
                    console.log(`Example ${i + 1}/${dataset.length}: ${score.toFixed(4)}`);
                }
            }
            else {
                if (verbose) {
                    console.warn(`Example ${i + 1}/${dataset.length}: Error - ${result.reason}`);
                }
                scores.push(0);
            }
        }
    }
    else {
        // Sequential evaluation
        for (let i = 0; i < dataset.length; i++) {
            const example = dataset[i];
            try {
                const prediction = await program.run(example);
                predictions.push(prediction);
                const score = await metric(example, prediction);
                scores.push(score);
                if (verbose) {
                    console.log(`Example ${i + 1}/${dataset.length}: ${score.toFixed(4)}`);
                }
            }
            catch (error) {
                if (verbose) {
                    console.warn(`Example ${i + 1}/${dataset.length}: Error - ${error}`);
                }
                scores.push(0);
            }
        }
    }
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return {
        score: avgScore,
        scores,
        predictions,
    };
}
//# sourceMappingURL=index.js.map
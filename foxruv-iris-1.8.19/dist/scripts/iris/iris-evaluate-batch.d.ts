#!/usr/bin/env node
/**
 * IRIS Evaluate Batch - Queue-based Batch Evaluation CLI
 *
 * Reads a queue file, groups events by project, invokes Iris once per project,
 * and clears the queue on successful completion.
 *
 * Queue File Format (JSONL):
 *   {"project": "nfl-predictor", "event": "file_edit", "file": "src/expert.ts", "timestamp": "2024-01-01T00:00:00Z"}
 *   {"project": "microbiome-platform", "event": "model_train", "expertId": "DrDysbiosis", "timestamp": "2024-01-01T01:00:00Z"}
 *
 * Usage:
 *   npm run iris:evaluate-batch -- --queue .claude/iris-queue.jsonl
 *   npm run iris:evaluate-batch -- --queue queue.jsonl --clear-on-success
 *   npm run iris:evaluate-batch -- --help
 *
 * Exit Codes:
 *   0 = Success
 *   1 = Error
 *   2 = Invalid arguments
 *   3 = Queue processing failed
 */
/**
 * Main execution
 */
declare function main(): Promise<void>;
export { main as irisEvaluateBatch };
//# sourceMappingURL=iris-evaluate-batch.d.ts.map
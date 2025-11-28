#!/usr/bin/env node
/**
 * IRIS Evaluate - Single Project Evaluation CLI
 *
 * Evaluates a single project's health using Iris and stores results.
 *
 * Usage:
 *   npm run iris:evaluate -- --project nfl-predictor
 *   npm run iris:evaluate -- --project microbiome-platform --auto-retrain
 *   npm run iris:evaluate -- --help
 *
 * Exit Codes:
 *   0 = Success
 *   1 = Error
 *   2 = Invalid arguments
 *   3 = Project evaluation failed
 */
/**
 * Main execution
 */
declare function main(options?: any): Promise<void>;
export { main as irisEvaluate };
export default main;
//# sourceMappingURL=iris-evaluate.d.ts.map
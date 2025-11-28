#!/usr/bin/env node
/**
 * IRIS Auto Invoke - Smart Invocation with Trigger Checking
 *
 * Uses intelligent trigger engine to decide if Iris should be invoked
 * based on event type, context, and recent history. Records events for context
 * collection and invokes Iris only when triggers fire.
 *
 * Optimized for fast decision-making (<100ms) to be used in hooks.
 *
 * Usage:
 *   npm run iris:auto-invoke -- --event file_edit --file src/expert.ts --project nfl-predictor
 *   npm run iris:auto-invoke -- --event model_train --expert TheAnalyst --project nfl-predictor
 *   npm run iris:auto-invoke -- --event drift_detected --project microbiome-platform
 *   npm run iris:auto-invoke -- --help
 *
 * Exit Codes:
 *   0 = Success (invoked or skipped based on triggers)
 *   1 = Error
 *   2 = Invalid arguments
 */
/**
 * Main execution
 */
declare function main(): Promise<void>;
export { main as irisAutoInvoke };
//# sourceMappingURL=iris-auto-invoke.d.ts.map
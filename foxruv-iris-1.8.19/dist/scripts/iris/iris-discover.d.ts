#!/usr/bin/env node
/**
 * IRIS Discover - Autonomous Expert Discovery & Instrumentation
 *
 * Orchestrates the complete discovery workflow:
 * 1. Scan project for expert functions/modules
 * 2. Store discoveries in AgentDB + Supabase
 * 3. Analyze gaps (missing telemetry)
 * 4. Interactive instrumentation approval
 * 5. Auto-instrument code with telemetry
 * 6. Summary and next steps
 *
 * Features:
 * - Multi-language support (TypeScript, JavaScript, Python)
 * - Pattern detection (DSPy signatures, AI functions, data pipelines)
 * - AgentDB vector storage for expert embeddings
 * - Supabase reflexion bank integration
 * - Interactive CLI prompts
 * - Dry-run mode
 * - JSON export
 *
 * Usage:
 *   iris discover --project <path> [options]
 *
 * Exit Codes:
 *   0 = Success
 *   1 = Error
 *   2 = Invalid arguments
 *   3 = Scan failed
 *
 * @version 1.0.0
 */
declare function main(options?: any): Promise<void>;
export { main as irisDiscover };
export default main;
//# sourceMappingURL=iris-discover.d.ts.map
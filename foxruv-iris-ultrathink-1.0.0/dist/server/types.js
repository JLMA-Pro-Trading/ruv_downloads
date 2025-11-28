/**
 * UltraThink MCP Server Type Definitions
 *
 * Standalone type definitions for the UltraThink MCP server
 * with agentic-flow and agentdb integration
 *
 * @module types
 */
// ============================================================================
// Error Types
// ============================================================================
export class UltraThinkError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'UltraThinkError';
    }
}
export class SwarmError extends UltraThinkError {
    constructor(message, details) {
        super(message, 'SWARM_ERROR', details);
        this.name = 'SwarmError';
    }
}
export class LearningError extends UltraThinkError {
    constructor(message, details) {
        super(message, 'LEARNING_ERROR', details);
        this.name = 'LearningError';
    }
}
//# sourceMappingURL=types.js.map
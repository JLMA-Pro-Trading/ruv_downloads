"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LMError = void 0;
exports.configureLM = configureLM;
exports.getLM = getLM;
/**
 * Error class for LM-related errors
 */
class LMError extends Error {
    constructor(message, codeOrCause) {
        const msg = typeof message === 'string' ? message : message.message;
        super(msg);
        this.name = 'LMError';
        if (typeof codeOrCause === 'string') {
            this.code = codeOrCause;
        }
        else if (codeOrCause instanceof Error) {
            this.cause = codeOrCause;
        }
    }
}
exports.LMError = LMError;
// Global LM instance
let globalLM = null;
/**
 * Configure the global language model
 */
function configureLM(lm) {
    globalLM = lm;
}
/**
 * Get the global language model
 * @throws {LMError} if no LM is configured
 */
function getLM() {
    if (!globalLM) {
        throw new LMError('No language model configured. Call configureLM() first.');
    }
    return globalLM;
}
//# sourceMappingURL=base.js.map
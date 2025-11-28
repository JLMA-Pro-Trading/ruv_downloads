"use strict";
/**
 * DSPy.ts - TypeScript implementation of Stanford's DSPy framework
 *
 * A declarative framework for building modular AI software that automatically
 * compiles programs into effective prompts and weights for language models.
 *
 * @version 2.1.0
 * @author rUv
 * @license MIT
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLM = exports.configureLM = exports.evaluate = exports.combinedMetric = exports.createMetric = exports.accuracy = exports.rougeL = exports.bleuScore = exports.meanReciprocalRank = exports.passAtK = exports.semanticSimilarity = exports.contains = exports.answerSimilarity = exports.f1Score = exports.exactMatch = void 0;
// Core exports
__exportStar(require("./core"), exports);
// LM exports
__exportStar(require("./lm/base"), exports);
__exportStar(require("./lm/dummy"), exports);
__exportStar(require("./lm/providers"), exports);
// Module exports
__exportStar(require("./modules"), exports);
// Optimizer exports
__exportStar(require("./optimize/base"), exports);
__exportStar(require("./optimize/bootstrap"), exports);
__exportStar(require("./optimize/mipro-v2"), exports);
// Memory exports
__exportStar(require("./memory"), exports);
// Agent exports
__exportStar(require("./agent"), exports);
var metrics_1 = require("./metrics");
Object.defineProperty(exports, "exactMatch", { enumerable: true, get: function () { return metrics_1.exactMatch; } });
Object.defineProperty(exports, "f1Score", { enumerable: true, get: function () { return metrics_1.f1Score; } });
Object.defineProperty(exports, "answerSimilarity", { enumerable: true, get: function () { return metrics_1.answerSimilarity; } });
Object.defineProperty(exports, "contains", { enumerable: true, get: function () { return metrics_1.contains; } });
Object.defineProperty(exports, "semanticSimilarity", { enumerable: true, get: function () { return metrics_1.semanticSimilarity; } });
Object.defineProperty(exports, "passAtK", { enumerable: true, get: function () { return metrics_1.passAtK; } });
Object.defineProperty(exports, "meanReciprocalRank", { enumerable: true, get: function () { return metrics_1.meanReciprocalRank; } });
Object.defineProperty(exports, "bleuScore", { enumerable: true, get: function () { return metrics_1.bleuScore; } });
Object.defineProperty(exports, "rougeL", { enumerable: true, get: function () { return metrics_1.rougeL; } });
Object.defineProperty(exports, "accuracy", { enumerable: true, get: function () { return metrics_1.accuracy; } });
Object.defineProperty(exports, "createMetric", { enumerable: true, get: function () { return metrics_1.createMetric; } });
Object.defineProperty(exports, "combinedMetric", { enumerable: true, get: function () { return metrics_1.combinedMetric; } });
Object.defineProperty(exports, "evaluate", { enumerable: true, get: function () { return metrics_1.evaluate; } });
// Legacy global LM configuration (for backwards compatibility)
const base_1 = require("./lm/base");
Object.defineProperty(exports, "configureLM", { enumerable: true, get: function () { return base_1.configureLM; } });
Object.defineProperty(exports, "getLM", { enumerable: true, get: function () { return base_1.getLM; } });
//# sourceMappingURL=index.js.map
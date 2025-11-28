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
export * from './core';
export * from './lm/base';
export * from './lm/dummy';
export * from './lm/providers';
export * from './modules';
export * from './optimize/base';
export * from './optimize/bootstrap';
export * from './optimize/mipro-v2';
export * from './memory';
export * from './agent';
export { type MetricFunction as EvaluationMetric } from './metrics';
export { exactMatch, f1Score, answerSimilarity, contains, semanticSimilarity, passAtK, meanReciprocalRank, bleuScore, rougeL, accuracy, createMetric, combinedMetric, evaluate, } from './metrics';
import { configureLM as coreConfigure, getLM as coreGetLM } from './lm/base';
export { coreConfigure as configureLM, coreGetLM as getLM };

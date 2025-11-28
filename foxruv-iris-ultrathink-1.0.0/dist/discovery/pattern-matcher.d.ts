/**
 * Pattern matching engine for AI/ML expert detection
 *
 * This module provides pattern-based detection of various expert types
 * including DSPy signatures, AI functions, data pipelines, and optimization functions.
 *
 * @module discovery/pattern-matcher
 * @version 1.0.0
 */
import type { PatternRule, PatternMatch, SupportedLanguage, ExpertType } from './types.js';
/**
 * Default AI/ML function keywords
 */
export declare const DEFAULT_AI_KEYWORDS: string[];
/**
 * Built-in pattern rules for expert detection
 */
export declare const BUILTIN_PATTERNS: PatternRule[];
/**
 * Pattern matcher class for expert detection
 */
export declare class PatternMatcher {
    private rules;
    constructor(customRules?: PatternRule[]);
    /**
     * Match patterns in file content
     */
    matchPatterns(content: string, filePath: string, language: SupportedLanguage): PatternMatch[];
    /**
     * Find the end of a code block
     */
    private findBlockEnd;
    /**
     * Find Python block end based on indentation
     */
    private findPythonBlockEnd;
    /**
     * Extract signature from code
     */
    private extractSignature;
    /**
     * Add custom pattern rule
     */
    addRule(rule: PatternRule): void;
    /**
     * Get all rules for a specific language
     */
    getRulesForLanguage(language: SupportedLanguage): PatternRule[];
    /**
     * Get all rules for a specific expert type
     */
    getRulesForType(expertType: ExpertType): PatternRule[];
}
//# sourceMappingURL=pattern-matcher.d.ts.map
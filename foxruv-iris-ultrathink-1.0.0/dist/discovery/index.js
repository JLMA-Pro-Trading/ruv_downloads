/**
 * Expert Discovery System
 *
 * A comprehensive system for discovering AI/ML experts in codebases
 * through pattern matching, code analysis, and metadata extraction.
 *
 * @example
 * ```typescript
 * import { CodeScanner } from '@foxruv/ultrathink/discovery'
 *
 * const scanner = new CodeScanner({
 *   verbose: true,
 *   languages: ['typescript', 'python'],
 *   expertTypes: ['dspy_signature', 'ai_function']
 * })
 *
 * const result = await scanner.scanProject('./my-project')
 *
 * console.log(`Found ${result.summary.totalExperts} experts`)
 * for (const expert of result.experts) {
 *   console.log(`- ${expert.name} (${expert.expertType})`)
 * }
 * ```
 *
 * @example Custom Pattern
 * ```typescript
 * import { PatternMatcher } from '@foxruv/ultrathink/discovery'
 *
 * const matcher = new PatternMatcher()
 *
 * // Add custom pattern for detecting transformers
 * matcher.addRule({
 *   id: 'custom-transformer',
 *   name: 'Custom Transformer',
 *   languages: ['typescript'],
 *   expertType: 'ai_function',
 *   pattern: /class\s+(\w+Transformer)\s*{/g,
 *   confidence: 0.9
 * })
 *
 * const matches = matcher.matchPatterns(code, filePath, 'typescript')
 * ```
 *
 * @module discovery
 * @version 1.0.0
 */
// Main scanner
export { CodeScanner, DEFAULT_SCANNER_OPTIONS } from './code-scanner.js';
// Pattern matching
export { PatternMatcher, BUILTIN_PATTERNS, DEFAULT_AI_KEYWORDS } from './pattern-matcher.js';
// Expert extraction
export { ExpertExtractor, DEFAULT_EXTRACTOR_CONFIG } from './expert-extractor.js';
// Language parsers
export { TypeScriptParser, JavaScriptParser, PythonParser, getParser } from './language-parsers.js';
//# sourceMappingURL=index.js.map
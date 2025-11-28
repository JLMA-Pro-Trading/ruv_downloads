/**
 * Language-specific parsers for TypeScript/JavaScript and Python
 *
 * This module provides parsing capabilities for extracting code blocks,
 * signatures, and metadata from different programming languages.
 *
 * @module discovery/language-parsers
 * @version 1.0.0
 */
import type { CodeBlock, LanguageParser, SupportedLanguage } from './types.js';
/**
 * TypeScript/JavaScript parser implementation
 */
export declare class TypeScriptParser implements LanguageParser {
    language: SupportedLanguage;
    /**
     * Parse TypeScript/JavaScript content into code blocks
     */
    parseBlocks(content: string, lines: string[]): CodeBlock[];
    /**
     * Find the end of a code block by matching braces
     */
    findBlockEnd(content: string, startPos: number): number;
    /**
     * Find matching closing brace
     */
    private findClosingBrace;
    /**
     * Find the end of an arrow function
     */
    private findArrowFunctionEnd;
    /**
     * Extract function/class signature
     */
    extractSignature(content: string, startPos: number): string;
    /**
     * Check if code contains telemetry calls
     */
    hasTelemetry(code: string): boolean;
}
/**
 * Python parser implementation
 */
export declare class PythonParser implements LanguageParser {
    language: SupportedLanguage;
    /**
     * Parse Python content into code blocks
     */
    parseBlocks(content: string, lines: string[]): CodeBlock[];
    /**
     * Find the end of a Python block based on indentation
     */
    findBlockEnd(content: string, startPos: number): number;
    /**
     * Extract function/class signature
     */
    extractSignature(content: string, startPos: number): string;
    /**
     * Check if code contains telemetry calls
     */
    hasTelemetry(code: string): boolean;
}
/**
 * JavaScript parser (extends TypeScript parser)
 */
export declare class JavaScriptParser extends TypeScriptParser {
    language: SupportedLanguage;
}
/**
 * Get appropriate parser for a language
 */
export declare function getParser(language: SupportedLanguage): LanguageParser;
//# sourceMappingURL=language-parsers.d.ts.map
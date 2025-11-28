/**
 * Core types for expert discovery and code scanning system
 *
 * This module defines all interfaces and types used throughout the discovery system.
 * It provides a clean contract for pattern detection, expert extraction, and metadata handling.
 *
 * @module discovery/types
 * @version 1.0.0
 */
/**
 * Supported programming languages for code analysis
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'python';
/**
 * Types of AI/ML experts that can be discovered
 */
export type ExpertType = 'dspy_signature' | 'ai_function' | 'data_pipeline' | 'optimization' | 'generic';
/**
 * Discovered expert with full metadata
 *
 * Represents an AI/ML expert found during code scanning,
 * including location, signature, and confidence metrics.
 */
export interface DiscoveredExpert {
    /** Unique identifier for this expert */
    id: string;
    /** Expert name (class/function name) */
    name: string;
    /** Relative path to file containing the expert */
    filePath: string;
    /** Programming language */
    language: SupportedLanguage;
    /** Type of expert discovered */
    expertType: ExpertType;
    /** Expert signature (class/function declaration) */
    signature: string;
    /** Human-readable description */
    description: string;
    /** Confidence score (0-1) based on pattern matching */
    confidence: number;
    /** Starting line number (1-indexed) */
    lineStart: number;
    /** Ending line number (1-indexed) */
    lineEnd: number;
    /** Optional embedding vector for semantic search */
    embedding?: number[];
    /** Additional metadata specific to the expert type */
    metadata?: Record<string, any>;
}
/**
 * Scan result containing all discovered experts and summary statistics
 */
export interface ScanResult {
    /** All discovered experts */
    experts: DiscoveredExpert[];
    /** Summary statistics */
    summary: {
        totalFiles: number;
        totalExperts: number;
        byLanguage: Record<string, number>;
        byType: Record<string, number>;
    };
    /** Errors encountered during scanning */
    errors: string[];
}
/**
 * Pattern detection rule for identifying experts
 */
export interface PatternRule {
    /** Unique identifier for this pattern */
    id: string;
    /** Pattern name */
    name: string;
    /** Languages this pattern applies to */
    languages: SupportedLanguage[];
    /** Expert type this pattern detects */
    expertType: ExpertType;
    /** Regular expression for pattern matching */
    pattern: RegExp;
    /** Base confidence score (0-1) */
    confidence: number;
    /** Additional validation function */
    validate?: (match: RegExpMatchArray, context: PatternContext) => boolean;
    /** Confidence boost function */
    boostConfidence?: (match: RegExpMatchArray, context: PatternContext) => number;
}
/**
 * Context provided to pattern matchers for validation
 */
export interface PatternContext {
    /** Full file content */
    content: string;
    /** File path */
    filePath: string;
    /** Programming language */
    language: SupportedLanguage;
    /** File lines */
    lines: string[];
    /** Current match position in content */
    position: number;
}
/**
 * Result of pattern matching operation
 */
export interface PatternMatch {
    /** Matched pattern rule */
    rule: PatternRule;
    /** Regex match result */
    match: RegExpMatchArray;
    /** Confidence score for this match */
    confidence: number;
    /** Starting line number */
    lineStart: number;
    /** Ending line number */
    lineEnd: number;
    /** Extracted name (class/function name) */
    name: string;
    /** Extracted signature */
    signature: string;
    /** Additional metadata from pattern extraction */
    metadata?: Record<string, any>;
}
/**
 * Options for code scanner
 */
export interface ScannerOptions {
    /** Enable verbose logging */
    verbose?: boolean;
    /** Languages to scan (default: all) */
    languages?: SupportedLanguage[];
    /** Expert types to detect (default: all) */
    expertTypes?: ExpertType[];
    /** Custom pattern rules to add */
    customPatterns?: PatternRule[];
    /** Maximum file size to scan (bytes) */
    maxFileSize?: number;
    /** Directories to exclude */
    excludeDirs?: string[];
}
/**
 * Code block with metadata
 */
export interface CodeBlock {
    /** Code content */
    content: string;
    /** Starting line number */
    lineStart: number;
    /** Ending line number */
    lineEnd: number;
    /** Block type (class, function, etc.) */
    type: 'class' | 'function' | 'method' | 'unknown';
    /** Name of the block */
    name: string;
    /** Indentation level (for Python) */
    indent?: number;
}
/**
 * Parser interface for language-specific parsing
 */
export interface LanguageParser {
    /** Language this parser handles */
    language: SupportedLanguage;
    /**
     * Parse file content and extract code blocks
     */
    parseBlocks(content: string, lines: string[]): CodeBlock[];
    /**
     * Find the end of a code block
     */
    findBlockEnd(content: string, startPos: number): number;
    /**
     * Extract function/method signature
     */
    extractSignature(content: string, startPos: number): string;
    /**
     * Check if code contains telemetry calls
     */
    hasTelemetry(code: string): boolean;
}
/**
 * Expert extractor configuration
 */
export interface ExtractorConfig {
    /** Enable AI function detection */
    detectAIFunctions?: boolean;
    /** Enable DSPy signature detection */
    detectDSPySignatures?: boolean;
    /** Enable data pipeline detection */
    detectDataPipelines?: boolean;
    /** Enable optimization function detection */
    detectOptimization?: boolean;
    /** Minimum confidence threshold (0-1) */
    minConfidence?: number;
    /** AI function keywords */
    aiFunctionKeywords?: string[];
    /** Telemetry patterns to detect */
    telemetryPatterns?: string[];
}
//# sourceMappingURL=types.d.ts.map
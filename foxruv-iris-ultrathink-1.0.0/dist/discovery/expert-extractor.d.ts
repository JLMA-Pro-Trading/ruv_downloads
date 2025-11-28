/**
 * Expert extraction with metadata and confidence scoring
 *
 * This module provides high-level extraction of AI/ML experts from code,
 * combining pattern matching with metadata enrichment and confidence scoring.
 *
 * @module discovery/expert-extractor
 * @version 1.0.0
 */
import type { DiscoveredExpert, ExtractorConfig, SupportedLanguage } from './types.js';
/**
 * Default extractor configuration
 */
export declare const DEFAULT_EXTRACTOR_CONFIG: ExtractorConfig;
/**
 * Expert extractor class
 *
 * Extracts AI/ML experts from code files with metadata enrichment
 */
export declare class ExpertExtractor {
    private config;
    private patternMatcher;
    constructor(config?: Partial<ExtractorConfig>);
    /**
     * Extract experts from file content
     */
    extractExperts(content: string, filePath: string, language: SupportedLanguage, projectPath: string): DiscoveredExpert[];
    /**
     * Generate human-readable description for expert
     */
    private generateDescription;
    /**
     * Infer function purpose from name
     */
    private inferFunctionPurpose;
    /**
     * Get relative path from project root
     */
    private getRelativePath;
    /**
     * Check if expert has telemetry
     */
    hasTelemetry(code: string): boolean;
    /**
     * Add custom AI keyword
     */
    addAIKeyword(keyword: string): void;
    /**
     * Add custom telemetry pattern
     */
    addTelemetryPattern(pattern: string): void;
    /**
     * Get current configuration
     */
    getConfig(): ExtractorConfig;
    /**
     * Update configuration
     */
    updateConfig(updates: Partial<ExtractorConfig>): void;
}
//# sourceMappingURL=expert-extractor.d.ts.map
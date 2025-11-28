/**
 * Expert extraction with metadata and confidence scoring
 *
 * This module provides high-level extraction of AI/ML experts from code,
 * combining pattern matching with metadata enrichment and confidence scoring.
 *
 * @module discovery/expert-extractor
 * @version 1.0.0
 */
import { randomUUID } from 'crypto';
import { PatternMatcher, DEFAULT_AI_KEYWORDS } from './pattern-matcher.js';
import { getParser } from './language-parsers.js';
/**
 * Default extractor configuration
 */
export const DEFAULT_EXTRACTOR_CONFIG = {
    detectAIFunctions: true,
    detectDSPySignatures: true,
    detectDataPipelines: true,
    detectOptimization: true,
    minConfidence: 0.5,
    aiFunctionKeywords: DEFAULT_AI_KEYWORDS,
    telemetryPatterns: [
        'logTelemetry',
        'recordExecution',
        'trackPerformance',
        'saveReflexion',
        'storeExecution'
    ]
};
/**
 * Expert extractor class
 *
 * Extracts AI/ML experts from code files with metadata enrichment
 */
export class ExpertExtractor {
    config;
    patternMatcher;
    constructor(config = {}) {
        this.config = { ...DEFAULT_EXTRACTOR_CONFIG, ...config };
        this.patternMatcher = new PatternMatcher();
    }
    /**
     * Extract experts from file content
     */
    extractExperts(content, filePath, language, projectPath) {
        const experts = [];
        const parser = getParser(language);
        // Match patterns
        const matches = this.patternMatcher.matchPatterns(content, filePath, language);
        // Filter by confidence threshold
        const validMatches = matches.filter(match => match.confidence >= (this.config.minConfidence || 0.5));
        // Convert matches to experts
        for (const match of validMatches) {
            // Check telemetry
            const blockContent = content.substring(content.split('\n').slice(0, match.lineStart - 1).join('\n').length, content.split('\n').slice(0, match.lineEnd).join('\n').length);
            const hasTelemetry = parser.hasTelemetry(blockContent);
            // Generate description
            const description = this.generateDescription(match, language);
            // Create expert
            const expert = {
                id: `expert-${randomUUID()}`,
                name: match.name,
                filePath: this.getRelativePath(filePath, projectPath),
                language,
                expertType: match.rule.expertType,
                signature: match.signature,
                description,
                confidence: match.confidence,
                lineStart: match.lineStart,
                lineEnd: match.lineEnd,
                metadata: {
                    ...match.metadata,
                    hasTelemetry,
                    patternId: match.rule.id,
                    patternName: match.rule.name
                }
            };
            experts.push(expert);
        }
        return experts;
    }
    /**
     * Generate human-readable description for expert
     */
    generateDescription(match, language) {
        const { name, rule } = match;
        switch (rule.expertType) {
            case 'dspy_signature':
                return `DSPy-style signature: ${name}`;
            case 'ai_function':
                // Determine function purpose from name
                const purpose = this.inferFunctionPurpose(name);
                return `AI function: ${name} (${purpose})`;
            case 'data_pipeline':
                return `Data pipeline: ${name}`;
            case 'optimization':
                return `Optimization function: ${name}`;
            case 'generic':
            default:
                return `Generic expert: ${name}`;
        }
    }
    /**
     * Infer function purpose from name
     */
    inferFunctionPurpose(name) {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('predict'))
            return 'prediction';
        if (nameLower.includes('generate'))
            return 'generation';
        if (nameLower.includes('classify'))
            return 'classification';
        if (nameLower.includes('optimize'))
            return 'optimization';
        if (nameLower.includes('train'))
            return 'training';
        if (nameLower.includes('infer'))
            return 'inference';
        if (nameLower.includes('embed'))
            return 'embedding';
        if (nameLower.includes('transform'))
            return 'transformation';
        if (nameLower.includes('encode'))
            return 'encoding';
        if (nameLower.includes('decode'))
            return 'decoding';
        return 'AI/ML processing';
    }
    /**
     * Get relative path from project root
     */
    getRelativePath(filePath, projectPath) {
        if (filePath.startsWith(projectPath)) {
            return filePath.substring(projectPath.length).replace(/^\//, '');
        }
        return filePath;
    }
    /**
     * Check if expert has telemetry
     */
    hasTelemetry(code) {
        const patterns = this.config.telemetryPatterns || DEFAULT_EXTRACTOR_CONFIG.telemetryPatterns;
        return patterns.some(pattern => code.includes(pattern));
    }
    /**
     * Add custom AI keyword
     */
    addAIKeyword(keyword) {
        if (!this.config.aiFunctionKeywords) {
            this.config.aiFunctionKeywords = [...DEFAULT_AI_KEYWORDS];
        }
        this.config.aiFunctionKeywords.push(keyword);
    }
    /**
     * Add custom telemetry pattern
     */
    addTelemetryPattern(pattern) {
        if (!this.config.telemetryPatterns) {
            this.config.telemetryPatterns = [...DEFAULT_EXTRACTOR_CONFIG.telemetryPatterns];
        }
        this.config.telemetryPatterns.push(pattern);
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
}
//# sourceMappingURL=expert-extractor.js.map
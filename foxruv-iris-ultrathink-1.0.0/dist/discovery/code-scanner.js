/**
 * Main code scanner for expert discovery
 *
 * This module orchestrates the complete code scanning process:
 * - File discovery and filtering
 * - Language detection
 * - Expert extraction
 * - Result aggregation
 *
 * @module discovery/code-scanner
 * @version 1.0.0
 */
import * as fs from 'fs';
import * as path from 'path';
import { ExpertExtractor } from './expert-extractor.js';
/**
 * Default scanner options
 */
export const DEFAULT_SCANNER_OPTIONS = {
    verbose: false,
    languages: ['typescript', 'javascript', 'python'],
    expertTypes: ['dspy_signature', 'ai_function', 'data_pipeline', 'optimization', 'generic'],
    customPatterns: [],
    maxFileSize: 5 * 1024 * 1024, // 5MB
    excludeDirs: ['node_modules', '__pycache__', 'dist', 'build', '.git', 'coverage']
};
/**
 * Code scanner class
 *
 * Main entry point for scanning projects and discovering AI/ML experts
 */
export class CodeScanner {
    options;
    extractor;
    constructor(options = {}) {
        this.options = { ...DEFAULT_SCANNER_OPTIONS, ...options };
        this.extractor = new ExpertExtractor({
            minConfidence: 0.5,
            aiFunctionKeywords: undefined // Use defaults
        });
    }
    /**
     * Scan entire project directory for experts
     */
    async scanProject(projectPath) {
        const result = {
            experts: [],
            summary: {
                totalFiles: 0,
                totalExperts: 0,
                byLanguage: {},
                byType: {}
            },
            errors: []
        };
        try {
            // Find all source files
            const files = this.findSourceFiles(projectPath);
            result.summary.totalFiles = files.length;
            if (this.options.verbose) {
                console.log(`\n📂 Scanning ${files.length} files...`);
            }
            // Scan each file
            for (const file of files) {
                try {
                    const experts = await this.scanFile(file, projectPath);
                    result.experts.push(...experts);
                    // Update summary
                    for (const expert of experts) {
                        result.summary.byLanguage[expert.language] =
                            (result.summary.byLanguage[expert.language] || 0) + 1;
                        result.summary.byType[expert.expertType] =
                            (result.summary.byType[expert.expertType] || 0) + 1;
                    }
                    if (this.options.verbose && experts.length > 0) {
                        console.log(`  ✓ ${path.relative(projectPath, file)}: ${experts.length} expert(s)`);
                    }
                }
                catch (error) {
                    const errorMsg = error instanceof Error ? error.message : String(error);
                    result.errors.push(`${file}: ${errorMsg}`);
                }
            }
            result.summary.totalExperts = result.experts.length;
        }
        catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            result.errors.push(`Project scan failed: ${errorMsg}`);
        }
        return result;
    }
    /**
     * Scan single file for experts
     */
    async scanFile(filePath, projectPath) {
        // Check file size
        const stats = fs.statSync(filePath);
        if (stats.size > this.options.maxFileSize) {
            if (this.options.verbose) {
                console.log(`  ⚠ Skipping large file: ${filePath} (${stats.size} bytes)`);
            }
            return [];
        }
        // Read file content
        const content = fs.readFileSync(filePath, 'utf-8');
        // Detect language
        const language = this.detectLanguage(filePath);
        if (!language || !this.options.languages.includes(language)) {
            return [];
        }
        // Extract experts
        const experts = this.extractor.extractExperts(content, filePath, language, projectPath);
        // Filter by expert type if specified
        if (this.options.expertTypes.length > 0) {
            return experts.filter(expert => this.options.expertTypes.includes(expert.expertType));
        }
        return experts;
    }
    /**
     * Find all source files in project
     */
    findSourceFiles(projectPath) {
        const files = [];
        const extensions = this.getExtensions();
        const walk = (dir) => {
            if (!fs.existsSync(dir)) {
                return;
            }
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                // Skip excluded directories and hidden files
                if (entry.name.startsWith('.') || this.options.excludeDirs.includes(entry.name)) {
                    continue;
                }
                if (entry.isDirectory()) {
                    walk(fullPath);
                }
                else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (extensions.has(ext)) {
                        files.push(fullPath);
                    }
                }
            }
        };
        walk(projectPath);
        return files;
    }
    /**
     * Get file extensions to scan based on selected languages
     */
    getExtensions() {
        const extensions = new Set();
        if (this.options.languages.includes('typescript')) {
            extensions.add('.ts');
            extensions.add('.tsx');
        }
        if (this.options.languages.includes('javascript')) {
            extensions.add('.js');
            extensions.add('.jsx');
            extensions.add('.mjs');
        }
        if (this.options.languages.includes('python')) {
            extensions.add('.py');
        }
        return extensions;
    }
    /**
     * Detect programming language from file path
     */
    detectLanguage(filePath) {
        const ext = path.extname(filePath);
        switch (ext) {
            case '.ts':
            case '.tsx':
                return 'typescript';
            case '.js':
            case '.jsx':
            case '.mjs':
                return 'javascript';
            case '.py':
                return 'python';
            default:
                return null;
        }
    }
    /**
     * Get scanner statistics
     */
    getStatistics(result) {
        const filesPerLanguage = {};
        let totalConfidence = 0;
        for (const expert of result.experts) {
            filesPerLanguage[expert.language] = (filesPerLanguage[expert.language] || 0) + 1;
            totalConfidence += expert.confidence;
        }
        const avgConfidence = result.experts.length > 0 ? totalConfidence / result.experts.length : 0;
        const topExperts = [...result.experts]
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 10);
        return {
            filesPerLanguage,
            expertsPerFile: result.summary.totalFiles > 0
                ? result.experts.length / result.summary.totalFiles
                : 0,
            avgConfidence,
            topExperts
        };
    }
    /**
     * Export results to JSON
     */
    exportToJson(result, outputPath) {
        const output = {
            timestamp: new Date().toISOString(),
            ...result,
            statistics: this.getStatistics(result)
        };
        fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
        if (this.options.verbose) {
            console.log(`\n💾 Results exported to: ${outputPath}`);
        }
    }
}
//# sourceMappingURL=code-scanner.js.map
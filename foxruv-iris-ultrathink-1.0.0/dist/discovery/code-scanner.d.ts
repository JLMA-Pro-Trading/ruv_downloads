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
import type { DiscoveredExpert, ScanResult, ScannerOptions } from './types.js';
/**
 * Default scanner options
 */
export declare const DEFAULT_SCANNER_OPTIONS: Required<ScannerOptions>;
/**
 * Code scanner class
 *
 * Main entry point for scanning projects and discovering AI/ML experts
 */
export declare class CodeScanner {
    private options;
    private extractor;
    constructor(options?: ScannerOptions);
    /**
     * Scan entire project directory for experts
     */
    scanProject(projectPath: string): Promise<ScanResult>;
    /**
     * Scan single file for experts
     */
    scanFile(filePath: string, projectPath: string): Promise<DiscoveredExpert[]>;
    /**
     * Find all source files in project
     */
    private findSourceFiles;
    /**
     * Get file extensions to scan based on selected languages
     */
    private getExtensions;
    /**
     * Detect programming language from file path
     */
    private detectLanguage;
    /**
     * Get scanner statistics
     */
    getStatistics(result: ScanResult): {
        filesPerLanguage: Record<string, number>;
        expertsPerFile: number;
        avgConfidence: number;
        topExperts: DiscoveredExpert[];
    };
    /**
     * Export results to JSON
     */
    exportToJson(result: ScanResult, outputPath: string): void;
}
//# sourceMappingURL=code-scanner.d.ts.map
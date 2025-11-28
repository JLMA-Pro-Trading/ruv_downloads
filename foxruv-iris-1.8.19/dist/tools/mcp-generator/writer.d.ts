/**
 * File Writer
 * Safely writes generated wrapper files with proper error handling
 */
import { GeneratorResult } from './types.js';
export interface WriteOptions {
    dryRun?: boolean;
    force?: boolean;
    createBackup?: boolean;
}
export declare class FileWriter {
    private filesGenerated;
    private filesUpdated;
    private errors;
    private warnings;
    /**
     * Write a file with safety checks
     */
    writeFile(filePath: string, content: string, options?: WriteOptions): Promise<void>;
    /**
     * Write multiple files
     */
    writeFiles(files: Array<{
        path: string;
        content: string;
    }>, options?: WriteOptions): Promise<void>;
    /**
     * Create directory structure
     */
    createDirectory(dirPath: string, options?: WriteOptions): Promise<void>;
    /**
     * Create backup of existing file
     */
    private createBackup;
    /**
     * Ensure directory exists
     */
    private ensureDir;
    /**
     * Check if file exists
     */
    private fileExists;
    /**
     * Get generation result
     */
    getResult(dryRun: boolean): GeneratorResult;
    /**
     * Reset writer state
     */
    reset(): void;
    /**
     * Format result for display
     */
    static formatResult(result: GeneratorResult): string;
}
//# sourceMappingURL=writer.d.ts.map
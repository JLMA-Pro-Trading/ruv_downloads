/**
 * File Writer
 * Safely writes generated wrapper files with proper error handling
 *
 * @package ultrathink
 * @standalone Fully standalone implementation
 */
import { GeneratorResult, TrackingRecord, CoordinationEvent } from './types.js';
export interface WriteOptions {
    dryRun?: boolean;
    force?: boolean;
    createBackup?: boolean;
    /** Enable coordination events */
    enableCoordination?: boolean;
    /** Agent ID for tracking */
    agentId?: string;
    /** Coordination event handler */
    onCoordinationEvent?: (event: CoordinationEvent) => void | Promise<void>;
    /** Tracking record handler */
    onTrackingRecord?: (record: TrackingRecord) => void | Promise<void>;
}
export declare class FileWriter {
    private filesGenerated;
    private filesUpdated;
    private errors;
    private warnings;
    private options;
    /**
     * Set global options for the writer
     */
    setOptions(options: WriteOptions): void;
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
     * Emit coordination event for agentic-flow integration
     */
    private emitCoordination;
    /**
     * Emit tracking record for agentdb integration
     */
    private emitTracking;
    /**
     * Format result for display
     */
    static formatResult(result: GeneratorResult): string;
}
//# sourceMappingURL=writer.d.ts.map
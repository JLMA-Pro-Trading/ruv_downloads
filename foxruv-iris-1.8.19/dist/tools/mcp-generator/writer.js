/**
 * File Writer
 * Safely writes generated wrapper files with proper error handling
 */
import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { dirname } from 'path';
export class FileWriter {
    filesGenerated = [];
    filesUpdated = [];
    errors = [];
    warnings = [];
    /**
     * Write a file with safety checks
     */
    async writeFile(filePath, content, options = {}) {
        const { dryRun = false, force = false, createBackup = true } = options;
        try {
            // Check if file exists
            const exists = await this.fileExists(filePath);
            if (exists && !force) {
                this.warnings.push(`File already exists: ${filePath} (use --force to overwrite)`);
                return;
            }
            // Dry run mode
            if (dryRun) {
                if (exists) {
                    this.filesUpdated.push(filePath);
                }
                else {
                    this.filesGenerated.push(filePath);
                }
                return;
            }
            // Create backup if updating existing file
            if (exists && createBackup) {
                await this.createBackup(filePath);
            }
            // Ensure directory exists
            await this.ensureDir(dirname(filePath));
            // Write the file
            await writeFile(filePath, content, 'utf-8');
            if (exists) {
                this.filesUpdated.push(filePath);
            }
            else {
                this.filesGenerated.push(filePath);
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errors.push(`Failed to write ${filePath}: ${message}`);
        }
    }
    /**
     * Write multiple files
     */
    async writeFiles(files, options = {}) {
        for (const file of files) {
            await this.writeFile(file.path, file.content, options);
        }
    }
    /**
     * Create directory structure
     */
    async createDirectory(dirPath, options = {}) {
        if (options.dryRun) {
            return;
        }
        try {
            await this.ensureDir(dirPath);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.errors.push(`Failed to create directory ${dirPath}: ${message}`);
        }
    }
    /**
     * Create backup of existing file
     */
    async createBackup(filePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `${filePath}.backup-${timestamp}`;
        try {
            const content = await readFile(filePath, 'utf-8');
            await writeFile(backupPath, content, 'utf-8');
            this.warnings.push(`Created backup: ${backupPath}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.warnings.push(`Failed to create backup for ${filePath}: ${message}`);
        }
    }
    /**
     * Ensure directory exists
     */
    async ensureDir(dirPath) {
        try {
            await mkdir(dirPath, { recursive: true });
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
        }
    }
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Get generation result
     */
    getResult(dryRun) {
        return {
            success: this.errors.length === 0,
            filesGenerated: this.filesGenerated,
            filesUpdated: this.filesUpdated,
            errors: this.errors,
            warnings: this.warnings,
            dryRun,
        };
    }
    /**
     * Reset writer state
     */
    reset() {
        this.filesGenerated = [];
        this.filesUpdated = [];
        this.errors = [];
        this.warnings = [];
    }
    /**
     * Format result for display
     */
    static formatResult(result) {
        const lines = [];
        if (result.dryRun) {
            lines.push('\n🔍 DRY RUN MODE - No files were written\n');
        }
        if (result.filesGenerated.length > 0) {
            lines.push('✨ Files to be generated:');
            result.filesGenerated.forEach(f => lines.push(`  + ${f}`));
            lines.push('');
        }
        if (result.filesUpdated.length > 0) {
            lines.push('📝 Files to be updated:');
            result.filesUpdated.forEach(f => lines.push(`  ~ ${f}`));
            lines.push('');
        }
        if (result.warnings.length > 0) {
            lines.push('⚠️  Warnings:');
            result.warnings.forEach(w => lines.push(`  ! ${w}`));
            lines.push('');
        }
        if (result.errors.length > 0) {
            lines.push('❌ Errors:');
            result.errors.forEach(e => lines.push(`  ✗ ${e}`));
            lines.push('');
        }
        if (result.success && !result.dryRun) {
            const total = result.filesGenerated.length + result.filesUpdated.length;
            lines.push(`\n✅ Successfully generated ${total} file(s)\n`);
        }
        return lines.join('\n');
    }
}

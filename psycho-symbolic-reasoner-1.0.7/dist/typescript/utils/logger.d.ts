import winston from 'winston';
import { LoggingConfig } from '../types/config.js';
/**
 * Logger utility class for structured logging
 */
export declare class Logger {
    private static instance;
    private static _config;
    /**
     * Initialize the logger with configuration
     */
    static initialize(config: LoggingConfig): void;
    /**
     * Get the logger instance
     */
    static getInstance(): winston.Logger;
    /**
     * Parse size string to bytes
     */
    private static parseSize;
    /**
     * Create a child logger with additional metadata
     */
    static child(meta: Record<string, any>): winston.Logger;
    /**
     * Log error with stack trace
     */
    static error(message: string, error?: Error | unknown, meta?: Record<string, any>): void;
    /**
     * Log warning
     */
    static warn(message: string, meta?: Record<string, any>): void;
    /**
     * Log info
     */
    static info(message: string, meta?: Record<string, any>): void;
    /**
     * Log debug
     */
    static debug(message: string, meta?: Record<string, any>): void;
    /**
     * Log with custom level
     */
    static log(level: string, message: string, meta?: Record<string, any>): void;
    /**
     * Flush logs and close transports
     */
    static close(): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map
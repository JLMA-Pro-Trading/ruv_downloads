import winston from 'winston';
/**
 * Logger utility class for structured logging
 */
export class Logger {
    static instance;
    static _config;
    /**
     * Initialize the logger with configuration
     */
    static initialize(config) {
        Logger._config = config;
        const transports = [];
        // Console transport
        if (Logger._config.console) {
            transports.push(new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    let log = `${timestamp} [${level}]: ${message}`;
                    if (Object.keys(meta).length > 0) {
                        log += `\\n${JSON.stringify(meta, null, 2)}`;
                    }
                    return log;
                }))
            }));
        }
        // File transport
        if (Logger._config.file) {
            transports.push(new winston.transports.File({
                filename: Logger._config.file,
                format: winston.format.combine(winston.format.timestamp(), Logger._config.json ? winston.format.json() : winston.format.simple()),
                maxsize: Logger.parseSize(Logger._config.maxSize),
                maxFiles: Logger._config.maxFiles
            }));
        }
        Logger.instance = winston.createLogger({
            level: Logger._config.level,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            transports,
            exitOnError: false
        });
    }
    /**
     * Get the logger instance
     */
    static getInstance() {
        if (!Logger.instance) {
            throw new Error('Logger not initialized. Call Logger.initialize() first.');
        }
        return Logger.instance;
    }
    /**
     * Parse size string to bytes
     */
    static parseSize(size) {
        const units = {
            'b': 1,
            'k': 1024,
            'm': 1024 * 1024,
            'g': 1024 * 1024 * 1024
        };
        const match = size.toLowerCase().match(/^(\d+)([kmg]?)b?$/);
        if (!match) {
            throw new Error(`Invalid size format: ${size}`);
        }
        const num = match[1];
        const unit = match[2] || 'b';
        const unitKey = unit;
        if (!num || !units[unitKey]) {
            throw new Error(`Invalid size format: ${size}`);
        }
        return parseInt(num, 10) * units[unitKey];
    }
    /**
     * Create a child logger with additional metadata
     */
    static child(meta) {
        return Logger.getInstance().child(meta);
    }
    /**
     * Log error with stack trace
     */
    static error(message, error, meta) {
        const logger = Logger.getInstance();
        if (error instanceof Error) {
            logger.error(message, { ...meta, error: error.message, stack: error.stack });
        }
        else if (error) {
            logger.error(message, { ...meta, error });
        }
        else {
            logger.error(message, meta);
        }
    }
    /**
     * Log warning
     */
    static warn(message, meta) {
        Logger.getInstance().warn(message, meta);
    }
    /**
     * Log info
     */
    static info(message, meta) {
        Logger.getInstance().info(message, meta);
    }
    /**
     * Log debug
     */
    static debug(message, meta) {
        Logger.getInstance().debug(message, meta);
    }
    /**
     * Log with custom level
     */
    static log(level, message, meta) {
        Logger.getInstance().log(level, message, meta);
    }
    /**
     * Flush logs and close transports
     */
    static async close() {
        return new Promise((resolve) => {
            if (Logger.instance) {
                Logger.instance.end();
                resolve();
            }
            else {
                resolve();
            }
        });
    }
}
//# sourceMappingURL=logger.js.map
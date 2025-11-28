import { z } from 'zod';
/**
 * Transport types supported by the MCP server
 */
export const TransportType = z.enum(['stdio', 'sse', 'http']);
/**
 * Log levels for the application
 */
export const LogLevel = z.enum(['error', 'warn', 'info', 'debug', 'silly']);
/**
 * Knowledge base configuration schema
 */
export const KnowledgeBaseConfig = z.object({
    file: z.string().optional(),
    autoSave: z.boolean().default(true),
    saveInterval: z.number().min(1000).default(30000), // 30 seconds
    format: z.enum(['json', 'yaml']).default('json'),
    compression: z.boolean().default(false)
});
/**
 * Server configuration schema
 */
export const ServerConfig = z.object({
    transport: TransportType.default('stdio'),
    port: z.number().min(1).max(65535).default(3000),
    host: z.string().default('localhost'),
    cors: z.boolean().default(true),
    maxConnections: z.number().min(1).default(100),
    timeout: z.number().min(1000).default(30000) // 30 seconds
});
/**
 * Logging configuration schema
 */
export const LoggingConfig = z.object({
    level: LogLevel.default('info'),
    file: z.string().optional(),
    console: z.boolean().default(true),
    json: z.boolean().default(false),
    timestamp: z.boolean().default(true),
    maxSize: z.string().default('10m'),
    maxFiles: z.number().min(1).default(5)
});
/**
 * Performance configuration schema
 */
export const PerformanceConfig = z.object({
    maxMemoryUsage: z.string().default('512m'),
    gcInterval: z.number().min(1000).default(60000), // 1 minute
    enableProfiling: z.boolean().default(false),
    metricsInterval: z.number().min(1000).default(10000) // 10 seconds
});
/**
 * Security configuration schema
 */
export const SecurityConfig = z.object({
    enableAuth: z.boolean().default(false),
    apiKey: z.string().optional(),
    rateLimit: z.object({
        enabled: z.boolean().default(true),
        windowMs: z.number().min(1000).default(60000), // 1 minute
        maxRequests: z.number().min(1).default(100)
    }).default({}),
    allowedOrigins: z.array(z.string()).default(['*'])
});
/**
 * Main application configuration schema
 */
export const AppConfig = z.object({
    server: ServerConfig.default({}),
    knowledgeBase: KnowledgeBaseConfig.default({}),
    logging: LoggingConfig.default({}),
    performance: PerformanceConfig.default({}),
    security: SecurityConfig.default({})
});
/**
 * CLI arguments schema
 */
export const CLIArgs = z.object({
    knowledgeBase: z.string().optional(),
    transport: TransportType.optional(),
    port: z.number().min(1).max(65535).optional(),
    config: z.string().optional(),
    host: z.string().optional(),
    logLevel: LogLevel.optional(),
    logFile: z.string().optional(),
    help: z.boolean().default(false),
    version: z.boolean().default(false),
    verbose: z.boolean().default(false),
    quiet: z.boolean().default(false)
});
//# sourceMappingURL=config.js.map
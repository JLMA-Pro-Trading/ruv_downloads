import { z } from 'zod';
/**
 * Transport types supported by the MCP server
 */
export declare const TransportType: z.ZodEnum<["stdio", "sse", "http"]>;
export type TransportType = z.infer<typeof TransportType>;
/**
 * Log levels for the application
 */
export declare const LogLevel: z.ZodEnum<["error", "warn", "info", "debug", "silly"]>;
export type LogLevel = z.infer<typeof LogLevel>;
/**
 * Knowledge base configuration schema
 */
export declare const KnowledgeBaseConfig: z.ZodObject<{
    file: z.ZodOptional<z.ZodString>;
    autoSave: z.ZodDefault<z.ZodBoolean>;
    saveInterval: z.ZodDefault<z.ZodNumber>;
    format: z.ZodDefault<z.ZodEnum<["json", "yaml"]>>;
    compression: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    autoSave: boolean;
    saveInterval: number;
    format: "json" | "yaml";
    compression: boolean;
    file?: string | undefined;
}, {
    file?: string | undefined;
    autoSave?: boolean | undefined;
    saveInterval?: number | undefined;
    format?: "json" | "yaml" | undefined;
    compression?: boolean | undefined;
}>;
export type KnowledgeBaseConfig = z.infer<typeof KnowledgeBaseConfig>;
/**
 * Server configuration schema
 */
export declare const ServerConfig: z.ZodObject<{
    transport: z.ZodDefault<z.ZodEnum<["stdio", "sse", "http"]>>;
    port: z.ZodDefault<z.ZodNumber>;
    host: z.ZodDefault<z.ZodString>;
    cors: z.ZodDefault<z.ZodBoolean>;
    maxConnections: z.ZodDefault<z.ZodNumber>;
    timeout: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    transport: "stdio" | "sse" | "http";
    port: number;
    host: string;
    cors: boolean;
    maxConnections: number;
    timeout: number;
}, {
    transport?: "stdio" | "sse" | "http" | undefined;
    port?: number | undefined;
    host?: string | undefined;
    cors?: boolean | undefined;
    maxConnections?: number | undefined;
    timeout?: number | undefined;
}>;
export type ServerConfig = z.infer<typeof ServerConfig>;
/**
 * Logging configuration schema
 */
export declare const LoggingConfig: z.ZodObject<{
    level: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "debug", "silly"]>>;
    file: z.ZodOptional<z.ZodString>;
    console: z.ZodDefault<z.ZodBoolean>;
    json: z.ZodDefault<z.ZodBoolean>;
    timestamp: z.ZodDefault<z.ZodBoolean>;
    maxSize: z.ZodDefault<z.ZodString>;
    maxFiles: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    json: boolean;
    level: "error" | "warn" | "info" | "debug" | "silly";
    console: boolean;
    timestamp: boolean;
    maxSize: string;
    maxFiles: number;
    file?: string | undefined;
}, {
    file?: string | undefined;
    json?: boolean | undefined;
    level?: "error" | "warn" | "info" | "debug" | "silly" | undefined;
    console?: boolean | undefined;
    timestamp?: boolean | undefined;
    maxSize?: string | undefined;
    maxFiles?: number | undefined;
}>;
export type LoggingConfig = z.infer<typeof LoggingConfig>;
/**
 * Performance configuration schema
 */
export declare const PerformanceConfig: z.ZodObject<{
    maxMemoryUsage: z.ZodDefault<z.ZodString>;
    gcInterval: z.ZodDefault<z.ZodNumber>;
    enableProfiling: z.ZodDefault<z.ZodBoolean>;
    metricsInterval: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    maxMemoryUsage: string;
    gcInterval: number;
    enableProfiling: boolean;
    metricsInterval: number;
}, {
    maxMemoryUsage?: string | undefined;
    gcInterval?: number | undefined;
    enableProfiling?: boolean | undefined;
    metricsInterval?: number | undefined;
}>;
export type PerformanceConfig = z.infer<typeof PerformanceConfig>;
/**
 * Security configuration schema
 */
export declare const SecurityConfig: z.ZodObject<{
    enableAuth: z.ZodDefault<z.ZodBoolean>;
    apiKey: z.ZodOptional<z.ZodString>;
    rateLimit: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        windowMs: z.ZodDefault<z.ZodNumber>;
        maxRequests: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
    }, {
        enabled?: boolean | undefined;
        windowMs?: number | undefined;
        maxRequests?: number | undefined;
    }>>;
    allowedOrigins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    enableAuth: boolean;
    rateLimit: {
        enabled: boolean;
        windowMs: number;
        maxRequests: number;
    };
    allowedOrigins: string[];
    apiKey?: string | undefined;
}, {
    enableAuth?: boolean | undefined;
    apiKey?: string | undefined;
    rateLimit?: {
        enabled?: boolean | undefined;
        windowMs?: number | undefined;
        maxRequests?: number | undefined;
    } | undefined;
    allowedOrigins?: string[] | undefined;
}>;
export type SecurityConfig = z.infer<typeof SecurityConfig>;
/**
 * Main application configuration schema
 */
export declare const AppConfig: z.ZodObject<{
    server: z.ZodDefault<z.ZodObject<{
        transport: z.ZodDefault<z.ZodEnum<["stdio", "sse", "http"]>>;
        port: z.ZodDefault<z.ZodNumber>;
        host: z.ZodDefault<z.ZodString>;
        cors: z.ZodDefault<z.ZodBoolean>;
        maxConnections: z.ZodDefault<z.ZodNumber>;
        timeout: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        transport: "stdio" | "sse" | "http";
        port: number;
        host: string;
        cors: boolean;
        maxConnections: number;
        timeout: number;
    }, {
        transport?: "stdio" | "sse" | "http" | undefined;
        port?: number | undefined;
        host?: string | undefined;
        cors?: boolean | undefined;
        maxConnections?: number | undefined;
        timeout?: number | undefined;
    }>>;
    knowledgeBase: z.ZodDefault<z.ZodObject<{
        file: z.ZodOptional<z.ZodString>;
        autoSave: z.ZodDefault<z.ZodBoolean>;
        saveInterval: z.ZodDefault<z.ZodNumber>;
        format: z.ZodDefault<z.ZodEnum<["json", "yaml"]>>;
        compression: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        autoSave: boolean;
        saveInterval: number;
        format: "json" | "yaml";
        compression: boolean;
        file?: string | undefined;
    }, {
        file?: string | undefined;
        autoSave?: boolean | undefined;
        saveInterval?: number | undefined;
        format?: "json" | "yaml" | undefined;
        compression?: boolean | undefined;
    }>>;
    logging: z.ZodDefault<z.ZodObject<{
        level: z.ZodDefault<z.ZodEnum<["error", "warn", "info", "debug", "silly"]>>;
        file: z.ZodOptional<z.ZodString>;
        console: z.ZodDefault<z.ZodBoolean>;
        json: z.ZodDefault<z.ZodBoolean>;
        timestamp: z.ZodDefault<z.ZodBoolean>;
        maxSize: z.ZodDefault<z.ZodString>;
        maxFiles: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        json: boolean;
        level: "error" | "warn" | "info" | "debug" | "silly";
        console: boolean;
        timestamp: boolean;
        maxSize: string;
        maxFiles: number;
        file?: string | undefined;
    }, {
        file?: string | undefined;
        json?: boolean | undefined;
        level?: "error" | "warn" | "info" | "debug" | "silly" | undefined;
        console?: boolean | undefined;
        timestamp?: boolean | undefined;
        maxSize?: string | undefined;
        maxFiles?: number | undefined;
    }>>;
    performance: z.ZodDefault<z.ZodObject<{
        maxMemoryUsage: z.ZodDefault<z.ZodString>;
        gcInterval: z.ZodDefault<z.ZodNumber>;
        enableProfiling: z.ZodDefault<z.ZodBoolean>;
        metricsInterval: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        maxMemoryUsage: string;
        gcInterval: number;
        enableProfiling: boolean;
        metricsInterval: number;
    }, {
        maxMemoryUsage?: string | undefined;
        gcInterval?: number | undefined;
        enableProfiling?: boolean | undefined;
        metricsInterval?: number | undefined;
    }>>;
    security: z.ZodDefault<z.ZodObject<{
        enableAuth: z.ZodDefault<z.ZodBoolean>;
        apiKey: z.ZodOptional<z.ZodString>;
        rateLimit: z.ZodDefault<z.ZodObject<{
            enabled: z.ZodDefault<z.ZodBoolean>;
            windowMs: z.ZodDefault<z.ZodNumber>;
            maxRequests: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            windowMs: number;
            maxRequests: number;
        }, {
            enabled?: boolean | undefined;
            windowMs?: number | undefined;
            maxRequests?: number | undefined;
        }>>;
        allowedOrigins: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        enableAuth: boolean;
        rateLimit: {
            enabled: boolean;
            windowMs: number;
            maxRequests: number;
        };
        allowedOrigins: string[];
        apiKey?: string | undefined;
    }, {
        enableAuth?: boolean | undefined;
        apiKey?: string | undefined;
        rateLimit?: {
            enabled?: boolean | undefined;
            windowMs?: number | undefined;
            maxRequests?: number | undefined;
        } | undefined;
        allowedOrigins?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    server: {
        transport: "stdio" | "sse" | "http";
        port: number;
        host: string;
        cors: boolean;
        maxConnections: number;
        timeout: number;
    };
    knowledgeBase: {
        autoSave: boolean;
        saveInterval: number;
        format: "json" | "yaml";
        compression: boolean;
        file?: string | undefined;
    };
    logging: {
        json: boolean;
        level: "error" | "warn" | "info" | "debug" | "silly";
        console: boolean;
        timestamp: boolean;
        maxSize: string;
        maxFiles: number;
        file?: string | undefined;
    };
    performance: {
        maxMemoryUsage: string;
        gcInterval: number;
        enableProfiling: boolean;
        metricsInterval: number;
    };
    security: {
        enableAuth: boolean;
        rateLimit: {
            enabled: boolean;
            windowMs: number;
            maxRequests: number;
        };
        allowedOrigins: string[];
        apiKey?: string | undefined;
    };
}, {
    server?: {
        transport?: "stdio" | "sse" | "http" | undefined;
        port?: number | undefined;
        host?: string | undefined;
        cors?: boolean | undefined;
        maxConnections?: number | undefined;
        timeout?: number | undefined;
    } | undefined;
    knowledgeBase?: {
        file?: string | undefined;
        autoSave?: boolean | undefined;
        saveInterval?: number | undefined;
        format?: "json" | "yaml" | undefined;
        compression?: boolean | undefined;
    } | undefined;
    logging?: {
        file?: string | undefined;
        json?: boolean | undefined;
        level?: "error" | "warn" | "info" | "debug" | "silly" | undefined;
        console?: boolean | undefined;
        timestamp?: boolean | undefined;
        maxSize?: string | undefined;
        maxFiles?: number | undefined;
    } | undefined;
    performance?: {
        maxMemoryUsage?: string | undefined;
        gcInterval?: number | undefined;
        enableProfiling?: boolean | undefined;
        metricsInterval?: number | undefined;
    } | undefined;
    security?: {
        enableAuth?: boolean | undefined;
        apiKey?: string | undefined;
        rateLimit?: {
            enabled?: boolean | undefined;
            windowMs?: number | undefined;
            maxRequests?: number | undefined;
        } | undefined;
        allowedOrigins?: string[] | undefined;
    } | undefined;
}>;
export type AppConfig = z.infer<typeof AppConfig>;
/**
 * CLI arguments schema
 */
export declare const CLIArgs: z.ZodObject<{
    knowledgeBase: z.ZodOptional<z.ZodString>;
    transport: z.ZodOptional<z.ZodEnum<["stdio", "sse", "http"]>>;
    port: z.ZodOptional<z.ZodNumber>;
    config: z.ZodOptional<z.ZodString>;
    host: z.ZodOptional<z.ZodString>;
    logLevel: z.ZodOptional<z.ZodEnum<["error", "warn", "info", "debug", "silly"]>>;
    logFile: z.ZodOptional<z.ZodString>;
    help: z.ZodDefault<z.ZodBoolean>;
    version: z.ZodDefault<z.ZodBoolean>;
    verbose: z.ZodDefault<z.ZodBoolean>;
    quiet: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    help: boolean;
    version: boolean;
    verbose: boolean;
    quiet: boolean;
    transport?: "stdio" | "sse" | "http" | undefined;
    port?: number | undefined;
    host?: string | undefined;
    knowledgeBase?: string | undefined;
    config?: string | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | "silly" | undefined;
    logFile?: string | undefined;
}, {
    transport?: "stdio" | "sse" | "http" | undefined;
    port?: number | undefined;
    host?: string | undefined;
    knowledgeBase?: string | undefined;
    config?: string | undefined;
    logLevel?: "error" | "warn" | "info" | "debug" | "silly" | undefined;
    logFile?: string | undefined;
    help?: boolean | undefined;
    version?: boolean | undefined;
    verbose?: boolean | undefined;
    quiet?: boolean | undefined;
}>;
export type CLIArgs = z.infer<typeof CLIArgs>;
//# sourceMappingURL=config.d.ts.map
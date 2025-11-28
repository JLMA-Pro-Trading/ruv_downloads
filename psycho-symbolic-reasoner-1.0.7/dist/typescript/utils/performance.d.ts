import { PerformanceConfig } from '../types/config.js';
/**
 * Performance monitoring and optimization utilities
 */
export declare class PerformanceMonitor {
    private static instance;
    private config;
    private metrics;
    private gcInterval?;
    private metricsInterval?;
    private constructor();
    /**
     * Initialize performance monitor
     */
    static initialize(config: PerformanceConfig): PerformanceMonitor;
    /**
     * Get performance monitor instance
     */
    static getInstance(): PerformanceMonitor;
    /**
     * Start performance monitoring
     */
    private startMonitoring;
    /**
     * Setup memory monitoring
     */
    private setupMemoryMonitoring;
    /**
     * Collect performance metrics
     */
    private collectMetrics;
    /**
     * Measure event loop delay
     */
    private measureEventLoopDelay;
    /**
     * Parse memory size string to bytes
     */
    private parseMemorySize;
    /**
     * Format bytes to human readable string
     */
    private formatBytes;
    /**
     * Get current metrics
     */
    getCurrentMetrics(): any;
    /**
     * Get performance summary
     */
    getPerformanceSummary(): any;
    /**
     * Format uptime to human readable string
     */
    private formatUptime;
    /**
     * Stop performance monitoring
     */
    stop(): void;
    /**
     * Start timing an operation
     */
    startTimer(name: string): () => number;
    /**
     * Measure async operation performance
     */
    measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T>;
}
//# sourceMappingURL=performance.d.ts.map
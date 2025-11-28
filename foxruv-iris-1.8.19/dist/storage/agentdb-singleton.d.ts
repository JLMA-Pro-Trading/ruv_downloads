/**
 * AgentDB Singleton Manager
 *
 * Provides centralized management of AgentDB database instances to prevent
 * duplicate database connections and reduce memory usage.
 *
 * Benefits:
 * - Single sql.js WASM load (~1MB) instead of multiple
 * - Shared connection pool across services
 * - No initialization races
 * - Consistent state across services
 * - 80-90% reduction in database connections
 *
 * @module agentdb-singleton
 */
/**
 * Singleton manager for AgentDB instances
 *
 * Ensures only one database instance per unique path across the entire application.
 * Handles async initialization, prevents race conditions, and provides centralized cleanup.
 */
export declare class AgentDBSingleton {
    /** Map of database path -> database instance */
    private static instances;
    /** Map of database path -> initialization promise (prevents concurrent init) */
    private static initPromises;
    /**
     * Get or create database instance for the specified path
     *
     * If an instance already exists for this path, returns it immediately.
     * If initialization is in progress, waits for it to complete.
     * Otherwise, creates a new instance.
     *
     * @param dbPath - Path to the database file
     * @returns Promise resolving to database instance, or null if initialization fails
     *
     * @example
     * ```typescript
     * const db = await AgentDBSingleton.getInstance('./data/mydb.db')
     * if (db) {
     *   // Use database
     * }
     * ```
     */
    static getInstance(dbPath: string): Promise<any>;
    /**
     * Check if an instance exists for the given path
     *
     * @param dbPath - Path to check
     * @returns True if instance exists
     */
    static has(dbPath: string): boolean;
    /**
     * Get the number of active database instances
     *
     * @returns Count of active instances
     */
    static getInstanceCount(): number;
    /**
     * Close a specific database instance
     *
     * @param dbPath - Path of the database to close
     */
    static close(dbPath: string): void;
    /**
     * Close all database instances and clear the singleton cache
     *
     * Should be called on application shutdown to ensure clean resource cleanup.
     *
     * @example
     * ```typescript
     * // In application shutdown handler
     * process.on('SIGTERM', () => {
     *   AgentDBSingleton.closeAll()
     *   process.exit(0)
     * })
     * ```
     */
    static closeAll(): void;
    /**
     * Get list of active database paths
     *
     * Useful for debugging and monitoring
     *
     * @returns Array of active database paths
     */
    static getActivePaths(): string[];
    /**
     * Reset the singleton state (primarily for testing)
     *
     * Warning: This forcibly clears all instances without closing them.
     * Use closeAll() for normal cleanup.
     */
    static reset(): void;
}
//# sourceMappingURL=agentdb-singleton.d.ts.map
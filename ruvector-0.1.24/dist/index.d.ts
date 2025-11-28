/**
 * ruvector - High-performance vector database for Node.js
 *
 * This package automatically detects and uses the best available implementation:
 * 1. Native (Rust-based, fastest) - if available for your platform
 * 2. WASM (WebAssembly, universal fallback) - works everywhere
 */
export * from './types';
declare let implementation: any;
/**
 * Get the current implementation type
 */
export declare function getImplementationType(): 'native' | 'wasm';
/**
 * Check if native implementation is being used
 */
export declare function isNative(): boolean;
/**
 * Check if WASM implementation is being used
 */
export declare function isWasm(): boolean;
/**
 * Get version information
 */
export declare function getVersion(): {
    version: string;
    implementation: string;
};
export declare const VectorDB: any;
export default implementation;
//# sourceMappingURL=index.d.ts.map
"use strict";
/**
 * ruvector - High-performance vector database for Node.js
 *
 * This package automatically detects and uses the best available implementation:
 * 1. Native (Rust-based, fastest) - if available for your platform
 * 2. WASM (WebAssembly, universal fallback) - works everywhere
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorDB = void 0;
exports.getImplementationType = getImplementationType;
exports.isNative = isNative;
exports.isWasm = isWasm;
exports.getVersion = getVersion;
__exportStar(require("./types"), exports);
let implementation;
let implementationType = 'wasm';
try {
    // Try to load native module first
    implementation = require('@ruvector/core');
    implementationType = 'native';
    // Verify it's actually working
    if (typeof implementation.VectorDB !== 'function') {
        throw new Error('Native module loaded but VectorDB not found');
    }
}
catch (e) {
    // No WASM fallback available yet
    throw new Error(`Failed to load ruvector native module.\n` +
        `Error: ${e.message}\n` +
        `\nSupported platforms:\n` +
        `- Linux x64/ARM64\n` +
        `- macOS Intel/Apple Silicon\n` +
        `- Windows x64\n` +
        `\nIf you're on a supported platform, try:\n` +
        `  npm install --force @ruvector/core`);
}
/**
 * Get the current implementation type
 */
function getImplementationType() {
    return implementationType;
}
/**
 * Check if native implementation is being used
 */
function isNative() {
    return implementationType === 'native';
}
/**
 * Check if WASM implementation is being used
 */
function isWasm() {
    return implementationType === 'wasm';
}
/**
 * Get version information
 */
function getVersion() {
    const pkg = require('../package.json');
    return {
        version: pkg.version,
        implementation: implementationType
    };
}
// Export the VectorDB class
exports.VectorDB = implementation.VectorDB;
// Export everything from the implementation
exports.default = implementation;

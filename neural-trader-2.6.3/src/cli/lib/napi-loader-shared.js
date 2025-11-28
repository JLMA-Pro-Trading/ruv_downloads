/**
 * Shared NAPI Loader Utility
 * Provides a unified interface for loading native bindings
 */

const path = require('path');

/**
 * Load native binding with context-aware error handling
 * @param {string} basePath - Base path for loading (usually '.' or __dirname)
 * @param {string} context - Loading context for error messages (e.g., 'Main', 'CLI', 'MCP')
 * @returns {Object} Native bindings object
 * @throws {Error} If bindings cannot be loaded
 */
function loadNativeBinding(basePath, context = 'Unknown') {
  const attempts = [];

  // Attempt 1: Load from neural-trader-rust directory (development/source)
  try {
    const napiPath = path.join(basePath, 'neural-trader-rust');
    const bindings = require(napiPath);
    return bindings;
  } catch (error) {
    attempts.push({ path: 'neural-trader-rust', error: error.message });
  }

  // Attempt 2: Load from installed package (node_modules)
  try {
    const bindings = require('neural-trader-rust');
    return bindings;
  } catch (error) {
    attempts.push({ path: 'neural-trader-rust (node_modules)', error: error.message });
  }

  // Attempt 3: Try relative path from node_modules structure
  try {
    const bindings = require(path.join(__dirname, '../../../neural-trader-rust'));
    return bindings;
  } catch (error) {
    attempts.push({ path: '../../../neural-trader-rust', error: error.message });
  }

  // All attempts failed - throw detailed error
  const errorDetails = attempts.map(a => `  - ${a.path}: ${a.error}`).join('\n');
  throw new Error(
    `[${context}] Failed to load native bindings after ${attempts.length} attempts:\n${errorDetails}\n\n` +
    `This usually means:\n` +
    `1. The native bindings are not built (run: npm run build:release)\n` +
    `2. You're on an unsupported platform (requires x64/arm64, Linux/Mac/Windows)\n` +
    `3. The package structure is incomplete\n\n` +
    `Platform: ${process.platform}-${process.arch}\n` +
    `Node: ${process.version}`
  );
}

/**
 * Check if native bindings are available without throwing
 * @param {string} basePath - Base path for loading
 * @returns {boolean} True if bindings can be loaded
 */
function checkNativeBinding(basePath = '.') {
  try {
    loadNativeBinding(basePath, 'Check');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  loadNativeBinding,
  checkNativeBinding
};

/**
 * MCP Server Wrapper for NAPI Bindings
 * Provides validated interface to Rust MCP server control
 * Version: 2.5.0 - Refactored to use shared utilities
 */

const { loadNativeBinding } = require('./napi-loader-shared');
const {
  validateRequiredObject,
  validateEnum,
  validateRequiredString,
  validateRequiredNumber
} = require('./validation-utils');

// Load native binding using shared loader
const napi = loadNativeBinding('../../../', 'MCP');

/**
 * Valid transport types for MCP server
 */
const VALID_TRANSPORTS = ['stdio', 'http', 'websocket'];

/**
 * Default configuration values
 */
const DEFAULTS = {
  enableLogging: false,
  timeoutMs: 30000,
  host: 'localhost'
};

/**
 * Validate server configuration
 * @param {Object} config - Server configuration
 * @private
 */
function validateServerConfig(config) {
  validateRequiredObject(config, 'config');
  validateEnum(config.transport, 'config.transport', VALID_TRANSPORTS);

  if (['http', 'websocket'].includes(config.transport)) {
    validateRequiredNumber(config.port, 'config.port', { min: 1, max: 65535, integer: true });
  }
}

/**
 * Build normalized server configuration
 * @param {Object} config - Raw configuration
 * @returns {Object} Normalized configuration
 * @private
 */
function buildServerConfig(config) {
  const normalized = {
    transport: config.transport,
    enableLogging: config.enable_logging ?? DEFAULTS.enableLogging,
    timeoutMs: config.timeout_ms || DEFAULTS.timeoutMs
  };

  // Optional fields
  if (config.port !== undefined && config.port !== null) {
    normalized.port = config.port;
  }
  if (config.host !== undefined && config.host !== null) {
    normalized.host = config.host;
  }

  return normalized;
}

/**
 * Start MCP server
 * @param {Object} config - Server configuration
 * @param {string} config.transport - Transport type ('stdio', 'http', 'websocket')
 * @param {number} [config.port] - Port for http/websocket
 * @param {string} [config.host] - Host for http/websocket
 * @param {boolean} [config.enable_logging=false] - Enable server logging
 * @param {number} [config.timeout_ms=30000] - Request timeout in ms
 * @returns {Promise<string>} Server ID
 */
async function startServer(config) {
  validateServerConfig(config);
  const serverConfig = buildServerConfig(config);
  return await napi.mcpStartServer(serverConfig);
}

/**
 * Stop MCP server
 * @returns {Promise<boolean>} True if stopped successfully
 */
async function stopServer() {
  return await napi.mcpStopServer();
}

/**
 * Get MCP server status
 * @returns {Promise<Object>} Server status object
 */
async function getServerStatus() {
  return await napi.mcpGetServerStatus();
}

/**
 * List available MCP tools
 * @returns {Promise<Array>} Array of tool definitions
 */
async function listTools() {
  return await napi.mcpListTools();
}

/**
 * Call MCP tool
 * @param {string} toolName - Name of the tool to call
 * @param {Object|string} params - Tool parameters (object or JSON string)
 * @returns {Promise<Object>} Tool execution result
 */
async function callTool(toolName, params) {
  validateRequiredString(toolName, 'toolName');

  const paramsStr = typeof params === 'string'
    ? params
    : JSON.stringify(params || {});

  return await napi.mcpCallTool(toolName, paramsStr);
}

/**
 * Restart MCP server with new config
 * @param {Object} config - New server configuration
 * @returns {Promise<string>} New server ID
 */
async function restartServer(config) {
  validateServerConfig(config);
  const serverConfig = buildServerConfig(config);
  return await napi.mcpRestartServer(serverConfig);
}

/**
 * Configure Claude Desktop to use this MCP server
 * @returns {Promise<string>} Configuration result message
 */
async function configureClaudeDesktop() {
  return await napi.mcpConfigureClaudeDesktop();
}

/**
 * Test MCP server connectivity
 * @returns {Promise<boolean>} True if server is reachable
 */
async function testConnection() {
  return await napi.mcpTestConnection();
}

/**
 * Helper: Start stdio server (most common)
 * @returns {Promise<string>} Server ID
 */
async function startStdioServer() {
  return await startServer({
    transport: 'stdio',
    enable_logging: false,
    timeout_ms: 30000
  });
}

/**
 * Helper: Start HTTP server
 * @param {number} port - HTTP port
 * @param {string} [host='localhost'] - HTTP host
 * @returns {Promise<string>} Server ID
 */
async function startHttpServer(port, host = DEFAULTS.host) {
  validateRequiredNumber(port, 'port', { min: 1, max: 65535, integer: true });

  return await startServer({
    transport: 'http',
    port,
    host,
    enable_logging: true,
    timeout_ms: 30000
  });
}

/**
 * Helper: Start WebSocket server
 * @param {number} port - WebSocket port
 * @param {string} [host='localhost'] - WebSocket host
 * @returns {Promise<string>} Server ID
 */
async function startWebSocketServer(port, host = DEFAULTS.host) {
  validateRequiredNumber(port, 'port', { min: 1, max: 65535, integer: true });

  return await startServer({
    transport: 'websocket',
    port,
    host,
    enable_logging: true,
    timeout_ms: 30000
  });
}

module.exports = {
  startServer,
  stopServer,
  getServerStatus,
  listTools,
  callTool,
  restartServer,
  configureClaudeDesktop,
  testConnection,

  // Helpers
  startStdioServer,
  startHttpServer,
  startWebSocketServer
};

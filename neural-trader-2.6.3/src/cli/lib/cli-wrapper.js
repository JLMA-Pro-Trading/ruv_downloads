/**
 * CLI Wrapper for NAPI Bindings
 * Provides validated interface to Rust CLI implementations
 * Version: 2.5.0 - Refactored to use shared utilities
 */

const { loadNativeBinding } = require('./napi-loader-shared');
const {
  validateRequiredString,
  validatePositiveNumber,
  validateRequiredArray,
  validateRequiredObject,
  validateDateString,
  validateOptional,
  validateEnum
} = require('./validation-utils');

// Load native binding using shared loader
const napi = loadNativeBinding('../../../', 'CLI');

/**
 * Initialize a new trading project
 * @param {string} projectType - Type of project ('trading', 'backtesting', etc.)
 * @param {string} projectName - Name for the project
 * @param {string} [path] - Optional custom path
 * @returns {Promise<Object>} Project initialization result
 */
async function initProject(projectType, projectName, path = null) {
  validateRequiredString(projectType, 'projectType');
  validateRequiredString(projectName, 'projectName');

  return await napi.cliInitProject(projectType, projectName, path);
}

/**
 * List available trading strategies
 * @returns {Promise<Array>} Array of strategy info objects
 */
async function listStrategies() {
  return await napi.cliListStrategies();
}

/**
 * List available broker integrations
 * @returns {Promise<Array>} Array of broker info objects
 */
async function listBrokers() {
  return await napi.cliListBrokers();
}

/**
 * Run backtest command
 * @param {string} strategy - Strategy name
 * @param {string} startDate - Start date (ISO format)
 * @param {string} endDate - End date (ISO format)
 * @param {number} initialCapital - Starting capital
 * @param {string} [config] - Optional config JSON
 * @returns {Promise<string>} Backtest results
 */
async function runBacktest(strategy, startDate, endDate, initialCapital, config = null) {
  validateRequiredString(strategy, 'strategy');
  validateDateString(startDate, 'startDate');
  validateDateString(endDate, 'endDate');
  validatePositiveNumber(initialCapital, 'initialCapital');

  return await napi.cliRunBacktest(strategy, startDate, endDate, initialCapital, config);
}

/**
 * Validate trade command structure
 * @param {Object} command - Trade command configuration
 * @private
 */
function validateTradeCommand(command) {
  validateRequiredObject(command, 'command');
  validateRequiredString(command.strategy, 'command.strategy');
  validateRequiredArray(command.symbols, 'command.symbols', { minLength: 1 });
  validatePositiveNumber(command.initial_capital, 'command.initial_capital');
}

/**
 * Build trade command config
 * @param {Object} command - Trade command configuration
 * @param {boolean} paperMode - Paper trading mode
 * @returns {Object} Normalized command config
 * @private
 */
function buildTradeCommandConfig(command, paperMode) {
  return {
    strategy: command.strategy,
    symbols: command.symbols,
    initial_capital: command.initial_capital,
    paper_mode: paperMode,
    config: command.config || null
  };
}

/**
 * Start paper trading
 * @param {Object} command - Trade command configuration
 * @param {string} command.strategy - Strategy to use
 * @param {Array<string>} command.symbols - Trading symbols
 * @param {number} command.initial_capital - Starting capital
 * @param {boolean} [command.paper_mode=true] - Paper trading mode
 * @param {string} [command.config] - Optional config
 * @returns {Promise<Object>} Trade result with strategy_id
 */
async function startPaperTrading(command) {
  validateTradeCommand(command);
  const config = buildTradeCommandConfig(command, true);
  return await napi.cliStartPaperTrading(config);
}

/**
 * Start live trading
 * @param {Object} command - Trade command configuration
 * @returns {Promise<Object>} Trade result with strategy_id
 */
async function startLiveTrading(command) {
  validateTradeCommand(command);

  // Warn about live trading
  console.warn('⚠️  Starting LIVE trading - real money will be used!');

  const config = buildTradeCommandConfig(command, false);
  return await napi.cliStartLiveTrading(config);
}

/**
 * Get status of running trading agents
 * @param {string} [strategyId] - Optional strategy ID to filter
 * @returns {Promise<Array>} Array of agent status objects
 */
async function getAgentStatus(strategyId = null) {
  return await napi.cliGetAgentStatus(strategyId);
}

/**
 * Train neural network model
 * @param {string} modelType - Type of model to train
 * @param {string} dataPath - Path to training data
 * @param {string} [config] - Optional config JSON
 * @returns {Promise<string>} Training result message
 */
async function trainNeuralModel(modelType, dataPath, config = null) {
  validateRequiredString(modelType, 'modelType');
  validateRequiredString(dataPath, 'dataPath');

  return await napi.cliTrainNeuralModel(modelType, dataPath, config);
}

/**
 * Manage secrets (API keys, credentials)
 * @param {string} action - Action to perform ('set', 'get', 'list', 'delete')
 * @param {string} [key] - Secret key name
 * @param {string} [value] - Secret value (for 'set' action)
 * @returns {Promise<string>} Result message
 */
async function manageSecrets(action, key = null, value = null) {
  const validActions = ['set', 'get', 'list', 'delete'];
  validateEnum(action, 'action', validActions);

  if (['set', 'get', 'delete'].includes(action)) {
    validateRequiredString(key, 'key');
  }

  if (action === 'set') {
    validateRequiredString(value, 'value');
  }

  return await napi.cliManageSecrets(action, key, value);
}

module.exports = {
  initProject,
  listStrategies,
  listBrokers,
  runBacktest,
  startPaperTrading,
  startLiveTrading,
  getAgentStatus,
  trainNeuralModel,
  manageSecrets
};

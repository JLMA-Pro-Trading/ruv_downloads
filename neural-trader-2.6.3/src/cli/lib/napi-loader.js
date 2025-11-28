/**
 * NAPI Loader
 * Handles loading of Rust NAPI bindings with graceful fallback
 */

const path = require('path');

let napiBindings = null;
let loadError = null;

/**
 * Attempt to load NAPI bindings
 * @returns {Object|null} NAPI bindings or null if unavailable
 */
function loadNAPIBindings() {
  if (napiBindings !== null || loadError !== null) {
    return napiBindings;
  }

  try {
    // Try to load from neural-trader-rust directory
    const napiPath = path.join(__dirname, '../../../neural-trader-rust');
    napiBindings = require(napiPath);
    return napiBindings;
  } catch (error) {
    loadError = error;

    // Try alternative path (installed package)
    try {
      napiBindings = require('neural-trader-rust');
      loadError = null;
      return napiBindings;
    } catch (altError) {
      loadError = altError;
      return null;
    }
  }
}

/**
 * Get NAPI status information
 * @returns {Object} Status object with availability, function count, and mode
 */
function getNAPIStatus() {
  const bindings = loadNAPIBindings();

  if (!bindings) {
    return {
      available: false,
      functionCount: 0,
      mode: 'cli-only',
      error: loadError ? loadError.message : 'NAPI bindings not available'
    };
  }

  // Count exported NAPI functions
  const napiExports = [
    'BrokerClient',
    'listBrokerTypes',
    'validateBrokerConfig',
    'ModelType',
    'NeuralModel',
    'BatchPredictor',
    'listModelTypes',
    'RiskManager',
    'calculateSharpeRatio',
    'calculateSortinoRatio',
    'calculateMaxLeverage',
    'BacktestEngine',
    'compareBacktests',
    'MarketDataProvider',
    'SubscriptionHandle',
    'calculateSma',
    'calculateRsi',
    'listDataProviders',
    'StrategyRunner',
    'PortfolioOptimizer',
    'PortfolioManager',
    'NeuralTrader',
    'fetchMarketData',
    'calculateIndicator',
    'encodeBarsToBuffer',
    'decodeBarsFromBuffer',
    'initRuntime',
    'getVersionInfo'
  ];

  const availableFunctions = napiExports.filter(fn => typeof bindings[fn] !== 'undefined').length;

  return {
    available: true,
    functionCount: availableFunctions,
    mode: 'full',
    version: bindings.getVersionInfo ? bindings.getVersionInfo() : null
  };
}

/**
 * Get NAPI bindings (for direct use)
 * @returns {Object|null} NAPI bindings or null
 */
function getNAPIBindings() {
  return loadNAPIBindings();
}

module.exports = {
  getNAPIStatus,
  getNAPIBindings,
  loadNAPIBindings
};

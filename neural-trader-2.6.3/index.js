/**
 * Neural Trader - NAPI Bindings Entry Point
 * Provides JavaScript/TypeScript interface to Rust implementation
 * Version: 2.5.0 - Refactored with shared utilities
 */

const { loadNativeBinding } = require('./src/cli/lib/napi-loader-shared');

// Load native binding using shared loader
const nativeBinding = loadNativeBinding('.', 'Main');

/**
 * Destructure all NAPI exports from native binding
 * Total: 178 functions and classes
 */

// Classes (20)
const {
  AllocationStrategy,
  BacktestEngine,
  BrokerClient,
  CollaborationHub,
  DistributionModel,
  FundAllocationEngine,
  MarketDataProvider,
  MemberManager,
  MemberPerformanceTracker,
  MemberRole,
  MemberTier,
  NeuralTrader,
  PortfolioManager,
  PortfolioOptimizer,
  ProfitDistributionSystem,
  RiskManager,
  StrategyRunner,
  SubscriptionHandle,
  VotingSystem,
  WithdrawalManager
} = nativeBinding;

// Market Data & Indicators (9)
const {
  fetchMarketData,
  listDataProviders,
  calculateSma,
  calculateRsi,
  calculateIndicator,
  getMarketStatus,
  getMarketOrderbook,
  getMarketAnalysis,
  encodeBarsToBuffer,
  decodeBarsFromBuffer
} = nativeBinding;

// Neural Network (7)
const {
  neuralTrain,
  neuralPredict,
  neuralBacktest,
  neuralEvaluate,
  neuralForecast,
  neuralOptimize,
  neuralModelStatus
} = nativeBinding;

// Strategy & Backtest (14)
const {
  backtestStrategy,
  runBacktest,
  listStrategies,
  optimizeStrategy,
  switchActiveStrategy,
  quickBacktest,
  quickAnalysis,
  compareBacktests,
  getStrategyInfo,
  getStrategyComparison,
  adaptiveStrategySelection,
  recommendStrategy,
  optimizeParameters,
  monitorStrategyHealth
} = nativeBinding;

// Trade Execution (8)
const {
  executeTrade,
  executeMultiAssetTrade,
  executeSportsBet,
  executeSwarmStrategy,
  getExecutionAnalytics,
  getTradeExecutionAnalytics,
  getApiLatency,
  validateBrokerConfig
} = nativeBinding;

// Portfolio Management (6)
const {
  portfolioRebalance,
  getPortfolioStatus,
  getPredictionPositions,
  getBettingPortfolioStatus,
  crossAssetCorrelationMatrix,
  correlationAnalysis
} = nativeBinding;

// Risk Management (7)
const {
  riskAnalysis,
  calculateSharpeRatio,
  calculateSortinoRatio,
  monteCarloSimulation,
  calculateKellyCriterion,
  calculateMaxLeverage,
  calculateExpectedValue
} = nativeBinding;

// E2B Cloud Execution (13)
const {
  createE2BSandbox,
  deployE2BTemplate,
  executeE2BProcess,
  getE2BSandboxStatus,
  listE2BSandboxes,
  terminateE2BSandbox,
  exportE2BTemplate,
  initE2BSwarm,
  runE2BAgent,
  scaleE2BDeployment,
  deployTradingAgent,
  monitorE2BHealth
} = nativeBinding;

// Sports Betting & Predictions (25)
const {
  getSportsOdds,
  getSportsEvents,
  findSportsArbitrage,
  getBettingHistory,
  getSportsBettingPerformance,
  getPredictionMarkets,
  placePredictionOrder,
  getLiveOddsUpdates,
  analyzeBettingTrends,
  analyzeBettingMarketDepth,
  compareBettingProviders,
  oddsApiGetSports,
  oddsApiGetUpcoming,
  oddsApiGetEventOdds,
  oddsApiGetBookmakerOdds,
  oddsApiGetLiveOdds,
  oddsApiFindArbitrage,
  oddsApiCalculateProbability,
  oddsApiCompareMargins,
  oddsApiAnalyzeMovement
} = nativeBinding;

// Syndicate Management (18)
const {
  createSyndicate,
  initSyndicate,
  addSyndicateMember,
  allocateSyndicateFunds,
  distributeSyndicateProfits,
  getSyndicateStatus,
  getSyndicateMemberList,
  getSyndicateMemberPerformance,
  getSyndicateProfitHistory,
  getSyndicateWithdrawalHistory,
  getSyndicateAllocationLimits,
  processSyndicateWithdrawal,
  updateSyndicateMemberContribution,
  updateSyndicateAllocationStrategy,
  createSyndicateVote,
  castSyndicateVote,
  calculateSyndicateTaxLiability,
  simulateSyndicateAllocation
} = nativeBinding;

// News & Sentiment Analysis (9)
const {
  analyzeNews,
  fetchFilteredNews,
  getBreakingNews,
  getNewsSentiment,
  getNewsTrends,
  analyzeNewsImpact,
  analyzeMarketSentiment,
  controlNewsCollection,
  getNewsProviderStatus
} = nativeBinding;

// Swarm Coordination (6 additional functions beyond wrapper)
const {
  getSwarmStatus,
  getSwarmMetrics,
  scaleSwarm,
  shutdownSwarm,
  monitorSwarmHealth
} = nativeBinding;

// Performance & Analytics (7)
const {
  performanceReport,
  runBenchmark,
  analyzeBottlenecks,
  getSystemMetrics,
  getTokenUsage,
  getHealthStatus,
  getVersionInfo
} = nativeBinding;

// Advanced Data Science - DTW (Dynamic Time Warping) (5)
const {
  dtwDistanceRust,
  dtwDistanceRustOptimized,
  dtwBatch,
  dtwBatchParallel,
  dtwBatchAdaptive
} = nativeBinding;

// System Utilities (4)
const {
  initRuntime,
  listBrokerTypes,
  ping,
  getVersion
} = nativeBinding;

// Multi-Market Trading - Sports Betting (8) - v2.6.0
const {
  multiMarketSportsFetchOdds,
  multiMarketSportsListSports,
  multiMarketSportsStreamOdds,
  multiMarketSportsCalculateKelly,
  multiMarketSportsOptimizeStakes,
  multiMarketSportsFindArbitrage,
  multiMarketSportsSyndicateCreate,
  multiMarketSportsSyndicateDistribute
} = nativeBinding;

// Multi-Market Trading - Prediction Markets (7) - v2.6.0
const {
  multiMarketPredictionFetchMarkets,
  multiMarketPredictionGetOrderbook,
  multiMarketPredictionPlaceOrder,
  multiMarketPredictionAnalyzeSentiment,
  multiMarketPredictionCalculateEv,
  multiMarketPredictionFindArbitrage,
  multiMarketPredictionMarketMaking
} = nativeBinding;

// Multi-Market Trading - Cryptocurrency (9) - v2.6.0
const {
  multiMarketCryptoGetYieldOpportunities,
  multiMarketCryptoOptimizeYield,
  multiMarketCryptoFarmYield,
  multiMarketCryptoFindArbitrage,
  multiMarketCryptoExecuteArbitrage,
  multiMarketCryptoDexArbitrage,
  multiMarketCryptoOptimizeGas,
  multiMarketCryptoProvideLiquidity,
  multiMarketCryptoRebalanceLiquidity
} = nativeBinding;

/**
 * Legacy stub functions for backward compatibility
 * NOTE: These will not work as they call non-existent NAPI functions.
 * Use the direct NAPI exports above instead.
 * @deprecated Use direct NAPI exports: neuralTrain, executeTrade, portfolioRebalance, etc.
 */
function streamMarketData(symbol, callback, provider = 'alpaca') {
  // This function doesn't exist in NAPI - use MarketDataProvider class instead
  throw new Error('streamMarketData is not implemented. Use MarketDataProvider class instead.');
}

function runStrategy(strategyType, config) {
  // Use backtestStrategy or StrategyRunner class instead
  throw new Error('runStrategy is deprecated. Use backtestStrategy() or StrategyRunner class instead.');
}

function backtest(strategyType, config, startDate, endDate) {
  // Use runBacktest or BacktestEngine class instead
  throw new Error('backtest is deprecated. Use runBacktest() or BacktestEngine class instead.');
}

function executeOrder(order) {
  // Use executeTrade instead
  throw new Error('executeOrder is deprecated. Use executeTrade() instead.');
}

function cancelOrder(orderId) {
  throw new Error('cancelOrder is not implemented in NAPI. Feature pending.');
}

function getOrderStatus(orderId) {
  throw new Error('getOrderStatus is not implemented in NAPI. Feature pending.');
}

function getPortfolio() {
  // Use getPortfolioStatus instead
  throw new Error('getPortfolio is deprecated. Use getPortfolioStatus() instead.');
}

function getPositions() {
  // Use getPredictionPositions instead
  throw new Error('getPositions is deprecated. Use getPredictionPositions() instead.');
}

function calculateMetrics(portfolio) {
  // Use performanceReport or PortfolioManager class instead
  throw new Error('calculateMetrics is deprecated. Use performanceReport() or PortfolioManager class instead.');
}

function calculateVaR(portfolio, confidence = 0.95, method = 'historical') {
  // Use RiskManager class instead
  throw new Error('calculateVaR is deprecated. Use RiskManager class instead.');
}

function calculatePositionSize(symbol, accountValue, riskPercent, stopLoss) {
  // Use RiskManager class instead
  throw new Error('calculatePositionSize is deprecated. Use RiskManager class instead.');
}

function checkRiskLimits(portfolio, limits) {
  // Use RiskManager class or riskAnalysis instead
  throw new Error('checkRiskLimits is deprecated. Use RiskManager class or riskAnalysis() instead.');
}

function trainModel(modelType, data, config) {
  // Use neuralTrain instead
  throw new Error('trainModel is deprecated. Use neuralTrain() instead.');
}

function predict(modelId, input) {
  // Use neuralPredict instead
  throw new Error('predict is deprecated. Use neuralPredict() instead.');
}

function evaluateModel(modelId, testData) {
  // Use neuralEvaluate instead
  throw new Error('evaluateModel is deprecated. Use neuralEvaluate() instead.');
}

/**
 * CLI Functions (v2.4.0+)
 * Uses wrapper module for validation and helper functions
 */
const cli = require('./src/cli/lib/cli-wrapper.js');

/**
 * MCP Server Control Functions (v2.4.0+)
 * Uses wrapper module for validation and helper functions
 */
const mcp = require('./src/cli/lib/mcp-wrapper.js');

/**
 * Swarm Coordination Functions (v2.4.0+)
 * Uses wrapper module for validation and helper functions
 */
const swarm = require('./src/cli/lib/swarm-wrapper.js');

module.exports = {
  // ============================================================
  // WRAPPER MODULES (v2.4.0+)
  // ============================================================

  // CLI - 9 functions + helpers
  cli,

  // MCP Server - 8 functions + helpers
  mcp,

  // Swarm Coordination - 9 functions + helpers
  swarm,

  // ============================================================
  // CLASSES (20 total)
  // ============================================================

  AllocationStrategy,
  BacktestEngine,
  BrokerClient,
  CollaborationHub,
  DistributionModel,
  FundAllocationEngine,
  MarketDataProvider,
  MemberManager,
  MemberPerformanceTracker,
  MemberRole,
  MemberTier,
  NeuralTrader,
  PortfolioManager,
  PortfolioOptimizer,
  ProfitDistributionSystem,
  RiskManager,
  StrategyRunner,
  SubscriptionHandle,
  VotingSystem,
  WithdrawalManager,

  // ============================================================
  // MARKET DATA & INDICATORS (10 total)
  // ============================================================

  fetchMarketData,
  listDataProviders,
  calculateSma,
  calculateRsi,
  calculateIndicator,
  getMarketStatus,
  getMarketOrderbook,
  getMarketAnalysis,
  encodeBarsToBuffer,
  decodeBarsFromBuffer,

  // ============================================================
  // NEURAL NETWORK (7 total)
  // ============================================================

  neuralTrain,
  neuralPredict,
  neuralBacktest,
  neuralEvaluate,
  neuralForecast,
  neuralOptimize,
  neuralModelStatus,

  // ============================================================
  // STRATEGY & BACKTEST (14 total)
  // ============================================================

  backtestStrategy,
  runBacktest,
  listStrategies,
  optimizeStrategy,
  switchActiveStrategy,
  quickBacktest,
  quickAnalysis,
  compareBacktests,
  getStrategyInfo,
  getStrategyComparison,
  adaptiveStrategySelection,
  recommendStrategy,
  optimizeParameters,
  monitorStrategyHealth,

  // ============================================================
  // TRADE EXECUTION (8 total)
  // ============================================================

  executeTrade,
  executeMultiAssetTrade,
  executeSportsBet,
  executeSwarmStrategy,
  getExecutionAnalytics,
  getTradeExecutionAnalytics,
  getApiLatency,
  validateBrokerConfig,

  // ============================================================
  // PORTFOLIO MANAGEMENT (6 total)
  // ============================================================

  portfolioRebalance,
  getPortfolioStatus,
  getPredictionPositions,
  getBettingPortfolioStatus,
  crossAssetCorrelationMatrix,
  correlationAnalysis,

  // ============================================================
  // RISK MANAGEMENT (7 total)
  // ============================================================

  riskAnalysis,
  calculateSharpeRatio,
  calculateSortinoRatio,
  monteCarloSimulation,
  calculateKellyCriterion,
  calculateMaxLeverage,
  calculateExpectedValue,

  // ============================================================
  // E2B CLOUD EXECUTION (13 total)
  // ============================================================

  createE2BSandbox,
  deployE2BTemplate,
  executeE2BProcess,
  getE2BSandboxStatus,
  listE2BSandboxes,
  terminateE2BSandbox,
  exportE2BTemplate,
  initE2BSwarm,
  runE2BAgent,
  scaleE2BDeployment,
  deployTradingAgent,
  monitorE2BHealth,

  // ============================================================
  // SPORTS BETTING & PREDICTIONS (25 total)
  // ============================================================

  getSportsOdds,
  getSportsEvents,
  findSportsArbitrage,
  getBettingHistory,
  getSportsBettingPerformance,
  getPredictionMarkets,
  placePredictionOrder,
  getLiveOddsUpdates,
  analyzeBettingTrends,
  analyzeBettingMarketDepth,
  compareBettingProviders,
  oddsApiGetSports,
  oddsApiGetUpcoming,
  oddsApiGetEventOdds,
  oddsApiGetBookmakerOdds,
  oddsApiGetLiveOdds,
  oddsApiFindArbitrage,
  oddsApiCalculateProbability,
  oddsApiCompareMargins,
  oddsApiAnalyzeMovement,

  // ============================================================
  // SYNDICATE MANAGEMENT (18 total)
  // ============================================================

  createSyndicate,
  initSyndicate,
  addSyndicateMember,
  allocateSyndicateFunds,
  distributeSyndicateProfits,
  getSyndicateStatus,
  getSyndicateMemberList,
  getSyndicateMemberPerformance,
  getSyndicateProfitHistory,
  getSyndicateWithdrawalHistory,
  getSyndicateAllocationLimits,
  processSyndicateWithdrawal,
  updateSyndicateMemberContribution,
  updateSyndicateAllocationStrategy,
  createSyndicateVote,
  castSyndicateVote,
  calculateSyndicateTaxLiability,
  simulateSyndicateAllocation,

  // ============================================================
  // NEWS & SENTIMENT ANALYSIS (9 total)
  // ============================================================

  analyzeNews,
  fetchFilteredNews,
  getBreakingNews,
  getNewsSentiment,
  getNewsTrends,
  analyzeNewsImpact,
  analyzeMarketSentiment,
  controlNewsCollection,
  getNewsProviderStatus,

  // ============================================================
  // SWARM COORDINATION (6 additional beyond wrapper)
  // ============================================================

  getSwarmStatus,
  getSwarmMetrics,
  scaleSwarm,
  shutdownSwarm,
  monitorSwarmHealth,

  // ============================================================
  // PERFORMANCE & ANALYTICS (7 total)
  // ============================================================

  performanceReport,
  runBenchmark,
  analyzeBottlenecks,
  getSystemMetrics,
  getTokenUsage,
  getHealthStatus,
  getVersionInfo,

  // ============================================================
  // DATA SCIENCE - DTW (5 total)
  // ============================================================

  dtwDistanceRust,
  dtwDistanceRustOptimized,
  dtwBatch,
  dtwBatchParallel,
  dtwBatchAdaptive,

  // ============================================================
  // SYSTEM UTILITIES (4 total)
  // ============================================================

  initRuntime,
  listBrokerTypes,
  ping,
  getVersion,

  // ============================================================
  // LEGACY/DEPRECATED FUNCTIONS (for backward compatibility)
  // These throw helpful error messages directing to new APIs
  // ============================================================

  streamMarketData,    // -> Use MarketDataProvider class
  runStrategy,         // -> Use backtestStrategy() or StrategyRunner class
  backtest,            // -> Use runBacktest() or BacktestEngine class
  executeOrder,        // -> Use executeTrade()
  cancelOrder,         // -> Not implemented
  getOrderStatus,      // -> Not implemented
  getPortfolio,        // -> Use getPortfolioStatus()
  getPositions,        // -> Use getPredictionPositions()
  calculateMetrics,    // -> Use performanceReport() or PortfolioManager class
  calculateVaR,        // -> Use RiskManager class
  calculatePositionSize, // -> Use RiskManager class
  checkRiskLimits,     // -> Use RiskManager class or riskAnalysis()
  trainModel,          // -> Use neuralTrain()
  predict,             // -> Use neuralPredict()
  evaluateModel,       // -> Use neuralEvaluate()

  // ============================================================
  // MULTI-MARKET TRADING (24 total) - v2.6.0
  // ============================================================

  // Sports Betting (8)
  multiMarketSportsFetchOdds,
  multiMarketSportsListSports,
  multiMarketSportsStreamOdds,
  multiMarketSportsCalculateKelly,
  multiMarketSportsOptimizeStakes,
  multiMarketSportsFindArbitrage,
  multiMarketSportsSyndicateCreate,
  multiMarketSportsSyndicateDistribute,

  // Prediction Markets (7)
  multiMarketPredictionFetchMarkets,
  multiMarketPredictionGetOrderbook,
  multiMarketPredictionPlaceOrder,
  multiMarketPredictionAnalyzeSentiment,
  multiMarketPredictionCalculateEv,
  multiMarketPredictionFindArbitrage,
  multiMarketPredictionMarketMaking,

  // Cryptocurrency (9)
  multiMarketCryptoGetYieldOpportunities,
  multiMarketCryptoOptimizeYield,
  multiMarketCryptoFarmYield,
  multiMarketCryptoFindArbitrage,
  multiMarketCryptoExecuteArbitrage,
  multiMarketCryptoDexArbitrage,
  multiMarketCryptoOptimizeGas,
  multiMarketCryptoProvideLiquidity,
  multiMarketCryptoRebalanceLiquidity
};

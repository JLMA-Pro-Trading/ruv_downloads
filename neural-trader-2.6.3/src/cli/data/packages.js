/**
 * Neural Trader Package Registry
 * Comprehensive catalog of all available packages with metadata
 * @module cli/data/packages
 */

const PACKAGES = {
  // === TRADING & EXECUTION ===
  trading: {
    name: 'Trading Strategy System',
    description: 'Complete algorithmic trading with strategies, execution, and risk management',
    category: 'trading',
    version: '2.3.15',
    size: '12.5 MB',
    packages: ['neural-trader', '@neural-trader/core', '@neural-trader/strategies', '@neural-trader/execution'],
    dependencies: ['@neural-trader/market-data', '@neural-trader/risk'],
    features: ['Real-time execution', 'Multiple strategies (momentum, mean-reversion, pairs)', 'Risk management', 'Live market data'],
    hasExamples: true,
    installed: false
  },

  backtesting: {
    name: 'Backtesting Engine',
    description: 'High-performance backtesting with walk-forward optimization and Monte Carlo',
    category: 'trading',
    version: '2.3.10',
    size: '8.2 MB',
    packages: ['@neural-trader/backtesting', '@neural-trader/market-data'],
    dependencies: ['@neural-trader/core'],
    features: ['Multi-threaded execution', 'Walk-forward analysis', 'Monte Carlo simulation', 'Performance metrics'],
    hasExamples: true,
    installed: false
  },

  portfolio: {
    name: 'Portfolio Management',
    description: 'Multi-strategy portfolio optimization and risk management',
    category: 'trading',
    version: '2.3.8',
    size: '6.8 MB',
    packages: ['@neural-trader/portfolio', '@neural-trader/risk'],
    dependencies: ['@neural-trader/core'],
    features: ['Position sizing', 'Risk allocation', 'Dynamic rebalancing', 'Performance attribution'],
    hasExamples: true,
    installed: false
  },

  // === SPECIALIZED TRADING ===
  'news-trading': {
    name: 'News Trading',
    description: 'Sentiment-driven trading with NLP analysis and event detection',
    category: 'trading',
    version: '2.2.5',
    size: '15.3 MB',
    packages: ['@neural-trader/news-trading', '@neural-trader/neural'],
    dependencies: ['@neural-trader/core', '@neural-trader/market-data'],
    features: ['Real-time news feeds', 'Sentiment analysis', 'Event detection', 'Impact scoring'],
    hasExamples: true,
    installed: false
  },

  'sports-betting': {
    name: 'Sports Betting',
    description: 'Arbitrage detection and Kelly criterion position sizing for sports betting',
    category: 'betting',
    version: '2.1.0',
    size: '5.5 MB',
    packages: ['@neural-trader/sports-betting', '@neural-trader/risk'],
    dependencies: [],
    features: ['Arbitrage scanner', 'Kelly sizing', 'Syndicate management', 'Multi-bookmaker odds'],
    hasExamples: true,
    installed: false
  },

  'prediction-markets': {
    name: 'Prediction Markets',
    description: 'Decentralized prediction market trading and market making',
    category: 'markets',
    version: '1.5.0',
    size: '7.2 MB',
    packages: ['@neural-trader/prediction-markets'],
    dependencies: ['@neural-trader/core'],
    features: ['Market making', 'Probability calibration', 'Event resolution', 'Smart contract integration'],
    hasExamples: false,
    installed: false
  },

  // === ACCOUNTING & TAX ===
  accounting: {
    name: 'Agentic Accounting',
    description: 'Tax-aware portfolio accounting with AI agents and wash sale detection',
    category: 'accounting',
    version: '2.3.12',
    size: '9.8 MB',
    packages: [
      '@neural-trader/agentic-accounting-core',
      '@neural-trader/agentic-accounting-agents',
      '@neural-trader/agentic-accounting-cli'
    ],
    dependencies: ['@neural-trader/core'],
    features: ['Tax-lot tracking (FIFO/LIFO/HIFO)', 'Wash sale detection', 'AI-powered optimization', 'Multi-currency support'],
    hasExamples: true,
    installed: false
  },

  // === PREDICTION & FORECASTING ===
  predictor: {
    name: 'Conformal Prediction',
    description: 'Statistical prediction with guaranteed confidence intervals',
    category: 'prediction',
    version: '2.3.5',
    size: '11.2 MB',
    packages: ['@neural-trader/predictor'],
    dependencies: [],
    features: ['WASM acceleration', 'Native Rust bindings', 'Guaranteed coverage', 'Multiple conformal methods'],
    hasExamples: true,
    installed: false
  },

  // === DATA & INFRASTRUCTURE ===
  'market-data': {
    name: 'Market Data',
    description: 'Real-time and historical market data aggregation',
    category: 'data',
    version: '2.3.0',
    size: '4.5 MB',
    packages: ['@neural-trader/market-data', '@neural-trader/brokers'],
    dependencies: [],
    features: ['Multiple data sources', 'WebSocket streaming', 'Historical data', 'Data normalization'],
    hasExamples: false,
    installed: false
  },

  'multi-market': {
    name: 'Multi-Market Trading',
    description: 'Cross-market trading for sports betting, prediction markets, and cryptocurrency',
    category: 'trading',
    version: '2.6.0',
    size: '18.5 MB',
    packages: ['@neural-trader/multi-market'],
    dependencies: ['@neural-trader/core', '@neural-trader/risk'],
    features: [
      'Sports betting with Kelly Criterion',
      'Arbitrage detection across bookmakers',
      'Syndicate management for pooled betting',
      'Prediction market trading (Polymarket)',
      'Sentiment analysis and EV calculation',
      'Cross-exchange crypto arbitrage',
      'DeFi yield optimization',
      'Liquidity pool strategies',
      'Gas optimization',
      'Real-time odds streaming'
    ],
    hasExamples: true,
    installed: false
  },

  // === EXAMPLES - FINANCE ===
  'example:portfolio-optimization': {
    name: 'Portfolio Optimization',
    description: 'Mean-variance, risk parity, Black-Litterman with self-learning and benchmark swarms',
    category: 'example',
    version: '1.0.0',
    size: '3.2 MB',
    packages: ['@neural-trader/example-portfolio-optimization'],
    dependencies: ['@neural-trader/core', '@neural-trader/portfolio'],
    features: ['Multiple algorithms', 'Benchmark swarm', 'AgentDB memory', 'OpenRouter AI integration'],
    isExample: true,
    installed: false
  },

  // === EXAMPLES - HEALTHCARE ===
  'example:healthcare-optimization': {
    name: 'Healthcare Queue Optimization',
    description: 'Patient scheduling, queue optimization, and resource allocation',
    category: 'example',
    version: '1.0.0',
    size: '2.8 MB',
    packages: ['@neural-trader/example-healthcare-optimization'],
    dependencies: [],
    features: ['Queue optimization', 'Resource scheduling', 'Arrival forecasting', 'Swarm coordination'],
    isExample: true,
    installed: false
  },

  // === EXAMPLES - ENERGY ===
  'example:energy-grid': {
    name: 'Energy Grid Optimization',
    description: 'Smart grid load balancing and demand forecasting',
    category: 'example',
    version: '1.0.0',
    size: '3.5 MB',
    packages: ['@neural-trader/example-energy-grid'],
    dependencies: [],
    features: ['Load forecasting', 'Grid balancing', 'Renewable integration', 'Peak shaving'],
    isExample: true,
    installed: false
  },

  // === EXAMPLES - LOGISTICS ===
  'example:supply-chain': {
    name: 'Supply Chain Prediction',
    description: 'Demand forecasting and inventory optimization',
    category: 'example',
    version: '1.0.0',
    size: '2.9 MB',
    packages: ['@neural-trader/example-supply-chain'],
    dependencies: [],
    features: ['Demand forecasting', 'Inventory optimization', 'Route planning', 'Risk analysis'],
    isExample: true,
    installed: false
  },

  // === EXAMPLES - SECURITY ===
  'example:anomaly-detection': {
    name: 'Anomaly Detection',
    description: 'Real-time fraud and anomaly detection',
    category: 'example',
    version: '1.0.0',
    size: '4.1 MB',
    packages: ['@neural-trader/example-anomaly-detection'],
    dependencies: ['@neural-trader/neural'],
    features: ['Real-time detection', 'Multiple algorithms', 'Auto-tuning', 'Alert system'],
    isExample: true,
    installed: false
  },

  // === EXAMPLES - PRICING ===
  'example:dynamic-pricing': {
    name: 'Dynamic Pricing',
    description: 'AI-powered dynamic pricing optimization',
    category: 'example',
    version: '1.0.0',
    size: '3.3 MB',
    packages: ['@neural-trader/example-dynamic-pricing'],
    dependencies: [],
    features: ['Price optimization', 'Demand elasticity', 'Competitor analysis', 'Revenue maximization'],
    isExample: true,
    installed: false
  },

  // === EXAMPLES - ADVANCED ===
  'example:quantum-optimization': {
    name: 'Quantum Optimization',
    description: 'Quantum-inspired optimization algorithms (QAOA, quantum annealing)',
    category: 'example',
    version: '1.0.0',
    size: '5.8 MB',
    packages: ['@neural-trader/example-quantum-optimization'],
    dependencies: [],
    features: ['QAOA', 'Quantum annealing', 'Hybrid classical-quantum', 'Combinatorial optimization'],
    isExample: true,
    installed: false
  },

  'example:neuromorphic-computing': {
    name: 'Neuromorphic Computing',
    description: 'Brain-inspired computing for pattern recognition',
    category: 'example',
    version: '1.0.0',
    size: '6.5 MB',
    packages: ['@neural-trader/example-neuromorphic-computing'],
    dependencies: ['@neural-trader/neural'],
    features: ['Spiking neural networks', 'Event-driven processing', 'Low-power inference', 'Hardware acceleration'],
    isExample: true,
    installed: false
  },

  'example:energy-forecasting': {
    name: 'Energy Forecasting',
    description: 'Renewable energy generation and demand forecasting',
    category: 'example',
    version: '1.0.0',
    size: '3.8 MB',
    packages: ['@neural-trader/example-energy-forecasting'],
    dependencies: ['@neural-trader/neural'],
    features: ['Solar/wind forecasting', 'Demand prediction', 'Time series analysis', 'Weather integration'],
    isExample: true,
    installed: false
  },

  'example:logistics-optimization': {
    name: 'Logistics Optimization',
    description: 'Vehicle routing, fleet management, and delivery optimization',
    category: 'example',
    version: '1.0.0',
    size: '4.2 MB',
    packages: ['@neural-trader/example-logistics-optimization'],
    dependencies: [],
    features: ['Vehicle routing', 'Fleet management', 'Route optimization', 'Cost minimization'],
    isExample: true,
    installed: false
  },

  'example:multi-strategy-backtest': {
    name: 'Multi-Strategy Backtesting',
    description: 'Comprehensive backtesting framework for multiple trading strategies',
    category: 'example',
    version: '1.0.0',
    size: '5.1 MB',
    packages: ['@neural-trader/example-multi-strategy-backtest'],
    dependencies: ['@neural-trader/core', '@neural-trader/backtesting'],
    features: ['Multi-strategy testing', 'Performance comparison', 'Walk-forward analysis', 'Portfolio optimization'],
    isExample: true,
    installed: false
  },

  'example:market-microstructure': {
    name: 'Market Microstructure',
    description: 'Order book analysis, market making, and high-frequency trading',
    category: 'example',
    version: '1.0.0',
    size: '4.8 MB',
    packages: ['@neural-trader/example-market-microstructure'],
    dependencies: ['@neural-trader/core', '@neural-trader/market-data'],
    features: ['Order book analysis', 'Market making', 'Liquidity provision', 'Spread analysis'],
    isExample: true,
    installed: false
  },

  'example:adaptive-systems': {
    name: 'Adaptive Systems',
    description: 'Self-adapting systems with reinforcement learning and online optimization',
    category: 'example',
    version: '1.0.0',
    size: '5.5 MB',
    packages: ['@neural-trader/example-adaptive-systems'],
    dependencies: ['@neural-trader/neural'],
    features: ['Reinforcement learning', 'Online optimization', 'Adaptive strategies', 'Continuous learning'],
    isExample: true,
    installed: false
  },

  'example:evolutionary-game-theory': {
    name: 'Evolutionary Game Theory',
    description: 'Evolutionary strategies and game-theoretic optimization',
    category: 'example',
    version: '1.0.0',
    size: '3.9 MB',
    packages: ['@neural-trader/example-evolutionary-game-theory'],
    dependencies: [],
    features: ['Evolutionary algorithms', 'Game theory', 'Nash equilibrium', 'Strategy evolution'],
    isExample: true,
    installed: false
  }
};

function getAllPackages() {
  return PACKAGES;
}

function getPackage(name) {
  return PACKAGES[name] || null;
}

function getPackagesByCategory(category) {
  return Object.entries(PACKAGES)
    .filter(([, pkg]) => pkg.category === category)
    .reduce((acc, [key, pkg]) => ({ ...acc, [key]: pkg }), {});
}

function getCategories() {
  return [...new Set(Object.values(PACKAGES).map(pkg => pkg.category))];
}

function searchPackages(query) {
  const lowerQuery = query.toLowerCase();
  return Object.entries(PACKAGES)
    .filter(([key, pkg]) =>
      key.toLowerCase().includes(lowerQuery) ||
      pkg.name.toLowerCase().includes(lowerQuery) ||
      pkg.description.toLowerCase().includes(lowerQuery) ||
      pkg.features.some(f => f.toLowerCase().includes(lowerQuery))
    )
    .reduce((acc, [key, pkg]) => ({ ...acc, [key]: pkg }), {});
}

module.exports = {
  PACKAGES,
  getAllPackages,
  getPackage,
  getPackagesByCategory,
  getCategories,
  searchPackages
};

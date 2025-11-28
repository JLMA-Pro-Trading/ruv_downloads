/**
 * Agent Configuration Templates and Schemas
 * Provides default configurations and validation schemas for all agent types
 */

const AGENT_CONFIG_TEMPLATES = {
  momentum: {
    name: 'Momentum Trading Agent Configuration',
    schema: {
      lookback_period: {
        type: 'number',
        default: 20,
        min: 5,
        max: 200,
        description: 'Number of periods to calculate momentum'
      },
      momentum_threshold: {
        type: 'number',
        default: 0.02,
        min: 0.001,
        max: 0.1,
        description: 'Minimum momentum value to trigger trade'
      },
      stop_loss: {
        type: 'number',
        default: 0.05,
        min: 0.01,
        max: 0.2,
        description: 'Stop loss percentage'
      },
      take_profit: {
        type: 'number',
        default: 0.10,
        min: 0.02,
        max: 0.5,
        description: 'Take profit percentage'
      },
      position_size: {
        type: 'number',
        default: 0.1,
        min: 0.01,
        max: 1.0,
        description: 'Position size as fraction of portfolio'
      }
    },
    example: {
      lookback_period: 20,
      momentum_threshold: 0.02,
      stop_loss: 0.05,
      take_profit: 0.10,
      position_size: 0.1
    }
  },

  'pairs-trading': {
    name: 'Pairs Trading Agent Configuration',
    schema: {
      lookback_period: {
        type: 'number',
        default: 60,
        min: 20,
        max: 252,
        description: 'Historical period for cointegration test'
      },
      entry_threshold: {
        type: 'number',
        default: 2.0,
        min: 1.0,
        max: 4.0,
        description: 'Z-score threshold for entry'
      },
      exit_threshold: {
        type: 'number',
        default: 0.5,
        min: 0.1,
        max: 1.5,
        description: 'Z-score threshold for exit'
      },
      cointegration_test: {
        type: 'string',
        default: 'adf',
        options: ['adf', 'johansen', 'engle-granger'],
        description: 'Cointegration test method'
      },
      hedge_ratio_method: {
        type: 'string',
        default: 'ols',
        options: ['ols', 'tls', 'kalman'],
        description: 'Method to calculate hedge ratio'
      }
    },
    example: {
      lookback_period: 60,
      entry_threshold: 2.0,
      exit_threshold: 0.5,
      cointegration_test: 'adf',
      hedge_ratio_method: 'ols',
      pairs: [
        { asset1: 'AAPL', asset2: 'MSFT' },
        { asset1: 'SPY', asset2: 'QQQ' }
      ]
    }
  },

  'mean-reversion': {
    name: 'Mean Reversion Agent Configuration',
    schema: {
      lookback_period: {
        type: 'number',
        default: 20,
        min: 10,
        max: 100,
        description: 'Period for mean calculation'
      },
      entry_std: {
        type: 'number',
        default: 2.0,
        min: 1.0,
        max: 4.0,
        description: 'Standard deviations for entry signal'
      },
      exit_std: {
        type: 'number',
        default: 0.5,
        min: 0.1,
        max: 1.5,
        description: 'Standard deviations for exit signal'
      },
      bollinger_bands: {
        type: 'boolean',
        default: true,
        description: 'Use Bollinger Bands indicator'
      },
      rsi_threshold: {
        type: 'number',
        default: 30,
        min: 20,
        max: 40,
        description: 'RSI threshold for oversold condition'
      }
    },
    example: {
      lookback_period: 20,
      entry_std: 2.0,
      exit_std: 0.5,
      bollinger_bands: true,
      rsi_threshold: 30,
      symbols: ['AAPL', 'MSFT', 'GOOGL']
    }
  },

  portfolio: {
    name: 'Portfolio Optimization Agent Configuration',
    schema: {
      optimization_method: {
        type: 'string',
        default: 'mean-variance',
        options: ['mean-variance', 'risk-parity', 'black-litterman', 'hierarchical-risk-parity'],
        description: 'Portfolio optimization method'
      },
      rebalance_frequency: {
        type: 'string',
        default: 'weekly',
        options: ['daily', 'weekly', 'monthly', 'quarterly'],
        description: 'How often to rebalance'
      },
      max_position_weight: {
        type: 'number',
        default: 0.2,
        min: 0.05,
        max: 1.0,
        description: 'Maximum weight for single position'
      },
      min_position_weight: {
        type: 'number',
        default: 0.05,
        min: 0.01,
        max: 0.2,
        description: 'Minimum weight for single position'
      },
      risk_target: {
        type: 'number',
        default: 0.15,
        min: 0.05,
        max: 0.5,
        description: 'Target portfolio volatility'
      }
    },
    example: {
      optimization_method: 'mean-variance',
      rebalance_frequency: 'weekly',
      max_position_weight: 0.2,
      min_position_weight: 0.05,
      risk_target: 0.15,
      constraints: {
        max_turnover: 0.3,
        transaction_cost: 0.001
      }
    }
  },

  'risk-manager': {
    name: 'Risk Management Agent Configuration',
    schema: {
      max_portfolio_var: {
        type: 'number',
        default: 0.02,
        min: 0.005,
        max: 0.1,
        description: 'Maximum portfolio Value at Risk'
      },
      max_position_size: {
        type: 'number',
        default: 0.1,
        min: 0.01,
        max: 0.5,
        description: 'Maximum position size as fraction'
      },
      max_correlation: {
        type: 'number',
        default: 0.7,
        min: 0.3,
        max: 0.95,
        description: 'Maximum correlation between positions'
      },
      stress_test_frequency: {
        type: 'string',
        default: 'daily',
        options: ['realtime', 'hourly', 'daily', 'weekly'],
        description: 'How often to run stress tests'
      },
      var_confidence: {
        type: 'number',
        default: 0.95,
        min: 0.9,
        max: 0.99,
        description: 'VaR confidence level'
      }
    },
    example: {
      max_portfolio_var: 0.02,
      max_position_size: 0.1,
      max_correlation: 0.7,
      stress_test_frequency: 'daily',
      var_confidence: 0.95,
      risk_limits: {
        max_drawdown: 0.15,
        max_leverage: 2.0,
        concentration_limit: 0.25
      }
    }
  },

  'news-trader': {
    name: 'News Sentiment Trading Agent Configuration',
    schema: {
      sentiment_threshold: {
        type: 'number',
        default: 0.6,
        min: 0.5,
        max: 0.95,
        description: 'Minimum sentiment score to trade'
      },
      news_sources: {
        type: 'array',
        default: ['bloomberg', 'reuters', 'twitter'],
        options: ['bloomberg', 'reuters', 'twitter', 'reddit', 'news-api'],
        description: 'News sources to monitor'
      },
      event_types: {
        type: 'array',
        default: ['earnings', 'economic', 'political'],
        options: ['earnings', 'economic', 'political', 'merger', 'product'],
        description: 'Types of events to track'
      },
      reaction_time: {
        type: 'number',
        default: 5000,
        min: 1000,
        max: 60000,
        description: 'Reaction time in milliseconds'
      },
      sentiment_model: {
        type: 'string',
        default: 'transformer',
        options: ['transformer', 'lstm', 'vader', 'textblob'],
        description: 'Sentiment analysis model'
      }
    },
    example: {
      sentiment_threshold: 0.6,
      news_sources: ['bloomberg', 'reuters', 'twitter'],
      event_types: ['earnings', 'economic', 'political'],
      reaction_time: 5000,
      sentiment_model: 'transformer',
      filters: {
        min_article_quality: 0.7,
        language: 'en',
        exclude_keywords: ['rumor', 'unconfirmed']
      }
    }
  },

  'market-maker': {
    name: 'Market Making Agent Configuration',
    schema: {
      spread_target: {
        type: 'number',
        default: 0.001,
        min: 0.0001,
        max: 0.01,
        description: 'Target bid-ask spread'
      },
      inventory_limit: {
        type: 'number',
        default: 1000,
        min: 100,
        max: 10000,
        description: 'Maximum inventory size'
      },
      quote_size: {
        type: 'number',
        default: 100,
        min: 10,
        max: 1000,
        description: 'Size of each quote'
      },
      skew_factor: {
        type: 'number',
        default: 0.5,
        min: 0.1,
        max: 2.0,
        description: 'Inventory skew adjustment factor'
      },
      quote_frequency: {
        type: 'number',
        default: 1000,
        min: 100,
        max: 10000,
        description: 'Quote update frequency in milliseconds'
      }
    },
    example: {
      spread_target: 0.001,
      inventory_limit: 1000,
      quote_size: 100,
      skew_factor: 0.5,
      quote_frequency: 1000,
      risk_controls: {
        max_adverse_selection: 0.01,
        min_profitability: 0.0005
      }
    }
  }
};

/**
 * Validate agent configuration
 */
function validateAgentConfig(type, config) {
  const template = AGENT_CONFIG_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown agent type: ${type}`);
  }

  const errors = [];
  const schema = template.schema;

  for (const [key, field] of Object.entries(schema)) {
    const value = config[key];

    // Check required fields
    if (value === undefined && field.default === undefined) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (value === undefined) {
      continue; // Use default
    }

    // Type validation
    if (field.type === 'number') {
      if (typeof value !== 'number') {
        errors.push(`${key} must be a number`);
        continue;
      }

      if (field.min !== undefined && value < field.min) {
        errors.push(`${key} must be >= ${field.min}`);
      }

      if (field.max !== undefined && value > field.max) {
        errors.push(`${key} must be <= ${field.max}`);
      }
    } else if (field.type === 'string') {
      if (typeof value !== 'string') {
        errors.push(`${key} must be a string`);
        continue;
      }

      if (field.options && !field.options.includes(value)) {
        errors.push(`${key} must be one of: ${field.options.join(', ')}`);
      }
    } else if (field.type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(`${key} must be a boolean`);
      }
    } else if (field.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${key} must be an array`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n  ${errors.join('\n  ')}`);
  }

  return true;
}

/**
 * Get configuration template for agent type
 */
function getAgentConfigTemplate(type) {
  const template = AGENT_CONFIG_TEMPLATES[type];
  if (!template) {
    throw new Error(`Unknown agent type: ${type}`);
  }

  return {
    name: template.name,
    schema: template.schema,
    example: template.example
  };
}

/**
 * Generate configuration file
 */
function generateConfigFile(type, outputPath = null) {
  const template = getAgentConfigTemplate(type);

  const config = {
    agent: {
      type,
      name: `${type}-agent`,
      config: template.example
    },
    metadata: {
      version: '1.0.0',
      created: new Date().toISOString(),
      schema: template.name
    }
  };

  const json = JSON.stringify(config, null, 2);

  if (outputPath) {
    const fs = require('fs');
    fs.writeFileSync(outputPath, json);
    return outputPath;
  }

  return json;
}

module.exports = {
  AGENT_CONFIG_TEMPLATES,
  validateAgentConfig,
  getAgentConfigTemplate,
  generateConfigFile
};

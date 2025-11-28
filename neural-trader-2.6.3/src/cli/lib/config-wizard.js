/**
 * Configuration Wizard - Interactive setup
 * STUB IMPLEMENTATION - To be completed
 */

class ConfigWizard {
  constructor() {
    this.steps = [
      'trading_provider',
      'symbols',
      'strategy',
      'risk_management',
      'monitoring'
    ];
  }

  /**
   * Run interactive wizard
   */
  async run() {
    console.log('Configuration Wizard (stub implementation)');
    console.log('Interactive prompts would appear here...\n');

    // Return stub configuration
    return {
      success: true,
      config: {
        trading: {
          provider: 'alpaca',
          symbols: ['AAPL', 'MSFT'],
          strategy: 'momentum'
        },
        risk: {
          maxPositionSize: 10000,
          maxPortfolioRisk: 0.02
        },
        monitoring: {
          enabled: true
        }
      }
    };
  }

  /**
   * Run specific step
   */
  async runStep(stepName) {
    console.log(`Running wizard step: ${stepName} (stub)`);

    return {
      success: true,
      stepName,
      value: null
    };
  }

  /**
   * Validate wizard input
   */
  validate(stepName, value) {
    return {
      valid: true,
      errors: []
    };
  }
}

module.exports = ConfigWizard;

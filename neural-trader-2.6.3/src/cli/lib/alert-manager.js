/**
 * Alert Manager - Alert rules and notifications
 * STUB IMPLEMENTATION - Based on MONITOR_IMPLEMENTATION.md
 */

const EventEmitter = require('events');

class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = options;
    this.alerts = [];
    this.rules = new Map();

    // Default alert rules
    this.registerDefaultRules();
  }

  /**
   * Register default alert rules
   */
  registerDefaultRules() {
    this.addRule('high_loss', {
      condition: (data) => data.pnl && data.pnl.today < -1000,
      severity: 'error',
      message: 'High daily loss detected'
    });

    this.addRule('high_drawdown', {
      condition: (data) => data.metrics && data.metrics.maxDrawdown > 0.1,
      severity: 'warning',
      message: 'High drawdown detected'
    });

    this.addRule('low_win_rate', {
      condition: (data) => data.pnl && data.pnl.winRate < 0.4,
      severity: 'warning',
      message: 'Low win rate detected'
    });
  }

  /**
   * Add alert rule
   */
  addRule(name, rule) {
    this.rules.set(name, {
      name,
      ...rule,
      enabled: true
    });

    return {
      success: true,
      rule: name
    };
  }

  /**
   * Remove alert rule
   */
  removeRule(name) {
    const existed = this.rules.delete(name);

    return {
      success: existed,
      message: existed ? 'Rule removed' : 'Rule not found'
    };
  }

  /**
   * Evaluate rules against data
   */
  evaluate(data) {
    const triggeredAlerts = [];

    for (const [name, rule] of this.rules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(data)) {
          const alert = {
            id: `alert_${Date.now()}_${name}`,
            rule: name,
            severity: rule.severity,
            message: rule.message,
            timestamp: new Date(),
            acknowledged: false,
            data: { ...data }
          };

          this.alerts.push(alert);
          triggeredAlerts.push(alert);
          this.emit('alert', alert);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${name}:`, error.message);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Get all alerts
   */
  getAlerts(options = {}) {
    let alerts = [...this.alerts];

    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }

    if (!options.includeAcknowledged) {
      alerts = alerts.filter(a => !a.acknowledged);
    }

    return alerts;
  }

  /**
   * Acknowledge alert
   */
  acknowledge(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);

    if (!alert) {
      return {
        success: false,
        message: 'Alert not found'
      };
    }

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();

    this.emit('alertAcknowledged', alert);

    return {
      success: true,
      alert
    };
  }

  /**
   * Clear acknowledged alerts
   */
  clearAcknowledged() {
    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a => !a.acknowledged);
    const cleared = before - this.alerts.length;

    return {
      success: true,
      cleared
    };
  }

  /**
   * Clear all alerts
   */
  clearAll() {
    const count = this.alerts.length;
    this.alerts = [];

    return {
      success: true,
      cleared: count
    };
  }
}

module.exports = AlertManager;

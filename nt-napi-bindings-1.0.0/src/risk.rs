//! Risk management bindings for Node.js
//!
//! Provides NAPI bindings for risk calculations including:
//! - Value at Risk (VaR)
//! - Conditional VaR (CVaR)
//! - Kelly Criterion
//! - Drawdown analysis
//! - Position sizing

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Risk calculation configuration
#[napi(object)]
pub struct RiskConfig {
    pub confidence_level: f64,  // 0.95 for 95% confidence
    pub lookback_periods: u32,  // Number of historical periods
    pub method: String,         // "parametric", "historical", "monte_carlo"
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            confidence_level: 0.95,
            lookback_periods: 252,  // 1 year of daily data
            method: "historical".to_string(),
        }
    }
}

/// VaR calculation result
#[napi(object)]
pub struct VaRResult {
    pub var_amount: f64,
    pub var_percentage: f64,
    pub confidence_level: f64,
    pub method: String,
    pub portfolio_value: f64,
}

/// CVaR (Expected Shortfall) result
#[napi(object)]
pub struct CVaRResult {
    pub cvar_amount: f64,
    pub cvar_percentage: f64,
    pub var_amount: f64,
    pub confidence_level: f64,
}

/// Drawdown metrics
#[napi(object)]
pub struct DrawdownMetrics {
    pub max_drawdown: f64,
    pub max_drawdown_duration: u32,  // In periods
    pub current_drawdown: f64,
    pub recovery_factor: f64,
}

/// Kelly Criterion result for position sizing
#[napi(object)]
pub struct KellyResult {
    pub kelly_fraction: f64,
    pub half_kelly: f64,
    pub quarter_kelly: f64,
    pub win_rate: f64,
    pub avg_win: f64,
    pub avg_loss: f64,
}

/// Position sizing recommendation
#[napi(object)]
pub struct PositionSize {
    pub shares: u32,
    pub dollar_amount: f64,
    pub percentage_of_portfolio: f64,
    pub max_loss: f64,
    pub reasoning: String,
}

/// Risk manager for portfolio risk calculations
#[napi]
pub struct RiskManager {
    config: RiskConfig,
}

#[napi]
impl RiskManager {
    /// Create a new risk manager
    #[napi(constructor)]
    pub fn new(config: RiskConfig) -> Self {
        tracing::info!(
            "Creating risk manager with {} confidence, {} method",
            config.confidence_level,
            config.method
        );

        Self { config }
    }

    /// Calculate Value at Risk
    #[napi]
    pub fn calculate_var(&self, returns: Vec<f64>, portfolio_value: f64) -> Result<VaRResult> {
        if returns.is_empty() {
            return Err(Error::from_reason("Returns data is empty"));
        }

        tracing::debug!("Calculating VaR for {} returns", returns.len());

        // TODO: Implement actual VaR calculation using nt-risk crate
        // For now, use simplified historical VaR
        let mut sorted_returns = returns.clone();
        sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let index = ((1.0 - self.config.confidence_level) * sorted_returns.len() as f64) as usize;
        let var_percentage = -sorted_returns[index.min(sorted_returns.len() - 1)];
        let var_amount = var_percentage * portfolio_value;

        Ok(VaRResult {
            var_amount,
            var_percentage,
            confidence_level: self.config.confidence_level,
            method: self.config.method.clone(),
            portfolio_value,
        })
    }

    /// Calculate Conditional VaR (Expected Shortfall)
    #[napi]
    pub fn calculate_cvar(&self, returns: Vec<f64>, portfolio_value: f64) -> Result<CVaRResult> {
        if returns.is_empty() {
            return Err(Error::from_reason("Returns data is empty"));
        }

        tracing::debug!("Calculating CVaR for {} returns", returns.len());

        // First calculate VaR
        let var_result = self.calculate_var(returns.clone(), portfolio_value)?;

        // TODO: Implement actual CVaR calculation using nt-risk crate
        // For now, use simplified calculation
        let mut sorted_returns = returns;
        sorted_returns.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let var_threshold = -var_result.var_percentage;
        let tail_returns: Vec<f64> = sorted_returns
            .iter()
            .filter(|&&r| r <= var_threshold)
            .copied()
            .collect();

        let cvar_percentage = if !tail_returns.is_empty() {
            -tail_returns.iter().sum::<f64>() / tail_returns.len() as f64
        } else {
            var_result.var_percentage
        };

        let cvar_amount = cvar_percentage * portfolio_value;

        Ok(CVaRResult {
            cvar_amount,
            cvar_percentage,
            var_amount: var_result.var_amount,
            confidence_level: self.config.confidence_level,
        })
    }

    /// Calculate Kelly Criterion for position sizing
    #[napi]
    pub fn calculate_kelly(
        &self,
        win_rate: f64,
        avg_win: f64,
        avg_loss: f64,
    ) -> Result<KellyResult> {
        if !(0.0..=1.0).contains(&win_rate) {
            return Err(Error::from_reason("Win rate must be between 0 and 1"));
        }

        if avg_win <= 0.0 || avg_loss <= 0.0 {
            return Err(Error::from_reason("Average win and loss must be positive"));
        }

        tracing::debug!(
            "Calculating Kelly: win_rate={}, avg_win={}, avg_loss={}",
            win_rate,
            avg_win,
            avg_loss
        );

        // Kelly formula: f = (p * b - q) / b
        // where p = win rate, q = loss rate, b = win/loss ratio
        let b = avg_win / avg_loss;
        let p = win_rate;
        let q = 1.0 - win_rate;

        let kelly_fraction = ((p * b) - q) / b;
        let kelly_fraction = kelly_fraction.max(0.0).min(1.0); // Clamp between 0 and 1

        Ok(KellyResult {
            kelly_fraction,
            half_kelly: kelly_fraction / 2.0,
            quarter_kelly: kelly_fraction / 4.0,
            win_rate,
            avg_win,
            avg_loss,
        })
    }

    /// Calculate drawdown metrics
    #[napi]
    pub fn calculate_drawdown(&self, equity_curve: Vec<f64>) -> Result<DrawdownMetrics> {
        if equity_curve.is_empty() {
            return Err(Error::from_reason("Equity curve is empty"));
        }

        tracing::debug!("Calculating drawdown for {} data points", equity_curve.len());

        // TODO: Implement actual drawdown calculation using nt-risk crate
        let mut max_drawdown = 0.0;
        let mut max_drawdown_duration = 0u32;
        let mut current_drawdown = 0.0;
        let mut peak = equity_curve[0];
        let mut current_duration = 0u32;

        for &value in &equity_curve {
            if value > peak {
                peak = value;
                current_duration = 0;
            } else {
                current_duration += 1;
                let drawdown = (peak - value) / peak;
                current_drawdown = drawdown;

                if drawdown > max_drawdown {
                    max_drawdown = drawdown;
                    max_drawdown_duration = current_duration;
                }
            }
        }

        let recovery_factor = if max_drawdown > 0.0 {
            let total_return = (equity_curve.last().unwrap() - equity_curve[0]) / equity_curve[0];
            total_return / max_drawdown
        } else {
            0.0
        };

        Ok(DrawdownMetrics {
            max_drawdown,
            max_drawdown_duration,
            current_drawdown,
            recovery_factor,
        })
    }

    /// Calculate recommended position size
    #[napi]
    pub fn calculate_position_size(
        &self,
        portfolio_value: f64,
        price_per_share: f64,
        risk_per_trade: f64,  // As percentage (e.g., 0.02 for 2%)
        stop_loss_distance: f64,  // In dollars
    ) -> Result<PositionSize> {
        if portfolio_value <= 0.0 {
            return Err(Error::from_reason("Portfolio value must be positive"));
        }

        if price_per_share <= 0.0 {
            return Err(Error::from_reason("Price per share must be positive"));
        }

        if risk_per_trade <= 0.0 || risk_per_trade > 1.0 {
            return Err(Error::from_reason("Risk per trade must be between 0 and 1"));
        }

        tracing::debug!(
            "Calculating position size: portfolio=${}, price=${}, risk={}%, stop=${}",
            portfolio_value,
            price_per_share,
            risk_per_trade * 100.0,
            stop_loss_distance
        );

        // Position size = (Account Value × Risk per Trade) / Stop Loss Distance
        let max_risk_amount = portfolio_value * risk_per_trade;

        let shares = if stop_loss_distance > 0.0 {
            (max_risk_amount / stop_loss_distance).floor() as u32
        } else {
            // If no stop loss, use simple percentage of portfolio
            (portfolio_value * risk_per_trade / price_per_share).floor() as u32
        };

        let dollar_amount = shares as f64 * price_per_share;
        let percentage = dollar_amount / portfolio_value;

        Ok(PositionSize {
            shares,
            dollar_amount,
            percentage_of_portfolio: percentage,
            max_loss: max_risk_amount,
            reasoning: format!(
                "Risking ${:.2} ({}%) on this trade with {} shares",
                max_risk_amount,
                risk_per_trade * 100.0,
                shares
            ),
        })
    }

    /// Validate if a position passes risk limits
    #[napi]
    pub fn validate_position(
        &self,
        position_size: f64,
        portfolio_value: f64,
        max_position_percentage: f64,
    ) -> Result<bool> {
        let position_percentage = position_size / portfolio_value;

        if position_percentage > max_position_percentage {
            return Err(Error::from_reason(format!(
                "Position size ({:.2}%) exceeds maximum allowed ({:.2}%)",
                position_percentage * 100.0,
                max_position_percentage * 100.0
            )));
        }

        Ok(true)
    }
}

/// Calculate Sharpe Ratio
#[napi]
pub fn calculate_sharpe_ratio(
    returns: Vec<f64>,
    risk_free_rate: f64,
    annualization_factor: f64,
) -> Result<f64> {
    if returns.is_empty() {
        return Err(Error::from_reason("Returns data is empty"));
    }

    let mean_return: f64 = returns.iter().sum::<f64>() / returns.len() as f64;
    let variance: f64 = returns
        .iter()
        .map(|r| (r - mean_return).powi(2))
        .sum::<f64>()
        / returns.len() as f64;

    let std_dev = variance.sqrt();

    if std_dev == 0.0 {
        return Ok(0.0);
    }

    let excess_return = mean_return - risk_free_rate;
    let sharpe = (excess_return / std_dev) * annualization_factor.sqrt();

    Ok(sharpe)
}

/// Calculate Sortino Ratio (uses downside deviation only)
#[napi]
pub fn calculate_sortino_ratio(
    returns: Vec<f64>,
    target_return: f64,
    annualization_factor: f64,
) -> Result<f64> {
    if returns.is_empty() {
        return Err(Error::from_reason("Returns data is empty"));
    }

    let mean_return: f64 = returns.iter().sum::<f64>() / returns.len() as f64;

    // Calculate downside deviation
    let downside_returns: Vec<f64> = returns
        .iter()
        .filter(|&&r| r < target_return)
        .copied()
        .collect();

    if downside_returns.is_empty() {
        return Ok(f64::INFINITY);
    }

    let downside_variance: f64 = downside_returns
        .iter()
        .map(|r| (r - target_return).powi(2))
        .sum::<f64>()
        / downside_returns.len() as f64;

    let downside_deviation = downside_variance.sqrt();

    if downside_deviation == 0.0 {
        return Ok(f64::INFINITY);
    }

    let excess_return = mean_return - target_return;
    let sortino = (excess_return / downside_deviation) * annualization_factor.sqrt();

    Ok(sortino)
}

/// Calculate maximum leverage allowed
#[napi]
pub fn calculate_max_leverage(
    _portfolio_value: f64,
    volatility: f64,
    max_volatility_target: f64,
) -> Result<f64> {
    if volatility <= 0.0 {
        return Err(Error::from_reason("Volatility must be positive"));
    }

    if max_volatility_target <= 0.0 {
        return Err(Error::from_reason("Max volatility target must be positive"));
    }

    let max_leverage = max_volatility_target / volatility;

    // Cap leverage at reasonable maximum
    Ok(max_leverage.min(3.0))
}

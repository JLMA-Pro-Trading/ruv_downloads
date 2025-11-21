// Performance metrics calculation
//
// Features:
// - Sharpe ratio
// - Sortino ratio
// - Maximum drawdown
// - Win rate
// - Average win/loss
// - Profit factor

use crate::{PortfolioError, Result};
use rust_decimal::Decimal;
use serde::Serialize;

/// Performance metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    /// Sharpe ratio (risk-adjusted return)
    pub sharpe_ratio: f64,
    /// Sortino ratio (downside risk-adjusted return)
    pub sortino_ratio: f64,
    /// Maximum drawdown (percentage)
    pub max_drawdown: Decimal,
    /// Win rate (percentage of winning trades)
    pub win_rate: Decimal,
    /// Average win amount
    pub avg_win: Decimal,
    /// Average loss amount
    pub avg_loss: Decimal,
    /// Profit factor (total wins / total losses)
    pub profit_factor: Decimal,
    /// Total return (percentage)
    pub total_return: Decimal,
    /// Number of trades
    pub num_trades: usize,
}

/// Metrics calculator
pub struct MetricsCalculator;

impl MetricsCalculator {
    /// Calculate Sharpe ratio
    ///
    /// Sharpe Ratio = (Mean Return - Risk-Free Rate) / Std Dev of Returns
    ///
    /// # Arguments
    /// * `returns` - Historical returns (e.g., daily P&L)
    /// * `risk_free_rate` - Risk-free rate (e.g., 0.04 for 4% annual)
    pub fn sharpe_ratio(returns: &[f64], risk_free_rate: f64) -> Result<f64> {
        if returns.len() < 2 {
            return Err(PortfolioError::InsufficientData(
                "Need at least 2 returns for Sharpe ratio".to_string(),
            ));
        }

        let n = returns.len() as f64;
        let mean_return = returns.iter().sum::<f64>() / n;

        // Calculate standard deviation
        let variance: f64 = returns
            .iter()
            .map(|r| (r - mean_return).powi(2))
            .sum::<f64>()
            / (n - 1.0);
        let std_dev = variance.sqrt();

        if std_dev == 0.0 {
            return Err(PortfolioError::InvalidCalculation(
                "Zero standard deviation".to_string(),
            ));
        }

        Ok((mean_return - risk_free_rate) / std_dev)
    }

    /// Calculate Sortino ratio
    ///
    /// Sortino Ratio = (Mean Return - Risk-Free Rate) / Downside Deviation
    /// Only considers downside volatility (negative returns)
    ///
    /// # Arguments
    /// * `returns` - Historical returns
    /// * `risk_free_rate` - Risk-free rate
    pub fn sortino_ratio(returns: &[f64], risk_free_rate: f64) -> Result<f64> {
        if returns.len() < 2 {
            return Err(PortfolioError::InsufficientData(
                "Need at least 2 returns for Sortino ratio".to_string(),
            ));
        }

        let n = returns.len() as f64;
        let mean_return = returns.iter().sum::<f64>() / n;

        // Calculate downside deviation (only negative returns)
        let downside_returns: Vec<f64> = returns
            .iter()
            .filter(|&&r| r < 0.0)
            .copied()
            .collect();

        if downside_returns.is_empty() {
            // No negative returns - perfect Sortino
            return Ok(f64::INFINITY);
        }

        let downside_variance: f64 = downside_returns
            .iter()
            .map(|r| r.powi(2))
            .sum::<f64>()
            / downside_returns.len() as f64;
        let downside_deviation = downside_variance.sqrt();

        if downside_deviation == 0.0 {
            return Err(PortfolioError::InvalidCalculation(
                "Zero downside deviation".to_string(),
            ));
        }

        Ok((mean_return - risk_free_rate) / downside_deviation)
    }

    /// Calculate maximum drawdown
    ///
    /// Max Drawdown = (Trough Value - Peak Value) / Peak Value
    ///
    /// # Arguments
    /// * `equity_curve` - Historical portfolio values
    pub fn max_drawdown(equity_curve: &[Decimal]) -> Result<Decimal> {
        if equity_curve.len() < 2 {
            return Err(PortfolioError::InsufficientData(
                "Need at least 2 values for max drawdown".to_string(),
            ));
        }

        let mut max_dd = Decimal::ZERO;
        let mut peak = equity_curve[0];

        for &value in equity_curve.iter().skip(1) {
            if value > peak {
                peak = value;
            }

            let drawdown = if peak > Decimal::ZERO {
                ((peak - value) / peak) * Decimal::from(100)
            } else {
                Decimal::ZERO
            };

            if drawdown > max_dd {
                max_dd = drawdown;
            }
        }

        Ok(max_dd)
    }

    /// Calculate win rate
    ///
    /// Win Rate = Number of Winning Trades / Total Trades
    ///
    /// # Arguments
    /// * `trade_pnls` - P&L for each trade
    pub fn win_rate(trade_pnls: &[Decimal]) -> Result<Decimal> {
        if trade_pnls.is_empty() {
            return Err(PortfolioError::InsufficientData(
                "Need at least 1 trade for win rate".to_string(),
            ));
        }

        let winning_trades = trade_pnls.iter().filter(|&&pnl| pnl > Decimal::ZERO).count();
        let total_trades = trade_pnls.len();

        Ok(Decimal::from(winning_trades) / Decimal::from(total_trades) * Decimal::from(100))
    }

    /// Calculate average win and loss
    pub fn avg_win_loss(trade_pnls: &[Decimal]) -> Result<(Decimal, Decimal)> {
        if trade_pnls.is_empty() {
            return Err(PortfolioError::InsufficientData(
                "Need at least 1 trade".to_string(),
            ));
        }

        let wins: Vec<Decimal> = trade_pnls
            .iter()
            .filter(|&&pnl| pnl > Decimal::ZERO)
            .copied()
            .collect();

        let losses: Vec<Decimal> = trade_pnls
            .iter()
            .filter(|&&pnl| pnl < Decimal::ZERO)
            .map(|&pnl| -pnl) // Convert to positive
            .collect();

        let avg_win = if !wins.is_empty() {
            wins.iter().sum::<Decimal>() / Decimal::from(wins.len())
        } else {
            Decimal::ZERO
        };

        let avg_loss = if !losses.is_empty() {
            losses.iter().sum::<Decimal>() / Decimal::from(losses.len())
        } else {
            Decimal::ZERO
        };

        Ok((avg_win, avg_loss))
    }

    /// Calculate profit factor
    ///
    /// Profit Factor = Total Wins / Total Losses
    ///
    /// # Arguments
    /// * `trade_pnls` - P&L for each trade
    pub fn profit_factor(trade_pnls: &[Decimal]) -> Result<Decimal> {
        if trade_pnls.is_empty() {
            return Err(PortfolioError::InsufficientData(
                "Need at least 1 trade for profit factor".to_string(),
            ));
        }

        let total_wins: Decimal = trade_pnls
            .iter()
            .filter(|&&pnl| pnl > Decimal::ZERO)
            .sum();

        let total_losses: Decimal = trade_pnls
            .iter()
            .filter(|&&pnl| pnl < Decimal::ZERO)
            .map(|&pnl| -pnl)
            .sum();

        if total_losses == Decimal::ZERO {
            if total_wins > Decimal::ZERO {
                return Ok(Decimal::MAX); // Perfect profit factor
            } else {
                return Ok(Decimal::ZERO);
            }
        }

        Ok(total_wins / total_losses)
    }

    /// Calculate comprehensive performance metrics
    pub fn calculate_all(
        returns: &[f64],
        equity_curve: &[Decimal],
        trade_pnls: &[Decimal],
        risk_free_rate: f64,
    ) -> Result<PerformanceMetrics> {
        let sharpe_ratio = Self::sharpe_ratio(returns, risk_free_rate).unwrap_or(0.0);
        let sortino_ratio = Self::sortino_ratio(returns, risk_free_rate).unwrap_or(0.0);
        let max_drawdown = Self::max_drawdown(equity_curve)?;
        let win_rate = Self::win_rate(trade_pnls)?;
        let (avg_win, avg_loss) = Self::avg_win_loss(trade_pnls)?;
        let profit_factor = Self::profit_factor(trade_pnls)?;

        let total_return = if !equity_curve.is_empty() && equity_curve[0] > Decimal::ZERO {
            let initial = equity_curve[0];
            let final_value = equity_curve[equity_curve.len() - 1];
            ((final_value - initial) / initial) * Decimal::from(100)
        } else {
            Decimal::ZERO
        };

        Ok(PerformanceMetrics {
            sharpe_ratio,
            sortino_ratio,
            max_drawdown,
            win_rate,
            avg_win,
            avg_loss,
            profit_factor,
            total_return,
            num_trades: trade_pnls.len(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn test_sharpe_ratio() {
        // Returns with some volatility
        let returns = vec![0.01, 0.02, -0.01, 0.03, -0.02, 0.01];
        let sharpe = MetricsCalculator::sharpe_ratio(&returns, 0.0).unwrap();

        // With positive mean return and volatility, Sharpe should be positive
        assert!(sharpe > 0.0);
    }

    #[test]
    fn test_sortino_ratio() {
        let returns = vec![0.01, 0.02, -0.01, 0.03, -0.02, 0.01];
        let sortino = MetricsCalculator::sortino_ratio(&returns, 0.0).unwrap();

        // Sortino should be positive with positive mean return
        assert!(sortino > 0.0);

        // With only downside volatility considered, Sortino should be >= Sharpe
        let sharpe = MetricsCalculator::sharpe_ratio(&returns, 0.0).unwrap();
        assert!(sortino >= sharpe);
    }

    #[test]
    fn test_max_drawdown() {
        let equity_curve = vec![
            Decimal::from(10000),
            Decimal::from(11000),
            Decimal::from(10500), // 4.5% drawdown from peak
            Decimal::from(9500),  // 13.6% drawdown from peak
            Decimal::from(10000),
        ];

        let max_dd = MetricsCalculator::max_drawdown(&equity_curve).unwrap();

        // Max drawdown should be around 13.6%
        assert!(max_dd > Decimal::from(13));
        assert!(max_dd < Decimal::from(14));
    }

    #[test]
    fn test_win_rate() {
        let trade_pnls = vec![
            Decimal::from(100),
            Decimal::from(-50),
            Decimal::from(75),
            Decimal::from(-25),
            Decimal::from(50),
        ];

        let win_rate = MetricsCalculator::win_rate(&trade_pnls).unwrap();

        // 3 wins out of 5 = 60%
        assert_eq!(win_rate, Decimal::from(60));
    }

    #[test]
    fn test_profit_factor() {
        let trade_pnls = vec![
            Decimal::from(100),  // win
            Decimal::from(-50),  // loss
            Decimal::from(75),   // win
            Decimal::from(-25),  // loss
        ];

        let pf = MetricsCalculator::profit_factor(&trade_pnls).unwrap();

        // Total wins: 175, Total losses: 75
        // Profit factor: 175 / 75 = 2.33...
        assert!(pf > Decimal::from_f64_retain(2.3).unwrap());
        assert!(pf < Decimal::from_f64_retain(2.4).unwrap());
    }

    #[test]
    fn test_avg_win_loss() {
        let trade_pnls = vec![
            Decimal::from(100),
            Decimal::from(-50),
            Decimal::from(200),
            Decimal::from(-100),
        ];

        let (avg_win, avg_loss) = MetricsCalculator::avg_win_loss(&trade_pnls).unwrap();

        // Average win: (100 + 200) / 2 = 150
        assert_eq!(avg_win, Decimal::from(150));

        // Average loss: (50 + 100) / 2 = 75
        assert_eq!(avg_loss, Decimal::from(75));
    }
}

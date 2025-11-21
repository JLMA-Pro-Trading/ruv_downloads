//! Backtesting engine bindings for Node.js

use napi::bindgen_prelude::*;
use napi_derive::napi;

/// Backtest configuration
#[napi(object)]
pub struct BacktestConfig {
    pub initial_capital: f64,
    pub start_date: String,
    pub end_date: String,
    pub commission: f64,          // Per-share commission
    pub slippage: f64,            // Slippage as percentage
    pub use_mark_to_market: bool,
}

impl Default for BacktestConfig {
    fn default() -> Self {
        Self {
            initial_capital: 100000.0,
            start_date: "2023-01-01".to_string(),
            end_date: "2023-12-31".to_string(),
            commission: 0.001,
            slippage: 0.0005,
            use_mark_to_market: true,
        }
    }
}

/// Trade record from backtest
#[napi(object)]
pub struct Trade {
    pub symbol: String,
    pub entry_date: String,
    pub exit_date: String,
    pub entry_price: f64,
    pub exit_price: f64,
    pub quantity: i64,
    pub pnl: f64,
    pub pnl_percentage: f64,
    pub commission_paid: f64,
}

/// Backtest performance metrics
#[napi(object)]
pub struct BacktestMetrics {
    pub total_return: f64,
    pub annual_return: f64,
    pub sharpe_ratio: f64,
    pub sortino_ratio: f64,
    pub max_drawdown: f64,
    pub win_rate: f64,
    pub profit_factor: f64,
    pub total_trades: u32,
    pub winning_trades: u32,
    pub losing_trades: u32,
    pub avg_win: f64,
    pub avg_loss: f64,
    pub largest_win: f64,
    pub largest_loss: f64,
    pub final_equity: f64,
}

/// Backtest result
#[napi(object)]
pub struct BacktestResult {
    pub metrics: BacktestMetrics,
    pub trades: Vec<Trade>,
    pub equity_curve: Vec<f64>,
    pub dates: Vec<String>,
}

/// Backtesting engine
#[napi]
pub struct BacktestEngine {
    config: BacktestConfig,
}

#[napi]
impl BacktestEngine {
    /// Create a new backtest engine
    #[napi(constructor)]
    pub fn new(config: BacktestConfig) -> Self {
        tracing::info!(
            "Creating backtest engine: ${} capital, {} to {}",
            config.initial_capital,
            config.start_date,
            config.end_date
        );

        Self { config }
    }

    /// Run backtest with strategy signals
    #[napi]
    pub async fn run(
        &self,
        signals: Vec<crate::strategy::Signal>,
        _market_data: String,  // JSON string of market data
    ) -> Result<BacktestResult> {
        tracing::info!("Running backtest with {} signals", signals.len());

        // TODO: Implement actual backtesting using nt-backtesting crate
        // For now, return mock results

        let mut trades = Vec::new();
        let mut equity_curve = vec![self.config.initial_capital];
        let mut dates = vec![self.config.start_date.clone()];

        // Simulate some trades
        for (i, signal) in signals.iter().enumerate().take(10) {
            let entry_price = 100.0 + i as f64;
            let exit_price = entry_price * 1.02; // 2% profit
            let quantity = 100;

            let pnl = (exit_price - entry_price) * quantity as f64;
            let commission = self.config.commission * quantity as f64 * 2.0; // Buy + sell

            trades.push(Trade {
                symbol: signal.symbol.clone(),
                entry_date: format!("2023-{:02}-01", i + 1),
                exit_date: format!("2023-{:02}-15", i + 1),
                entry_price,
                exit_price,
                quantity,
                pnl: pnl - commission,
                pnl_percentage: ((exit_price - entry_price) / entry_price) * 100.0,
                commission_paid: commission,
            });

            let new_equity = equity_curve.last().unwrap() + pnl - commission;
            equity_curve.push(new_equity);
            dates.push(format!("2023-{:02}-15", i + 1));
        }

        let final_equity = *equity_curve.last().unwrap();
        let total_return = (final_equity - self.config.initial_capital) / self.config.initial_capital;

        let winning_trades = trades.iter().filter(|t| t.pnl > 0.0).count() as u32;
        let losing_trades = trades.len() as u32 - winning_trades;

        let metrics = BacktestMetrics {
            total_return,
            annual_return: total_return, // Simplified
            sharpe_ratio: 1.5,
            sortino_ratio: 2.0,
            max_drawdown: 0.1,
            win_rate: winning_trades as f64 / trades.len() as f64,
            profit_factor: 2.0,
            total_trades: trades.len() as u32,
            winning_trades,
            losing_trades,
            avg_win: 200.0,
            avg_loss: -100.0,
            largest_win: 500.0,
            largest_loss: -200.0,
            final_equity,
        };

        Ok(BacktestResult {
            metrics,
            trades,
            equity_curve,
            dates,
        })
    }

    /// Calculate performance metrics from equity curve
    #[napi]
    pub fn calculate_metrics(&self, equity_curve: Vec<f64>) -> Result<BacktestMetrics> {
        if equity_curve.len() < 2 {
            return Err(Error::from_reason("Equity curve too short"));
        }

        // Calculate returns
        let returns: Vec<f64> = equity_curve
            .windows(2)
            .map(|w| (w[1] - w[0]) / w[0])
            .collect();

        let total_return = (equity_curve.last().unwrap() - equity_curve[0]) / equity_curve[0];

        // Calculate max drawdown
        let mut max_drawdown = 0.0;
        let mut peak = equity_curve[0];

        for &value in &equity_curve {
            if value > peak {
                peak = value;
            }
            let drawdown = (peak - value) / peak;
            if drawdown > max_drawdown {
                max_drawdown = drawdown;
            }
        }

        // Calculate Sharpe ratio
        let mean_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let variance: f64 = returns
            .iter()
            .map(|r| (r - mean_return).powi(2))
            .sum::<f64>()
            / returns.len() as f64;
        let std_dev = variance.sqrt();
        let sharpe_ratio = if std_dev > 0.0 {
            (mean_return / std_dev) * (252.0_f64).sqrt() // Annualized
        } else {
            0.0
        };

        Ok(BacktestMetrics {
            total_return,
            annual_return: total_return, // Simplified
            sharpe_ratio,
            sortino_ratio: sharpe_ratio * 1.2, // Approximate
            max_drawdown,
            win_rate: 0.0,  // Need trade data
            profit_factor: 0.0,
            total_trades: 0,
            winning_trades: 0,
            losing_trades: 0,
            avg_win: 0.0,
            avg_loss: 0.0,
            largest_win: 0.0,
            largest_loss: 0.0,
            final_equity: *equity_curve.last().unwrap(),
        })
    }

    /// Export backtest results to CSV
    #[napi]
    pub fn export_trades_csv(&self, trades: Vec<Trade>) -> Result<String> {
        let mut csv = String::from("Symbol,Entry Date,Exit Date,Entry Price,Exit Price,Quantity,PnL,PnL%,Commission\n");

        for trade in trades {
            csv.push_str(&format!(
                "{},{},{},{:.2},{:.2},{},{:.2},{:.2}%,{:.2}\n",
                trade.symbol,
                trade.entry_date,
                trade.exit_date,
                trade.entry_price,
                trade.exit_price,
                trade.quantity,
                trade.pnl,
                trade.pnl_percentage,
                trade.commission_paid
            ));
        }

        Ok(csv)
    }
}

/// Compare multiple backtest results
#[napi]
pub fn compare_backtests(results: Vec<BacktestResult>) -> Result<String> {
    if results.is_empty() {
        return Err(Error::from_reason("No results to compare"));
    }

    let comparison = results
        .iter()
        .enumerate()
        .map(|(i, result)| {
            serde_json::json!({
                "strategy": format!("Strategy {}", i + 1),
                "total_return": result.metrics.total_return,
                "sharpe_ratio": result.metrics.sharpe_ratio,
                "max_drawdown": result.metrics.max_drawdown,
                "total_trades": result.metrics.total_trades,
                "win_rate": result.metrics.win_rate,
            })
        })
        .collect::<Vec<_>>();

    let output = serde_json::json!({ "comparison": comparison });
    Ok(output.to_string())
}

//! Portfolio management bindings for Node.js

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Portfolio position
#[napi(object)]
#[derive(Clone)]
pub struct Position {
    pub symbol: String,
    pub quantity: f64,
    pub avg_cost: f64,
    pub market_value: f64,
    pub unrealized_pnl: f64,
    pub realized_pnl: f64,
}

/// Portfolio optimization result
#[napi(object)]
pub struct PortfolioOptimization {
    pub allocations: HashMap<String, f64>,
    pub expected_return: f64,
    pub risk: f64,
    pub sharpe_ratio: f64,
}

/// Risk metrics
#[napi(object)]
pub struct RiskMetrics {
    pub var_95: f64,          // Value at Risk (95% confidence)
    pub cvar_95: f64,         // Conditional VaR
    pub beta: f64,
    pub sharpe_ratio: f64,
    pub max_drawdown: f64,
}

/// Portfolio optimizer configuration
#[napi(object)]
pub struct OptimizerConfig {
    pub risk_free_rate: f64,
    pub max_position_size: Option<f64>,
    pub min_position_size: Option<f64>,
}

/// Portfolio optimizer using modern portfolio theory
#[napi]
pub struct PortfolioOptimizer {
    config: OptimizerConfig,
}

#[napi]
impl PortfolioOptimizer {
    /// Create a new portfolio optimizer
    #[napi(constructor)]
    pub fn new(config: OptimizerConfig) -> Self {
        tracing::info!("Creating portfolio optimizer with risk-free rate: {}", config.risk_free_rate);
        Self { config }
    }

    /// Optimize portfolio allocation
    #[napi]
    pub async fn optimize(
        &self,
        symbols: Vec<String>,
        returns: Vec<f64>,
        covariance: Vec<f64>,
    ) -> Result<PortfolioOptimization> {
        tracing::info!("Optimizing portfolio for {} symbols", symbols.len());

        // In a real implementation:
        // - Use quadratic programming to solve for optimal weights
        // - Apply constraints (max/min position sizes)
        // - Calculate efficient frontier

        // Mock optimization result
        let mut allocations = HashMap::new();
        let equal_weight = 1.0 / symbols.len() as f64;

        for symbol in symbols {
            allocations.insert(symbol, equal_weight);
        }

        let avg_return = returns.iter().sum::<f64>() / returns.len() as f64;
        let avg_risk = (covariance.iter().sum::<f64>() / covariance.len() as f64).sqrt();

        Ok(PortfolioOptimization {
            allocations,
            expected_return: avg_return,
            risk: avg_risk,
            sharpe_ratio: (avg_return - self.config.risk_free_rate) / avg_risk,
        })
    }

    /// Calculate risk metrics for given positions
    #[napi]
    pub fn calculate_risk(&self, positions: HashMap<String, f64>) -> Result<RiskMetrics> {
        tracing::debug!("Calculating risk metrics for {} positions", positions.len());

        // In a real implementation:
        // - Calculate historical volatility
        // - Compute VaR using historical simulation or Monte Carlo
        // - Calculate portfolio beta

        // Mock risk metrics
        Ok(RiskMetrics {
            var_95: 0.05,
            cvar_95: 0.07,
            beta: 1.2,
            sharpe_ratio: 1.5,
            max_drawdown: 0.15,
        })
    }
}

/// Portfolio manager for tracking positions
#[napi]
pub struct PortfolioManager {
    positions: Arc<Mutex<HashMap<String, Position>>>,
    cash: Arc<Mutex<f64>>,
}

#[napi]
impl PortfolioManager {
    /// Create a new portfolio manager
    #[napi(constructor)]
    pub fn new(initial_cash: f64) -> Self {
        tracing::info!("Creating portfolio manager with initial cash: ${}", initial_cash);

        Self {
            positions: Arc::new(Mutex::new(HashMap::new())),
            cash: Arc::new(Mutex::new(initial_cash)),
        }
    }

    /// Get all positions
    #[napi]
    pub async fn get_positions(&self) -> Result<Vec<Position>> {
        let positions = self.positions.lock().await;
        Ok(positions.values().cloned().collect())
    }

    /// Get position for a specific symbol
    #[napi]
    pub async fn get_position(&self, symbol: String) -> Result<Option<Position>> {
        let positions = self.positions.lock().await;
        Ok(positions.get(&symbol).cloned())
    }

    /// Update position (called after trade execution)
    #[napi]
    pub async fn update_position(
        &self,
        symbol: String,
        quantity: f64,
        price: f64,
    ) -> Result<Position> {
        let mut positions = self.positions.lock().await;
        let mut cash = self.cash.lock().await;

        let position = positions.entry(symbol.clone()).or_insert(Position {
            symbol: symbol.clone(),
            quantity: 0.0,
            avg_cost: 0.0,
            market_value: 0.0,
            unrealized_pnl: 0.0,
            realized_pnl: 0.0,
        });

        // Update position
        let old_quantity = position.quantity;
        let old_avg_cost = position.avg_cost;

        position.quantity += quantity;

        if position.quantity != 0.0 {
            position.avg_cost = ((old_quantity * old_avg_cost) + (quantity * price))
                / position.quantity;
        }

        position.market_value = position.quantity * price;
        position.unrealized_pnl = (price - position.avg_cost) * position.quantity;

        // Update cash
        *cash -= quantity * price;

        tracing::info!(
            "Updated position: {} shares of {} @ ${} (avg cost: ${})",
            position.quantity, symbol, price, position.avg_cost
        );

        Ok(position.clone())
    }

    /// Get current cash balance
    #[napi]
    pub async fn get_cash(&self) -> Result<f64> {
        Ok(*self.cash.lock().await)
    }

    /// Get total portfolio value
    #[napi]
    pub async fn get_total_value(&self) -> Result<f64> {
        let positions = self.positions.lock().await;
        let cash = *self.cash.lock().await;

        let positions_value: f64 = positions.values()
            .map(|p| p.market_value)
            .sum();

        Ok(cash + positions_value)
    }

    /// Get total unrealized P&L
    #[napi]
    pub async fn get_total_pnl(&self) -> Result<f64> {
        let positions = self.positions.lock().await;
        Ok(positions.values().map(|p| p.unrealized_pnl).sum())
    }
}

//! Core traits for the Neural Trading system
//!
//! This module defines the primary interfaces that all components must implement.
//! All traits use `async_trait` for async method support.

use crate::error::Result;
use crate::types::{Bar, MarketTick, Order, OrderBook, OrderStatus, Position, Signal, Symbol};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use tokio::sync::mpsc;

// ============================================================================
// Market Data Provider Trait
// ============================================================================

/// Trait for market data providers (Alpaca, Polygon, IEX, etc.)
///
/// Implementations should handle connection management, authentication,
/// and data normalization.
#[async_trait]
pub trait MarketDataProvider: Send + Sync {
    /// Subscribe to real-time market data for given symbols
    ///
    /// Returns a receiver channel that will receive market ticks as they arrive.
    /// The provider should handle reconnection and error recovery internally.
    ///
    /// # Arguments
    ///
    /// * `symbols` - List of symbols to subscribe to
    ///
    /// # Returns
    ///
    /// Receiver channel for market ticks
    async fn subscribe(&self, symbols: &[Symbol]) -> Result<mpsc::Receiver<MarketTick>>;

    /// Unsubscribe from market data for given symbols
    async fn unsubscribe(&self, symbols: &[Symbol]) -> Result<()>;

    /// Get latest quote for a symbol
    async fn get_latest_quote(&self, symbol: &Symbol) -> Result<MarketTick>;

    /// Get historical bars for a symbol
    ///
    /// # Arguments
    ///
    /// * `symbol` - Trading symbol
    /// * `start` - Start timestamp
    /// * `end` - End timestamp
    /// * `timeframe` - Bar timeframe (e.g., "1Min", "1Hour", "1Day")
    async fn get_bars(
        &self,
        symbol: &Symbol,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        timeframe: &str,
    ) -> Result<Vec<Bar>>;

    /// Get order book snapshot for a symbol
    async fn get_order_book(&self, symbol: &Symbol) -> Result<OrderBook>;

    /// Check if the provider is connected and healthy
    async fn is_connected(&self) -> bool;
}

// ============================================================================
// Strategy Trait
// ============================================================================

/// Trait for trading strategies
///
/// Each strategy must implement this trait to be used by the trading system.
/// Strategies receive market data and generate trading signals.
#[async_trait]
pub trait Strategy: Send + Sync {
    /// Unique identifier for this strategy
    fn id(&self) -> &str;

    /// Human-readable name for this strategy
    fn name(&self) -> &str;

    /// Strategy description
    fn description(&self) -> &str;

    /// Process incoming market data and potentially generate signals
    ///
    /// This method is called whenever new market data arrives for symbols
    /// the strategy is interested in.
    ///
    /// # Arguments
    ///
    /// * `tick` - Market tick data
    ///
    /// # Returns
    ///
    /// Optional trading signal if conditions are met
    async fn on_tick(&mut self, tick: &MarketTick) -> Result<Option<Signal>>;

    /// Process bar data (OHLCV) and potentially generate signals
    ///
    /// This method is called when a new bar is complete.
    ///
    /// # Arguments
    ///
    /// * `bar` - OHLCV bar data
    ///
    /// # Returns
    ///
    /// Optional trading signal if conditions are met
    async fn on_bar(&mut self, bar: &Bar) -> Result<Option<Signal>>;

    /// Generate signals based on current state (called periodically)
    ///
    /// This method is called on a schedule (e.g., every minute) to allow
    /// strategies to generate signals based on accumulated state.
    ///
    /// # Returns
    ///
    /// Vector of trading signals
    async fn generate_signals(&mut self) -> Result<Vec<Signal>>;

    /// Update strategy state based on order execution feedback
    ///
    /// This method is called when an order is filled, allowing the strategy
    /// to update its internal state.
    ///
    /// # Arguments
    ///
    /// * `signal` - Original signal that triggered the order
    /// * `order` - Order that was executed
    /// * `fill_price` - Actual fill price
    async fn on_order_filled(
        &mut self,
        signal: &Signal,
        order: &Order,
        fill_price: Decimal,
    ) -> Result<()>;

    /// Initialize the strategy with historical data
    ///
    /// Called once before the strategy starts processing live data.
    /// Allows strategies to warm up indicators with historical data.
    ///
    /// # Arguments
    ///
    /// * `bars` - Historical bar data per symbol
    async fn initialize(&mut self, bars: Vec<Bar>) -> Result<()>;

    /// Validate strategy configuration
    ///
    /// Called during strategy setup to ensure configuration is valid.
    fn validate(&self) -> Result<()>;

    /// Get the symbols this strategy is interested in
    fn symbols(&self) -> Vec<Symbol>;

    /// Get strategy-specific risk parameters
    fn risk_parameters(&self) -> StrategyRiskParameters;
}

/// Risk parameters specific to a strategy
#[derive(Debug, Clone)]
pub struct StrategyRiskParameters {
    /// Maximum position size as percentage of portfolio (0.0-1.0)
    pub max_position_size: f64,
    /// Maximum leverage allowed
    pub max_leverage: f64,
    /// Stop loss percentage (0.0-1.0)
    pub stop_loss_pct: f64,
    /// Take profit percentage (0.0-1.0)
    pub take_profit_pct: f64,
}

impl Default for StrategyRiskParameters {
    fn default() -> Self {
        Self {
            max_position_size: 0.1, // 10% of portfolio
            max_leverage: 1.0,      // No leverage
            stop_loss_pct: 0.02,    // 2% stop loss
            take_profit_pct: 0.05,  // 5% take profit
        }
    }
}

// ============================================================================
// Execution Engine Trait
// ============================================================================

/// Trait for order execution engines
///
/// Handles order routing, execution, and tracking.
#[async_trait]
pub trait ExecutionEngine: Send + Sync {
    /// Place a new order
    ///
    /// # Arguments
    ///
    /// * `order` - Order to place
    ///
    /// # Returns
    ///
    /// Broker's order ID
    async fn place_order(&self, order: Order) -> Result<String>;

    /// Cancel an existing order
    ///
    /// # Arguments
    ///
    /// * `order_id` - Broker's order ID
    async fn cancel_order(&self, order_id: &str) -> Result<()>;

    /// Get order status
    ///
    /// # Arguments
    ///
    /// * `order_id` - Broker's order ID
    async fn get_order_status(&self, order_id: &str) -> Result<OrderStatus>;

    /// Get all open orders
    async fn get_open_orders(&self) -> Result<Vec<Order>>;

    /// Get current positions
    async fn get_positions(&self) -> Result<Vec<Position>>;

    /// Get position for a specific symbol
    async fn get_position(&self, symbol: &Symbol) -> Result<Option<Position>>;

    /// Close position for a symbol
    ///
    /// # Arguments
    ///
    /// * `symbol` - Symbol to close
    /// * `percentage` - Percentage of position to close (0.0-1.0)
    async fn close_position(&self, symbol: &Symbol, percentage: f64) -> Result<()>;

    /// Close all positions
    async fn close_all_positions(&self) -> Result<()>;

    /// Get account cash balance
    async fn get_cash_balance(&self) -> Result<Decimal>;

    /// Get account equity (cash + positions)
    async fn get_equity(&self) -> Result<Decimal>;
}

// ============================================================================
// Risk Manager Trait
// ============================================================================

/// Trait for risk management systems
///
/// Validates signals and orders before execution to ensure risk limits are met.
#[async_trait]
pub trait RiskManager: Send + Sync {
    /// Validate a trading signal before execution
    ///
    /// # Arguments
    ///
    /// * `signal` - Signal to validate
    /// * `portfolio_value` - Current portfolio value
    /// * `positions` - Current positions
    ///
    /// # Returns
    ///
    /// Ok(()) if signal passes risk checks, Err otherwise
    async fn validate_signal(
        &self,
        signal: &Signal,
        portfolio_value: Decimal,
        positions: &[Position],
    ) -> Result<()>;

    /// Calculate position size for a signal
    ///
    /// Uses strategy risk parameters and portfolio constraints to determine
    /// appropriate position size.
    ///
    /// # Arguments
    ///
    /// * `signal` - Trading signal
    /// * `portfolio_value` - Current portfolio value
    /// * `risk_params` - Strategy risk parameters
    ///
    /// # Returns
    ///
    /// Recommended position size (in shares)
    async fn calculate_position_size(
        &self,
        signal: &Signal,
        portfolio_value: Decimal,
        risk_params: &StrategyRiskParameters,
    ) -> Result<Decimal>;

    /// Check if daily loss limit has been exceeded
    async fn check_daily_loss_limit(&self, current_pnl: Decimal) -> Result<()>;

    /// Check if maximum drawdown has been exceeded
    async fn check_max_drawdown(&self, peak_equity: Decimal, current_equity: Decimal)
        -> Result<()>;

    /// Calculate portfolio risk metrics
    async fn calculate_risk_metrics(&self, positions: &[Position]) -> Result<RiskMetrics>;
}

/// Risk metrics for portfolio
#[derive(Debug, Clone)]
pub struct RiskMetrics {
    /// Value at Risk (95% confidence)
    pub var_95: Decimal,
    /// Value at Risk (99% confidence)
    pub var_99: Decimal,
    /// Conditional Value at Risk (95%)
    pub cvar_95: Decimal,
    /// Maximum drawdown
    pub max_drawdown: Decimal,
    /// Sharpe ratio
    pub sharpe_ratio: f64,
    /// Portfolio volatility
    pub volatility: f64,
    /// Beta (market correlation)
    pub beta: f64,
}

// ============================================================================
// Portfolio Manager Trait
// ============================================================================

/// Trait for portfolio management
#[async_trait]
pub trait PortfolioManager: Send + Sync {
    /// Get current portfolio value
    async fn get_portfolio_value(&self) -> Result<Decimal>;

    /// Get all positions
    async fn get_positions(&self) -> Result<Vec<Position>>;

    /// Update position based on fill
    async fn update_position(
        &self,
        symbol: &Symbol,
        quantity: Decimal,
        price: Decimal,
    ) -> Result<()>;

    /// Get unrealized P&L
    async fn get_unrealized_pnl(&self) -> Result<Decimal>;

    /// Get realized P&L
    async fn get_realized_pnl(&self) -> Result<Decimal>;

    /// Rebalance portfolio to target allocations
    async fn rebalance(&self, target_allocations: Vec<(Symbol, f64)>) -> Result<()>;
}

// ============================================================================
// Feature Extractor Trait
// ============================================================================

/// Trait for feature extraction from market data
///
/// Calculates technical indicators and other features for strategy use.
#[async_trait]
pub trait FeatureExtractor: Send + Sync {
    /// Extract features from historical bars
    ///
    /// # Arguments
    ///
    /// * `bars` - Historical bar data
    ///
    /// # Returns
    ///
    /// Vector of feature vectors, one per bar
    async fn extract_features(&self, bars: &[Bar]) -> Result<Vec<FeatureVector>>;

    /// Get list of feature names in order
    fn feature_names(&self) -> Vec<String>;
}

/// Feature vector extracted from market data
#[derive(Debug, Clone)]
pub struct FeatureVector {
    /// Timestamp of the feature vector
    pub timestamp: DateTime<Utc>,
    /// Feature values in the order specified by feature_names()
    pub values: Vec<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strategy_risk_parameters_default() {
        let params = StrategyRiskParameters::default();
        assert_eq!(params.max_position_size, 0.1);
        assert_eq!(params.max_leverage, 1.0);
        assert_eq!(params.stop_loss_pct, 0.02);
        assert_eq!(params.take_profit_pct, 0.05);
    }
}

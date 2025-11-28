//! # Neural Trader - Node.js FFI Bindings
//!
//! This crate provides high-performance Node.js bindings using napi-rs for the Neural Trader
//! Rust core. It exposes async APIs that map directly to JavaScript Promises.
//!
//! ## Architecture
//!
//! ```text
//! JavaScript (Node.js)
//!       ↓
//! napi-rs (auto-generated)
//!       ↓
//! This crate (manual wrappers)
//!       ↓
//! Rust core (nt-core, nt-strategies, etc.)
//! ```
//!
//! ## Features
//!
//! - Zero-copy buffer operations for large datasets
//! - Async/await with automatic Promise conversion
//! - Type-safe error marshaling
//! - Resource management with Arc for shared state
//! - Thread-safe concurrent operations
//!
//! ## Modules
//!
//! - `broker` - Broker integrations (Alpaca, IBKR, CCXT, Oanda, Questrade, Lime)
//! - `strategy` - Trading strategy implementations
//! - `neural` - Neural network models for forecasting
//! - `risk` - Risk management (VaR, Kelly, drawdown)
//! - `backtest` - Backtesting engine
//! - `market_data` - Market data streaming and indicators
//! - `portfolio` - Portfolio management

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::sync::Arc;

// Re-export core types with explicit paths to avoid ambiguity
use nt_core::prelude::*;

// Module declarations
pub mod broker;
pub mod neural;
pub mod risk;
pub mod backtest;
pub mod market_data;

// Re-export existing modules
pub mod strategy;
pub mod portfolio;

// Type aliases for clarity
type NapiResult<T> = napi::Result<T>;

// =============================================================================
// JavaScript Type Wrappers
// =============================================================================

/// JavaScript-compatible bar data
#[napi(object)]
pub struct JsBar {
    pub symbol: String,
    pub timestamp: String,
    pub open: String,
    pub high: String,
    pub low: String,
    pub close: String,
    pub volume: String,
}

impl From<Bar> for JsBar {
    fn from(bar: Bar) -> Self {
        Self {
            symbol: bar.symbol.to_string(),
            timestamp: bar.timestamp.to_rfc3339(),
            open: bar.open.to_string(),
            high: bar.high.to_string(),
            low: bar.low.to_string(),
            close: bar.close.to_string(),
            volume: bar.volume.to_string(),
        }
    }
}

/// JavaScript-compatible signal data
#[napi(object)]
pub struct JsSignal {
    pub id: String,
    pub strategy_id: String,
    pub symbol: String,
    pub direction: String,
    pub confidence: f64,
    pub entry_price: Option<String>,
    pub stop_loss: Option<String>,
    pub take_profit: Option<String>,
    pub quantity: Option<String>,
    pub reasoning: String,
    pub timestamp: String,
}

impl From<Signal> for JsSignal {
    fn from(signal: Signal) -> Self {
        Self {
            id: signal.id.to_string(),
            strategy_id: signal.strategy_id,
            symbol: signal.symbol.to_string(),
            direction: signal.direction.to_string(),
            confidence: signal.confidence,
            entry_price: signal.entry_price.map(|p| p.to_string()),
            stop_loss: signal.stop_loss.map(|p| p.to_string()),
            take_profit: signal.take_profit.map(|p| p.to_string()),
            quantity: signal.quantity.map(|q| q.to_string()),
            reasoning: signal.reasoning,
            timestamp: signal.timestamp.to_rfc3339(),
        }
    }
}

/// JavaScript-compatible order data
#[napi(object)]
pub struct JsOrder {
    pub id: String,
    pub symbol: String,
    pub side: String,
    pub order_type: String,
    pub quantity: String,
    pub limit_price: Option<String>,
    pub stop_price: Option<String>,
    pub time_in_force: String,
}

/// JavaScript-compatible position data
#[napi(object)]
pub struct JsPosition {
    pub symbol: String,
    pub quantity: String,
    pub avg_entry_price: String,
    pub current_price: String,
    pub unrealized_pnl: String,
    pub side: String,
    pub market_value: String,
}

impl From<Position> for JsPosition {
    fn from(pos: Position) -> Self {
        Self {
            symbol: pos.symbol.to_string(),
            quantity: pos.quantity.to_string(),
            avg_entry_price: pos.avg_entry_price.to_string(),
            current_price: pos.current_price.to_string(),
            unrealized_pnl: pos.unrealized_pnl.to_string(),
            side: pos.side.to_string(),
            market_value: pos.market_value().to_string(),
        }
    }
}

/// JavaScript-compatible configuration
#[napi(object)]
pub struct JsConfig {
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub base_url: Option<String>,
    pub paper_trading: bool,
}

// =============================================================================
// Error Conversion Helper
// =============================================================================

/// Convert TradingError to napi Error
fn to_napi_error(err: TradingError) -> Error {
    match err {
        TradingError::MarketData { message, .. } => {
            Error::from_reason(format!("Market data error: {}", message))
        }
        TradingError::Strategy {
            strategy_id,
            message,
            ..
        } => Error::from_reason(format!("Strategy error ({}): {}", strategy_id, message)),
        TradingError::Execution {
            message, order_id, ..
        } => {
            let msg = if let Some(id) = order_id {
                format!("Execution error (order {}): {}", id, message)
            } else {
                format!("Execution error: {}", message)
            };
            Error::from_reason(msg)
        }
        TradingError::RiskLimit {
            message,
            violation_type,
        } => Error::from_reason(format!("Risk violation ({:?}): {}", violation_type, message)),
        TradingError::Validation { message } => {
            Error::from_reason(format!("Validation error: {}", message))
        }
        TradingError::NotFound {
            resource_type,
            resource_id,
        } => Error::from_reason(format!("Not found: {} '{}'", resource_type, resource_id)),
        TradingError::Timeout {
            operation,
            timeout_ms,
        } => Error::from_reason(format!(
            "Operation '{}' timed out after {}ms",
            operation, timeout_ms
        )),
        _ => Error::from_reason(err.to_string()),
    }
}

// =============================================================================
// Main Trading System Interface
// =============================================================================

/// Main Neural Trader system instance
///
/// This is the primary interface for interacting with the trading system from Node.js.
/// It manages strategies, execution, and portfolio state.
///
/// # Example
///
/// ```javascript
/// const { NeuralTrader } = require('@neural-trader/rust-core');
///
/// const trader = new NeuralTrader({
///   apiKey: process.env.ALPACA_API_KEY,
///   apiSecret: process.env.ALPACA_API_SECRET,
///   paperTrading: true
/// });
///
/// await trader.start();
/// const positions = await trader.getPositions();
/// await trader.stop();
/// ```
#[napi]
pub struct NeuralTrader {
    // Inner state wrapped in Arc for shared ownership across async operations
    // This will be populated with actual trading system implementation
    _config: Arc<JsConfig>,
}

#[napi]
impl NeuralTrader {
    /// Create a new Neural Trader instance
    ///
    /// # Arguments
    ///
    /// * `config` - Configuration object with API credentials and settings
    #[napi(constructor)]
    pub fn new(config: JsConfig) -> Self {
        // TODO: Initialize actual trading system
        // For now, just validate and store config
        Self {
            _config: Arc::new(config),
        }
    }

    /// Start the trading system
    ///
    /// Initializes connections to market data providers and brokers.
    /// Returns a Promise that resolves when the system is ready.
    #[napi]
    pub async fn start(&self) -> NapiResult<()> {
        // TODO: Implement actual start logic
        // - Connect to market data
        // - Initialize strategies
        // - Start event loop
        Ok(())
    }

    /// Stop the trading system gracefully
    ///
    /// Closes all positions, cancels open orders, and disconnects from services.
    #[napi]
    pub async fn stop(&self) -> NapiResult<()> {
        // TODO: Implement actual stop logic
        // - Cancel open orders
        // - Close positions (if configured)
        // - Disconnect from services
        Ok(())
    }

    /// Get current portfolio positions
    ///
    /// Returns all open positions with real-time P&L.
    #[napi]
    pub async fn get_positions(&self) -> NapiResult<Vec<JsPosition>> {
        // TODO: Implement actual position retrieval
        Ok(vec![])
    }

    /// Place a new order
    ///
    /// # Arguments
    ///
    /// * `order` - Order details (symbol, side, quantity, etc.)
    ///
    /// # Returns
    ///
    /// Broker's order ID as a string
    #[napi]
    pub async fn place_order(&self, _order: JsOrder) -> NapiResult<String> {
        // TODO: Implement actual order placement
        // - Validate order
        // - Check risk limits
        // - Submit to broker
        Ok("order-id-placeholder".to_string())
    }

    /// Get current account balance
    ///
    /// Returns cash balance in account currency
    #[napi]
    pub async fn get_balance(&self) -> NapiResult<String> {
        // TODO: Implement actual balance retrieval
        Ok("0.00".to_string())
    }

    /// Get current portfolio equity (cash + positions)
    #[napi]
    pub async fn get_equity(&self) -> NapiResult<String> {
        // TODO: Implement actual equity calculation
        Ok("0.00".to_string())
    }
}

// =============================================================================
// Standalone Utility Functions
// =============================================================================

/// Fetch historical market data
///
/// # Arguments
///
/// * `symbol` - Trading symbol (e.g., "AAPL")
/// * `start` - Start timestamp (RFC3339 format)
/// * `end` - End timestamp (RFC3339 format)
/// * `timeframe` - Bar timeframe (e.g., "1Min", "1Hour", "1Day")
///
/// # Returns
///
/// Array of bar objects with OHLCV data
///
/// # Example
///
/// ```javascript
/// const bars = await fetchMarketData('AAPL', '2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z', '1Day');
/// console.log(`Fetched ${bars.length} bars`);
/// ```
#[napi]
pub async fn fetch_market_data(
    _symbol: String,
    _start: String,
    _end: String,
    _timeframe: String,
) -> NapiResult<Vec<JsBar>> {
    // TODO: Implement actual market data fetching
    // - Parse timestamps
    // - Connect to data provider
    // - Fetch and convert bars
    Ok(vec![])
}

/// Calculate technical indicators
///
/// # Arguments
///
/// * `bars` - Array of bar data
/// * `indicator` - Indicator name (e.g., "SMA", "RSI", "MACD")
/// * `params` - JSON string with indicator parameters
///
/// # Returns
///
/// Array of indicator values (same length as input bars, with NaN for warmup period)
#[napi]
pub async fn calculate_indicator(
    _bars: Vec<JsBar>,
    _indicator: String,
    _params: String,
) -> NapiResult<Vec<f64>> {
    // TODO: Implement indicator calculation
    // - Parse parameters
    // - Calculate indicator
    // - Return values
    Ok(vec![])
}

/// Encode bars to MessagePack buffer for efficient transfer
///
/// For large datasets (>1000 bars), encoding to binary format provides
/// significant performance improvement over JSON serialization.
///
/// # Example
///
/// ```javascript
/// const buffer = encodeBarsToBuffer(bars);
/// // Transfer buffer over network
/// const decodedBars = decodeBarsFromBuffer(buffer);
/// ```
#[napi]
pub fn encode_bars_to_buffer(_bars: Vec<JsBar>) -> NapiResult<Buffer> {
    // TODO: Implement MessagePack encoding
    // - Serialize to MessagePack
    // - Return as Buffer
    Ok(Buffer::from(vec![]))
}

/// Decode bars from MessagePack buffer
///
/// Companion function to `encodeBarsToBuffer` for efficient binary transfer.
#[napi]
pub fn decode_bars_from_buffer(_buffer: Buffer) -> NapiResult<Vec<JsBar>> {
    // TODO: Implement MessagePack decoding
    // - Deserialize from MessagePack
    // - Convert to JsBar array
    Ok(vec![])
}

/// Initialize tokio runtime with custom thread count
///
/// Call this once at application startup to configure the async runtime.
/// If not called, defaults to number of CPU cores.
///
/// # Arguments
///
/// * `num_threads` - Number of worker threads (None = auto-detect)
#[napi]
pub fn init_runtime(num_threads: Option<u32>) -> NapiResult<()> {
    let threads = num_threads.unwrap_or_else(|| num_cpus::get() as u32);
    tracing::info!("Initializing tokio runtime with {} threads", threads);
    // Note: In practice, napi-rs manages the runtime automatically
    // This is here for documentation and future customization
    Ok(())
}

/// Get version information
///
/// Returns version strings for all components
#[napi(object)]
pub struct VersionInfo {
    pub rust_core: String,
    pub napi_bindings: String,
    pub rust_compiler: String,
}

#[napi]
pub fn get_version_info() -> NapiResult<VersionInfo> {
    Ok(VersionInfo {
        rust_core: env!("CARGO_PKG_VERSION").to_string(),
        napi_bindings: env!("CARGO_PKG_VERSION").to_string(),
        rust_compiler: rustc_version_runtime::version().to_string(),
    })
}

// =============================================================================
// Module Registration
// =============================================================================

// Module registration happens automatically via napi-rs macros.
// The generated `index.js` and `index.d.ts` will export all `#[napi]` items.

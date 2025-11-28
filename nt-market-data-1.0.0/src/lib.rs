// Market Data Module - High-performance market data ingestion and aggregation
//
// Performance targets:
// - WebSocket ingestion: <100μs per tick
// - REST API calls: <50ms p99
// - Throughput: 10,000 events/sec

pub mod aggregator;
pub mod alpaca;
pub mod errors;
pub mod polygon;
pub mod rest;
pub mod types;
pub mod websocket;

pub use aggregator::MarketDataAggregator;
pub use alpaca::AlpacaClient;
pub use errors::{MarketDataError, Result};
pub use polygon::{PolygonClient, PolygonWebSocket};
pub use types::{Bar, Quote, Tick, Timeframe, Trade};

use async_trait::async_trait;
use futures::Stream;
use std::pin::Pin;

/// Abstract market data provider trait
#[async_trait]
pub trait MarketDataProvider: Send + Sync {
    /// Get current quote for symbol
    async fn get_quote(&self, symbol: &str) -> Result<Quote>;

    /// Get historical bars
    async fn get_bars(
        &self,
        symbol: &str,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
        timeframe: Timeframe,
    ) -> Result<Vec<Bar>>;

    /// Subscribe to real-time quotes
    async fn subscribe_quotes(&self, symbols: Vec<String>) -> Result<QuoteStream>;

    /// Subscribe to trades
    async fn subscribe_trades(&self, symbols: Vec<String>) -> Result<TradeStream>;

    /// Health check
    async fn health_check(&self) -> Result<HealthStatus>;
}

pub type QuoteStream = Pin<Box<dyn Stream<Item = Result<Quote>> + Send>>;
pub type TradeStream = Pin<Box<dyn Stream<Item = Result<Trade>> + Send>>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_structure() {
        // Smoke test to ensure module compiles
        assert_eq!(HealthStatus::Healthy, HealthStatus::Healthy);
    }
}

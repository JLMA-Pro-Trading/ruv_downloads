//! Market data streaming and fetching bindings for Node.js

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Market data bar/candle
#[napi(object)]
pub struct Bar {
    pub symbol: String,
    pub timestamp: String,
    pub open: f64,
    pub high: f64,
    pub low: f64,
    pub close: f64,
    pub volume: f64,
}

/// Real-time quote
#[napi(object)]
pub struct Quote {
    pub symbol: String,
    pub bid: f64,
    pub ask: f64,
    pub bid_size: u32,
    pub ask_size: u32,
    pub last: f64,
    pub last_size: u32,
    pub timestamp: String,
}

/// Market data provider configuration
#[napi(object)]
pub struct MarketDataConfig {
    pub provider: String,  // "alpaca", "polygon", "yahoo", "binance"
    pub api_key: Option<String>,
    pub api_secret: Option<String>,
    pub websocket_enabled: bool,
}

/// Market data provider
#[napi]
pub struct MarketDataProvider {
    config: Arc<MarketDataConfig>,
    _connection: Arc<Mutex<Option<String>>>,
}

#[napi]
impl MarketDataProvider {
    /// Create a new market data provider
    #[napi(constructor)]
    pub fn new(config: MarketDataConfig) -> Self {
        tracing::info!("Creating market data provider: {}", config.provider);

        Self {
            config: Arc::new(config),
            _connection: Arc::new(Mutex::new(None)),
        }
    }

    /// Connect to market data provider
    #[napi]
    pub async fn connect(&self) -> Result<bool> {
        tracing::info!("Connecting to market data provider");

        // TODO: Implement actual connection
        let mut conn = self._connection.lock().await;
        *conn = Some(format!("connected-{}", self.config.provider));

        Ok(true)
    }

    /// Disconnect from provider
    #[napi]
    pub async fn disconnect(&self) -> Result<()> {
        tracing::info!("Disconnecting from market data provider");

        let mut conn = self._connection.lock().await;
        *conn = None;

        Ok(())
    }

    /// Fetch historical bars
    #[napi]
    pub async fn fetch_bars(
        &self,
        symbol: String,
        start: String,
        end: String,
        timeframe: String,
    ) -> Result<Vec<Bar>> {
        tracing::info!(
            "Fetching bars: {} from {} to {} ({})",
            symbol,
            start,
            end,
            timeframe
        );

        // TODO: Implement actual data fetching
        // For now, return mock data
        let bars = vec![
            Bar {
                symbol: symbol.clone(),
                timestamp: start.clone(),
                open: 100.0,
                high: 102.0,
                low: 99.0,
                close: 101.0,
                volume: 1000000.0,
            },
            Bar {
                symbol: symbol.clone(),
                timestamp: end.clone(),
                open: 101.0,
                high: 103.0,
                low: 100.0,
                close: 102.0,
                volume: 1200000.0,
            },
        ];

        Ok(bars)
    }

    /// Get latest quote
    #[napi]
    pub async fn get_quote(&self, symbol: String) -> Result<Quote> {
        tracing::debug!("Getting quote for {}", symbol);

        // TODO: Implement actual quote fetching
        Ok(Quote {
            symbol,
            bid: 100.50,
            ask: 100.55,
            bid_size: 100,
            ask_size: 200,
            last: 100.52,
            last_size: 50,
            timestamp: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Subscribe to real-time quotes
    #[napi]
    pub fn subscribe_quotes(
        &self,
        symbols: Vec<String>,
        callback: JsFunction,
    ) -> Result<SubscriptionHandle> {
        tracing::info!("Subscribing to quotes for {} symbols", symbols.len());

        let tsfn: ThreadsafeFunction<Quote, ErrorStrategy::CalleeHandled> =
            callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

        // Spawn background task for streaming quotes
        let symbols_clone = symbols.clone();
        let handle = tokio::spawn(async move {
            loop {
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

                // TODO: Implement actual streaming
                // For now, just simulate with periodic updates
                for symbol in &symbols_clone {
                    let quote = Quote {
                        symbol: symbol.clone(),
                        bid: 100.0,
                        ask: 100.1,
                        bid_size: 100,
                        ask_size: 100,
                        last: 100.05,
                        last_size: 50,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    };

                    let _ = tsfn.call(Ok(quote), ThreadsafeFunctionCallMode::NonBlocking);
                }
            }
        });

        Ok(SubscriptionHandle {
            handle: Arc::new(Mutex::new(Some(handle))),
        })
    }

    /// Get multiple quotes at once
    #[napi]
    pub async fn get_quotes_batch(&self, symbols: Vec<String>) -> Result<Vec<Quote>> {
        tracing::debug!("Getting batch quotes for {} symbols", symbols.len());

        // TODO: Implement actual batch quote fetching
        let quotes = symbols
            .iter()
            .map(|symbol| Quote {
                symbol: symbol.clone(),
                bid: 100.0,
                ask: 100.1,
                bid_size: 100,
                ask_size: 100,
                last: 100.05,
                last_size: 50,
                timestamp: chrono::Utc::now().to_rfc3339(),
            })
            .collect();

        Ok(quotes)
    }

    /// Check if provider is connected
    #[napi]
    pub async fn is_connected(&self) -> Result<bool> {
        let conn = self._connection.lock().await;
        Ok(conn.is_some())
    }
}

/// Subscription handle for cleanup
#[napi]
pub struct SubscriptionHandle {
    handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

#[napi]
impl SubscriptionHandle {
    /// Unsubscribe from quotes
    #[napi]
    pub async fn unsubscribe(&self) -> Result<()> {
        let mut guard = self.handle.lock().await;
        if let Some(handle) = guard.take() {
            handle.abort();
            tracing::info!("Unsubscribed from market data");
        }
        Ok(())
    }
}

/// Calculate technical indicators
#[napi]
pub fn calculate_sma(prices: Vec<f64>, period: u32) -> Result<Vec<f64>> {
    if prices.len() < period as usize {
        return Err(Error::from_reason("Not enough data for SMA calculation"));
    }

    let mut sma = vec![f64::NAN; period as usize - 1];

    for i in (period as usize - 1)..prices.len() {
        let sum: f64 = prices[i - (period as usize - 1)..=i].iter().sum();
        sma.push(sum / period as f64);
    }

    Ok(sma)
}

/// Calculate Relative Strength Index (RSI)
#[napi]
pub fn calculate_rsi(prices: Vec<f64>, period: u32) -> Result<Vec<f64>> {
    if prices.len() < (period + 1) as usize {
        return Err(Error::from_reason("Not enough data for RSI calculation"));
    }

    let mut gains = Vec::new();
    let mut losses = Vec::new();

    // Calculate price changes
    for i in 1..prices.len() {
        let change = prices[i] - prices[i - 1];
        gains.push(if change > 0.0 { change } else { 0.0 });
        losses.push(if change < 0.0 { -change } else { 0.0 });
    }

    // Calculate average gains and losses
    let mut avg_gain = gains[..period as usize].iter().sum::<f64>() / period as f64;
    let mut avg_loss = losses[..period as usize].iter().sum::<f64>() / period as f64;

    let mut rsi_values = vec![f64::NAN; period as usize];

    for i in period as usize..gains.len() {
        avg_gain = (avg_gain * (period as f64 - 1.0) + gains[i]) / period as f64;
        avg_loss = (avg_loss * (period as f64 - 1.0) + losses[i]) / period as f64;

        let rs = if avg_loss > 0.0 {
            avg_gain / avg_loss
        } else {
            0.0
        };

        let rsi = 100.0 - (100.0 / (1.0 + rs));
        rsi_values.push(rsi);
    }

    Ok(rsi_values)
}

/// List available market data providers
#[napi]
pub fn list_data_providers() -> Vec<String> {
    vec![
        "alpaca".to_string(),
        "polygon".to_string(),
        "yahoo".to_string(),
        "binance".to_string(),
        "coinbase".to_string(),
    ]
}

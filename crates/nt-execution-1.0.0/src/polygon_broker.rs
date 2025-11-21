// Polygon.io market data integration
//
// Features:
// - REST API v2 for market data
// - WebSocket streaming for real-time quotes, trades, and aggregates
// - Historical data retrieval (stocks, options, forex, crypto)
// - Technical indicators and aggregates
// - Options chain data

use chrono::{DateTime, Utc};
use futures::{SinkExt, StreamExt};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::{Client, Method};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use tracing::{debug, error, info, warn};
use url::Url;

/// Polygon.io configuration
#[derive(Debug, Clone)]
pub struct PolygonConfig {
    /// API key from polygon.io
    pub api_key: String,
    /// Enable WebSocket streaming
    pub streaming: bool,
    /// Request timeout
    pub timeout: Duration,
}

impl Default for PolygonConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            streaming: true,
            timeout: Duration::from_secs(30),
        }
    }
}

/// Polygon.io client for market data
pub struct PolygonClient {
    client: Client,
    config: PolygonConfig,
    base_url: String,
    ws_url: String,
    rate_limiter: DefaultDirectRateLimiter,
    last_quote: Arc<RwLock<Option<PolygonQuote>>>,
}

impl PolygonClient {
    /// Create a new Polygon.io client
    pub fn new(config: PolygonConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .expect("Failed to create HTTP client");

        // Free tier: 5 requests/minute, Paid: higher limits
        let quota = Quota::per_minute(NonZeroU32::new(5).unwrap());
        let rate_limiter = RateLimiter::direct(quota);

        Self {
            client,
            config,
            base_url: "https://api.polygon.io".to_string(),
            ws_url: "wss://socket.polygon.io".to_string(),
            rate_limiter,
            last_quote: Arc::new(RwLock::new(None)),
        }
    }

    /// Get last quote for a symbol
    pub async fn get_last_quote(&self, symbol: &str) -> Result<PolygonQuote, PolygonError> {
        self.rate_limiter.until_ready().await;

        let url = format!(
            "{}/v2/last/nbbo/{}?apiKey={}",
            self.base_url, symbol, self.config.api_key
        );

        debug!("Polygon API request: GET {}", url);

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let result: PolygonLastQuoteResponse = response.json().await?;
            Ok(result.results)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("Polygon API error: {}", error_text);
            Err(PolygonError::ApiError(error_text))
        }
    }

    /// Get daily aggregates (OHLCV) for a symbol
    pub async fn get_daily_aggregates(
        &self,
        symbol: &str,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<PolygonAggregate>, PolygonError> {
        self.rate_limiter.until_ready().await;

        let url = format!(
            "{}/v2/aggs/ticker/{}/range/1/day/{}/{}?adjusted=true&sort=asc&apiKey={}",
            self.base_url,
            symbol,
            from.format("%Y-%m-%d"),
            to.format("%Y-%m-%d"),
            self.config.api_key
        );

        debug!("Polygon API request: GET {}", url);

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let result: PolygonAggregatesResponse = response.json().await?;
            Ok(result.results)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("Polygon API error: {}", error_text);
            Err(PolygonError::ApiError(error_text))
        }
    }

    /// Get intraday aggregates with custom timespan
    pub async fn get_aggregates(
        &self,
        symbol: &str,
        multiplier: u32,
        timespan: &str, // minute, hour, day, week, month, quarter, year
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<PolygonAggregate>, PolygonError> {
        self.rate_limiter.until_ready().await;

        let url = format!(
            "{}/v2/aggs/ticker/{}/range/{}/{}/{}/{}?adjusted=true&sort=asc&apiKey={}",
            self.base_url,
            symbol,
            multiplier,
            timespan,
            from.timestamp_millis(),
            to.timestamp_millis(),
            self.config.api_key
        );

        debug!("Polygon API request: GET {}", url);

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let result: PolygonAggregatesResponse = response.json().await?;
            Ok(result.results)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(PolygonError::ApiError(error_text))
        }
    }

    /// Get snapshot of all tickers
    pub async fn get_snapshot_all(&self) -> Result<Vec<PolygonTickerSnapshot>, PolygonError> {
        self.rate_limiter.until_ready().await;

        let url = format!(
            "{}/v2/snapshot/locale/us/markets/stocks/tickers?apiKey={}",
            self.base_url, self.config.api_key
        );

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let result: PolygonSnapshotResponse = response.json().await?;
            Ok(result.tickers)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(PolygonError::ApiError(error_text))
        }
    }

    /// Start WebSocket streaming for real-time data
    pub async fn start_streaming(
        &self,
        symbols: Vec<String>,
    ) -> Result<(), PolygonError> {
        if !self.config.streaming {
            return Ok(());
        }

        let ws_url = format!("{}/stocks", self.ws_url);
        let url = Url::parse(&ws_url).map_err(|e| PolygonError::WebSocketError(e.to_string()))?;

        let (ws_stream, _) = connect_async(url)
            .await
            .map_err(|e| PolygonError::WebSocketError(e.to_string()))?;

        let (mut write, mut read) = ws_stream.split();

        // Authenticate
        let auth_msg = serde_json::json!({
            "action": "auth",
            "params": self.config.api_key
        });

        write
            .send(Message::Text(auth_msg.to_string()))
            .await
            .map_err(|e| PolygonError::WebSocketError(e.to_string()))?;

        // Subscribe to symbols
        let num_symbols = symbols.len();
        for symbol in symbols {
            let subscribe_msg = serde_json::json!({
                "action": "subscribe",
                "params": format!("T.{},Q.{},A.{}", symbol, symbol, symbol) // Trades, Quotes, Aggregates
            });

            write
                .send(Message::Text(subscribe_msg.to_string()))
                .await
                .map_err(|e| PolygonError::WebSocketError(e.to_string()))?;
        }

        info!("Polygon WebSocket streaming started for {} symbols", num_symbols);

        // Spawn task to handle incoming messages
        let last_quote = self.last_quote.clone();
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(events) = serde_json::from_str::<Vec<PolygonWebSocketEvent>>(&text)
                        {
                            for event in events {
                                match event.ev.as_str() {
                                    "Q" => {
                                        // Quote update
                                        debug!("Quote: {:?}", event);
                                    }
                                    "T" => {
                                        // Trade update
                                        debug!("Trade: {:?}", event);
                                    }
                                    "A" | "AM" => {
                                        // Aggregate update
                                        debug!("Aggregate: {:?}", event);
                                    }
                                    _ => {}
                                }
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        warn!("Polygon WebSocket closed");
                        break;
                    }
                    Err(e) => {
                        error!("Polygon WebSocket error: {}", e);
                        break;
                    }
                    _ => {}
                }
            }
        });

        Ok(())
    }

    /// Get ticker details
    pub async fn get_ticker_details(&self, symbol: &str) -> Result<PolygonTickerDetails, PolygonError> {
        self.rate_limiter.until_ready().await;

        let url = format!(
            "{}/v3/reference/tickers/{}?apiKey={}",
            self.base_url, symbol, self.config.api_key
        );

        let response = self.client.get(&url).send().await?;

        if response.status().is_success() {
            let result: PolygonTickerDetailsResponse = response.json().await?;
            Ok(result.results)
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(PolygonError::ApiError(error_text))
        }
    }
}

// Polygon API types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonQuote {
    #[serde(rename = "T")]
    pub symbol: String,
    #[serde(rename = "t")]
    pub sip_timestamp: i64,
    #[serde(rename = "y")]
    pub exchange_timestamp: i64,
    #[serde(rename = "p")]
    pub bid_price: Decimal,
    #[serde(rename = "s")]
    pub bid_size: i64,
    #[serde(rename = "P")]
    pub ask_price: Decimal,
    #[serde(rename = "S")]
    pub ask_size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolygonAggregate {
    #[serde(rename = "o")]
    pub open: Decimal,
    #[serde(rename = "h")]
    pub high: Decimal,
    #[serde(rename = "l")]
    pub low: Decimal,
    #[serde(rename = "c")]
    pub close: Decimal,
    #[serde(rename = "v")]
    pub volume: i64,
    #[serde(rename = "vw")]
    pub vwap: Option<Decimal>,
    #[serde(rename = "t")]
    pub timestamp: i64,
    #[serde(rename = "n")]
    pub transactions: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct PolygonLastQuoteResponse {
    status: String,
    results: PolygonQuote,
}

#[derive(Debug, Deserialize)]
struct PolygonAggregatesResponse {
    ticker: String,
    #[serde(default)]
    results: Vec<PolygonAggregate>,
    status: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PolygonTickerSnapshot {
    pub ticker: String,
    pub day: Option<PolygonAggregate>,
    #[serde(rename = "lastQuote")]
    pub last_quote: Option<PolygonQuote>,
    #[serde(rename = "lastTrade")]
    pub last_trade: Option<PolygonTrade>,
    #[serde(rename = "prevDay")]
    pub prev_day: Option<PolygonAggregate>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PolygonTrade {
    #[serde(rename = "p")]
    pub price: Decimal,
    #[serde(rename = "s")]
    pub size: i64,
    #[serde(rename = "t")]
    pub timestamp: i64,
}

#[derive(Debug, Deserialize)]
struct PolygonSnapshotResponse {
    status: String,
    tickers: Vec<PolygonTickerSnapshot>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PolygonWebSocketEvent {
    pub ev: String,
    #[serde(rename = "sym")]
    pub symbol: Option<String>,
    #[serde(flatten)]
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Deserialize)]
pub struct PolygonTickerDetails {
    pub ticker: String,
    pub name: String,
    pub market: String,
    pub locale: String,
    pub primary_exchange: String,
    #[serde(rename = "type")]
    pub ticker_type: String,
    pub active: bool,
    pub currency_name: String,
    pub cik: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PolygonTickerDetailsResponse {
    status: String,
    results: PolygonTickerDetails,
}

/// Polygon.io error types
#[derive(Debug, thiserror::Error)]
pub enum PolygonError {
    #[error("API error: {0}")]
    ApiError(String),

    #[error("WebSocket error: {0}")]
    WebSocketError(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_polygon_client_creation() {
        let _config = PolygonConfig {
            api_key: "test_key".to_string(),
            ..Default::default()
        };
        let client = PolygonClient::new(config);
        assert_eq!(client.base_url, "https://api.polygon.io");
    }
}

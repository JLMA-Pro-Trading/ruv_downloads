// Alpha Vantage market data integration
//
// Free API for market data (500 requests/day free tier)
// Features:
// - Stock quotes and historical data
// - Technical indicators (50+ indicators)
// - Fundamental data
// - Forex and crypto data

use chrono::{Utc};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::Client;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::num::NonZeroU32;
use std::time::Duration;
use tracing::{debug, error};

/// Alpha Vantage configuration
#[derive(Debug, Clone)]
pub struct AlphaVantageConfig {
    /// API key from alphavantage.co
    pub api_key: String,
    /// Request timeout
    pub timeout: Duration,
}

impl Default for AlphaVantageConfig {
    fn default() -> Self {
        Self {
            api_key: String::new(),
            timeout: Duration::from_secs(30),
        }
    }
}

/// Alpha Vantage client for market data
pub struct AlphaVantageClient {
    client: Client,
    config: AlphaVantageConfig,
    base_url: String,
    rate_limiter: DefaultDirectRateLimiter,
}

impl AlphaVantageClient {
    /// Create a new Alpha Vantage client
    pub fn new(config: AlphaVantageConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .expect("Failed to create HTTP client");

        // Free tier: 5 requests per minute, 500 per day
        let quota = Quota::per_minute(NonZeroU32::new(5).unwrap());
        let rate_limiter = RateLimiter::direct(quota);

        Self {
            client,
            config,
            base_url: "https://www.alphavantage.co/query".to_string(),
            rate_limiter,
        }
    }

    /// Get real-time quote for a symbol
    pub async fn get_quote(&self, symbol: &str) -> Result<AlphaVantageQuote, AlphaVantageError> {
        self.rate_limiter.until_ready().await;

        let params = [
            ("function", "GLOBAL_QUOTE"),
            ("symbol", symbol),
            ("apikey", &self.config.api_key),
        ];

        debug!("Alpha Vantage request: GLOBAL_QUOTE for {}", symbol);

        let response = self
            .client
            .get(&self.base_url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;

            if let Some(quote) = data.get("Global Quote") {
                Ok(AlphaVantageQuote {
                    symbol: quote.get("01. symbol")
                        .and_then(|v| v.as_str())
                        .unwrap_or(symbol)
                        .to_string(),
                    price: quote.get("05. price")
                        .and_then(|v| v.as_str())
                        .and_then(|s| Decimal::from_str_exact(s).ok())
                        .unwrap_or_default(),
                    volume: quote.get("06. volume")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse().ok())
                        .unwrap_or(0),
                    change: quote.get("09. change")
                        .and_then(|v| v.as_str())
                        .and_then(|s| Decimal::from_str_exact(s).ok())
                        .unwrap_or_default(),
                    change_percent: quote.get("10. change percent")
                        .and_then(|v| v.as_str())
                        .map(|s| s.replace("%", ""))
                        .and_then(|s| Decimal::from_str_exact(&s).ok())
                        .unwrap_or_default(),
                })
            } else {
                Err(AlphaVantageError::ApiError("No quote data found".to_string()))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("Alpha Vantage API error: {}", error_text);
            Err(AlphaVantageError::ApiError(error_text))
        }
    }

    /// Get daily time series data
    pub async fn get_daily(
        &self,
        symbol: &str,
        outputsize: &str, // "compact" (100 days) or "full"
    ) -> Result<Vec<AlphaVantageBar>, AlphaVantageError> {
        self.rate_limiter.until_ready().await;

        let params = [
            ("function", "TIME_SERIES_DAILY"),
            ("symbol", symbol),
            ("outputsize", outputsize),
            ("apikey", &self.config.api_key),
        ];

        let response = self
            .client
            .get(&self.base_url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;

            if let Some(time_series) = data.get("Time Series (Daily)").and_then(|v| v.as_object()) {
                let mut bars = Vec::new();

                for (date, values) in time_series {
                    if let Some(obj) = values.as_object() {
                        bars.push(AlphaVantageBar {
                            date: date.clone(),
                            open: obj.get("1. open")
                                .and_then(|v| v.as_str())
                                .and_then(|s| Decimal::from_str_exact(s).ok())
                                .unwrap_or_default(),
                            high: obj.get("2. high")
                                .and_then(|v| v.as_str())
                                .and_then(|s| Decimal::from_str_exact(s).ok())
                                .unwrap_or_default(),
                            low: obj.get("3. low")
                                .and_then(|v| v.as_str())
                                .and_then(|s| Decimal::from_str_exact(s).ok())
                                .unwrap_or_default(),
                            close: obj.get("4. close")
                                .and_then(|v| v.as_str())
                                .and_then(|s| Decimal::from_str_exact(s).ok())
                                .unwrap_or_default(),
                            volume: obj.get("5. volume")
                                .and_then(|v| v.as_str())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(0),
                        });
                    }
                }

                Ok(bars)
            } else {
                Err(AlphaVantageError::ApiError("No time series data found".to_string()))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AlphaVantageError::ApiError(error_text))
        }
    }

    /// Get technical indicator (SMA, EMA, RSI, etc.)
    pub async fn get_indicator(
        &self,
        symbol: &str,
        indicator: &str, // SMA, EMA, RSI, MACD, etc.
        interval: &str,  // 1min, 5min, 15min, 30min, 60min, daily, weekly, monthly
        time_period: u32,
    ) -> Result<HashMap<String, Decimal>, AlphaVantageError> {
        self.rate_limiter.until_ready().await;

        let params = [
            ("function", indicator),
            ("symbol", symbol),
            ("interval", interval),
            ("time_period", &time_period.to_string()),
            ("series_type", "close"),
            ("apikey", &self.config.api_key),
        ];

        let response = self
            .client
            .get(&self.base_url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let data: serde_json::Value = response.json().await?;

            let key = format!("Technical Analysis: {}", indicator);
            if let Some(indicator_data) = data.get(&key).and_then(|v| v.as_object()) {
                let mut results = HashMap::new();

                for (date, values) in indicator_data {
                    if let Some(value) = values.get(indicator).and_then(|v| v.as_str()) {
                        if let Ok(decimal_value) = Decimal::from_str_exact(value) {
                            results.insert(date.clone(), decimal_value);
                        }
                    }
                }

                Ok(results)
            } else {
                Err(AlphaVantageError::ApiError("No indicator data found".to_string()))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(AlphaVantageError::ApiError(error_text))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlphaVantageQuote {
    pub symbol: String,
    pub price: Decimal,
    pub volume: i64,
    pub change: Decimal,
    pub change_percent: Decimal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AlphaVantageBar {
    pub date: String,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: i64,
}

#[derive(Debug, thiserror::Error)]
pub enum AlphaVantageError {
    #[error("API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

// Yahoo Finance integration for historical data
//
// Free, unlimited API access (unofficial)
// Features:
// - Historical price data (OHLCV)
// - Real-time quotes
// - Company fundamentals
// - Options data

use chrono::{DateTime, Utc};
use reqwest::Client;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use tracing::{debug, error};

/// Yahoo Finance configuration
#[derive(Debug, Clone)]
pub struct YahooFinanceConfig {
    /// Request timeout
    pub timeout: Duration,
}

impl Default for YahooFinanceConfig {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(30),
        }
    }
}

/// Yahoo Finance client
pub struct YahooFinanceClient {
    client: Client,
    config: YahooFinanceConfig,
    base_url: String,
}

impl YahooFinanceClient {
    /// Create a new Yahoo Finance client
    pub fn new(config: YahooFinanceConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .user_agent("Mozilla/5.0")
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            config,
            base_url: "https://query2.finance.yahoo.com".to_string(),
        }
    }

    /// Get historical data for a symbol
    pub async fn get_historical(
        &self,
        symbol: &str,
        period1: DateTime<Utc>,
        period2: DateTime<Utc>,
        interval: &str, // 1d, 1wk, 1mo
    ) -> Result<Vec<YahooBar>, YahooFinanceError> {
        let url = format!(
            "{}/v8/finance/chart/{}",
            self.base_url, symbol
        );

        let params = [
            ("period1", period1.timestamp().to_string()),
            ("period2", period2.timestamp().to_string()),
            ("interval", interval.to_string()),
            ("includePrePost", "false".to_string()),
        ];

        debug!("Yahoo Finance request: historical data for {}", symbol);

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let data: YahooChartResponse = response.json().await?;

            if let Some(error) = data.chart.error {
                return Err(YahooFinanceError::ApiError(error.description));
            }

            if let Some(result) = data.chart.result.first() {
                let timestamps = &result.timestamp;
                let quote = &result.indicators.quote.first()
                    .ok_or_else(|| YahooFinanceError::ApiError("No quote data".to_string()))?;

                let mut bars = Vec::new();

                for (i, &timestamp) in timestamps.iter().enumerate() {
                    if let (Some(open), Some(high), Some(low), Some(close), Some(volume)) = (
                        quote.open.get(i).and_then(|v| *v),
                        quote.high.get(i).and_then(|v| *v),
                        quote.low.get(i).and_then(|v| *v),
                        quote.close.get(i).and_then(|v| *v),
                        quote.volume.get(i).and_then(|v| *v),
                    ) {
                        bars.push(YahooBar {
                            timestamp,
                            open: Decimal::try_from(open).unwrap_or_default(),
                            high: Decimal::try_from(high).unwrap_or_default(),
                            low: Decimal::try_from(low).unwrap_or_default(),
                            close: Decimal::try_from(close).unwrap_or_default(),
                            volume: volume as i64,
                        });
                    }
                }

                Ok(bars)
            } else {
                Err(YahooFinanceError::ApiError("No data found".to_string()))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("Yahoo Finance error: {}", error_text);
            Err(YahooFinanceError::ApiError(error_text))
        }
    }

    /// Get current quote for a symbol
    pub async fn get_quote(&self, symbol: &str) -> Result<YahooQuote, YahooFinanceError> {
        let url = format!("{}/v7/finance/quote", self.base_url);

        let params = [("symbols", symbol)];

        let response = self
            .client
            .get(&url)
            .query(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let data: YahooQuoteResponse = response.json().await?;

            if let Some(result) = data.quote_response.result.first() {
                Ok(YahooQuote {
                    symbol: result.symbol.clone(),
                    price: result.regular_market_price.unwrap_or_default(),
                    change: result.regular_market_change.unwrap_or_default(),
                    change_percent: result.regular_market_change_percent.unwrap_or_default(),
                    volume: result.regular_market_volume.unwrap_or(0),
                    market_cap: result.market_cap,
                })
            } else {
                Err(YahooFinanceError::ApiError("No quote found".to_string()))
            }
        } else {
            let error_text = response.text().await.unwrap_or_default();
            Err(YahooFinanceError::ApiError(error_text))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YahooBar {
    pub timestamp: i64,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
    pub volume: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YahooQuote {
    pub symbol: String,
    pub price: Decimal,
    pub change: Decimal,
    pub change_percent: Decimal,
    pub volume: i64,
    pub market_cap: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResponse {
    chart: YahooChart,
}

#[derive(Debug, Deserialize)]
struct YahooChart {
    result: Vec<YahooChartResult>,
    error: Option<YahooError>,
}

#[derive(Debug, Deserialize)]
struct YahooChartResult {
    timestamp: Vec<i64>,
    indicators: YahooIndicators,
}

#[derive(Debug, Deserialize)]
struct YahooIndicators {
    quote: Vec<YahooQuoteData>,
}

#[derive(Debug, Deserialize)]
struct YahooQuoteData {
    open: Vec<Option<f64>>,
    high: Vec<Option<f64>>,
    low: Vec<Option<f64>>,
    close: Vec<Option<f64>>,
    volume: Vec<Option<i64>>,
}

#[derive(Debug, Deserialize)]
struct YahooError {
    code: String,
    description: String,
}

#[derive(Debug, Deserialize)]
struct YahooQuoteResponse {
    #[serde(rename = "quoteResponse")]
    quote_response: YahooQuoteResponseData,
}

#[derive(Debug, Deserialize)]
struct YahooQuoteResponseData {
    result: Vec<YahooQuoteResult>,
}

#[derive(Debug, Deserialize)]
struct YahooQuoteResult {
    symbol: String,
    #[serde(rename = "regularMarketPrice")]
    regular_market_price: Option<Decimal>,
    #[serde(rename = "regularMarketChange")]
    regular_market_change: Option<Decimal>,
    #[serde(rename = "regularMarketChangePercent")]
    regular_market_change_percent: Option<Decimal>,
    #[serde(rename = "regularMarketVolume")]
    regular_market_volume: Option<i64>,
    #[serde(rename = "marketCap")]
    market_cap: Option<i64>,
}

#[derive(Debug, thiserror::Error)]
pub enum YahooFinanceError {
    #[error("API error: {0}")]
    ApiError(String),

    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Parse error: {0}")]
    Parse(#[from] serde_json::Error),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

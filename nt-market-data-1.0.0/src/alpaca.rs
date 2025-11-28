// Alpaca Markets adapter implementation
//
// Supports both REST and WebSocket APIs for market data and order execution

use crate::{
    errors::{MarketDataError, Result},
    rest::RestClient,
    types::{Bar, Quote, Timeframe, Trade},
    websocket::{WebSocketClient, WebSocketStream},
    {HealthStatus, MarketDataProvider, QuoteStream, TradeStream},
};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;
use tracing::{error, info};

pub struct AlpacaClient {
    rest_client: Arc<RestClient>,
    api_key: String,
    secret_key: String,
    ws_url: String,
    paper_trading: bool,
}

impl AlpacaClient {
    pub fn new(api_key: String, secret_key: String, paper_trading: bool) -> Self {
        let base_url = if paper_trading {
            "https://paper-api.alpaca.markets"
        } else {
            "https://api.alpaca.markets"
        };

        let ws_url = if paper_trading {
            "wss://stream.data.alpaca.markets/v2/iex"
        } else {
            "wss://stream.data.alpaca.markets/v2/sip"
        };

        let rest_client = Arc::new(RestClient::new(base_url.to_string(), 200));

        Self {
            rest_client,
            api_key,
            secret_key,
            ws_url: ws_url.to_string(),
            paper_trading,
        }
    }

    fn auth_headers(&self) -> Vec<(&str, &str)> {
        vec![
            ("APCA-API-KEY-ID", &self.api_key),
            ("APCA-API-SECRET-KEY", &self.secret_key),
        ]
    }

    async fn authenticate_websocket(&self, stream: &mut WebSocketStream) -> Result<()> {
        let auth_msg = json!({
            "action": "auth",
            "key": self.api_key,
            "secret": self.secret_key,
        });

        stream.send(Message::Text(auth_msg.to_string())).await?;

        // Wait for auth confirmation
        if let Some(Ok(Message::Text(msg))) = stream.next().await {
            let response: serde_json::Value =
                serde_json::from_str(&msg).map_err(|e| MarketDataError::Parse(e.to_string()))?;

            if response.get("T").and_then(|v| v.as_str()) == Some("success") {
                info!("Alpaca WebSocket authenticated");
                Ok(())
            } else {
                Err(MarketDataError::Auth(
                    "WebSocket authentication failed".to_string(),
                ))
            }
        } else {
            Err(MarketDataError::Auth(
                "No authentication response".to_string(),
            ))
        }
    }
}

#[async_trait]
impl MarketDataProvider for AlpacaClient {
    async fn get_quote(&self, symbol: &str) -> Result<Quote> {
        #[derive(Deserialize)]
        struct AlpacaQuote {
            #[serde(rename = "t")]
            timestamp: String,
            #[serde(rename = "bp")]
            bid_price: f64,
            #[serde(rename = "ap")]
            ask_price: f64,
            #[serde(rename = "bs")]
            bid_size: u64,
            #[serde(rename = "as")]
            ask_size: u64,
        }

        #[derive(Deserialize)]
        struct Response {
            quote: AlpacaQuote,
        }

        let path = format!("/v2/stocks/{}/quotes/latest", symbol);
        let response: Response = self.rest_client.get(&path, self.auth_headers()).await?;

        Ok(Quote {
            symbol: symbol.to_string(),
            timestamp: DateTime::parse_from_rfc3339(&response.quote.timestamp)
                .map_err(|e| MarketDataError::Parse(e.to_string()))?
                .with_timezone(&Utc),
            bid: rust_decimal::Decimal::from_f64_retain(response.quote.bid_price)
                .ok_or_else(|| MarketDataError::Parse("Invalid bid price".to_string()))?,
            ask: rust_decimal::Decimal::from_f64_retain(response.quote.ask_price)
                .ok_or_else(|| MarketDataError::Parse("Invalid ask price".to_string()))?,
            bid_size: response.quote.bid_size,
            ask_size: response.quote.ask_size,
        })
    }

    async fn get_bars(
        &self,
        symbol: &str,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        timeframe: Timeframe,
    ) -> Result<Vec<Bar>> {
        #[derive(Deserialize)]
        struct AlpacaBar {
            t: String,
            o: f64,
            h: f64,
            l: f64,
            c: f64,
            v: u64,
        }

        #[derive(Deserialize)]
        struct Response {
            bars: Vec<AlpacaBar>,
        }

        let path = format!(
            "/v2/stocks/{}/bars?start={}&end={}&timeframe={}",
            symbol,
            start.to_rfc3339(),
            end.to_rfc3339(),
            timeframe.as_str()
        );

        let response: Response = self.rest_client.get(&path, self.auth_headers()).await?;

        response
            .bars
            .into_iter()
            .map(|bar| {
                Ok(Bar {
                    symbol: symbol.to_string(),
                    timestamp: DateTime::parse_from_rfc3339(&bar.t)
                        .map_err(|e| MarketDataError::Parse(e.to_string()))?
                        .with_timezone(&Utc),
                    open: rust_decimal::Decimal::from_f64_retain(bar.o)
                        .ok_or_else(|| MarketDataError::Parse("Invalid open price".to_string()))?,
                    high: rust_decimal::Decimal::from_f64_retain(bar.h)
                        .ok_or_else(|| MarketDataError::Parse("Invalid high price".to_string()))?,
                    low: rust_decimal::Decimal::from_f64_retain(bar.l)
                        .ok_or_else(|| MarketDataError::Parse("Invalid low price".to_string()))?,
                    close: rust_decimal::Decimal::from_f64_retain(bar.c)
                        .ok_or_else(|| MarketDataError::Parse("Invalid close price".to_string()))?,
                    volume: bar.v,
                })
            })
            .collect()
    }

    async fn subscribe_quotes(&self, symbols: Vec<String>) -> Result<QuoteStream> {
        let (tx, rx) = mpsc::channel(1000);
        let ws_client = WebSocketClient::new(self.ws_url.clone());
        let api_key = self.api_key.clone();
        let secret_key = self.secret_key.clone();

        tokio::spawn(async move {
            let mut stream = match ws_client.connect_with_retry().await {
                Ok(stream) => stream,
                Err(e) => {
                    error!("Failed to connect WebSocket: {}", e);
                    return;
                }
            };

            // Authenticate
            let auth_msg = json!({
                "action": "auth",
                "key": api_key,
                "secret": secret_key,
            });

            if let Err(e) = stream.send(Message::Text(auth_msg.to_string())).await {
                error!("Failed to send auth: {}", e);
                return;
            }

            // Subscribe to quotes
            let subscribe_msg = json!({
                "action": "subscribe",
                "quotes": symbols,
            });

            if let Err(e) = stream.send(Message::Text(subscribe_msg.to_string())).await {
                error!("Failed to subscribe: {}", e);
                return;
            }

            // Process messages
            while let Some(msg) = stream.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(quote) = Self::parse_quote(&text) {
                            if tx.send(Ok(quote)).await.is_err() {
                                break; // Receiver dropped
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(Err(e)).await;
                        break;
                    }
                    _ => {}
                }
            }
        });

        let stream = tokio_stream::wrappers::ReceiverStream::new(rx);
        Ok(Box::pin(stream))
    }

    async fn subscribe_trades(&self, symbols: Vec<String>) -> Result<TradeStream> {
        let (tx, rx) = mpsc::channel(1000);
        let ws_client = WebSocketClient::new(self.ws_url.clone());
        let api_key = self.api_key.clone();
        let secret_key = self.secret_key.clone();

        tokio::spawn(async move {
            let mut stream = match ws_client.connect_with_retry().await {
                Ok(stream) => stream,
                Err(e) => {
                    error!("Failed to connect WebSocket: {}", e);
                    return;
                }
            };

            // Authenticate
            let auth_msg = json!({
                "action": "auth",
                "key": api_key,
                "secret": secret_key,
            });

            if let Err(e) = stream.send(Message::Text(auth_msg.to_string())).await {
                error!("Failed to send auth: {}", e);
                return;
            }

            // Subscribe to trades
            let subscribe_msg = json!({
                "action": "subscribe",
                "trades": symbols,
            });

            if let Err(e) = stream.send(Message::Text(subscribe_msg.to_string())).await {
                error!("Failed to subscribe: {}", e);
                return;
            }

            // Process messages
            while let Some(msg) = stream.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(trade) = Self::parse_trade(&text) {
                            if tx.send(Ok(trade)).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(e) => {
                        let _ = tx.send(Err(e)).await;
                        break;
                    }
                    _ => {}
                }
            }
        });

        let stream = tokio_stream::wrappers::ReceiverStream::new(rx);
        Ok(Box::pin(stream))
    }

    async fn health_check(&self) -> Result<HealthStatus> {
        let path = "/v2/clock";
        let _: serde_json::Value = self.rest_client.get(path, self.auth_headers()).await?;
        Ok(HealthStatus::Healthy)
    }
}

impl AlpacaClient {
    fn parse_quote(text: &str) -> Result<Quote> {
        #[derive(Deserialize)]
        struct WsQuote {
            #[serde(rename = "T")]
            msg_type: String,
            #[serde(rename = "S")]
            symbol: String,
            #[serde(rename = "t")]
            timestamp: String,
            #[serde(rename = "bp")]
            bid_price: f64,
            #[serde(rename = "ap")]
            ask_price: f64,
            #[serde(rename = "bs")]
            bid_size: u64,
            #[serde(rename = "as")]
            ask_size: u64,
        }

        let quote: WsQuote =
            serde_json::from_str(text).map_err(|e| MarketDataError::Parse(e.to_string()))?;

        if quote.msg_type != "q" {
            return Err(MarketDataError::Parse("Not a quote message".to_string()));
        }

        Ok(Quote {
            symbol: quote.symbol,
            timestamp: DateTime::parse_from_rfc3339(&quote.timestamp)
                .map_err(|e| MarketDataError::Parse(e.to_string()))?
                .with_timezone(&Utc),
            bid: rust_decimal::Decimal::from_f64_retain(quote.bid_price)
                .ok_or_else(|| MarketDataError::Parse("Invalid bid price".to_string()))?,
            ask: rust_decimal::Decimal::from_f64_retain(quote.ask_price)
                .ok_or_else(|| MarketDataError::Parse("Invalid ask price".to_string()))?,
            bid_size: quote.bid_size,
            ask_size: quote.ask_size,
        })
    }

    fn parse_trade(text: &str) -> Result<Trade> {
        #[derive(Deserialize)]
        struct WsTrade {
            #[serde(rename = "T")]
            msg_type: String,
            #[serde(rename = "S")]
            symbol: String,
            #[serde(rename = "t")]
            timestamp: String,
            #[serde(rename = "p")]
            price: f64,
            #[serde(rename = "s")]
            size: u64,
            #[serde(rename = "c", default)]
            conditions: Vec<String>,
        }

        let trade: WsTrade =
            serde_json::from_str(text).map_err(|e| MarketDataError::Parse(e.to_string()))?;

        if trade.msg_type != "t" {
            return Err(MarketDataError::Parse("Not a trade message".to_string()));
        }

        Ok(Trade {
            symbol: trade.symbol,
            timestamp: DateTime::parse_from_rfc3339(&trade.timestamp)
                .map_err(|e| MarketDataError::Parse(e.to_string()))?
                .with_timezone(&Utc),
            price: rust_decimal::Decimal::from_f64_retain(trade.price)
                .ok_or_else(|| MarketDataError::Parse("Invalid price".to_string()))?,
            size: trade.size,
            conditions: trade.conditions,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_alpaca_client_creation() {
        let client = AlpacaClient::new("test_key".to_string(), "test_secret".to_string(), true);

        assert!(client.paper_trading);
        assert_eq!(client.api_key, "test_key");
    }

    #[test]
    fn test_parse_quote() {
        let json = r#"{
            "T": "q",
            "S": "AAPL",
            "t": "2024-01-01T10:00:00Z",
            "bp": 150.00,
            "ap": 150.10,
            "bs": 100,
            "as": 200
        }"#;

        let quote = AlpacaClient::parse_quote(json).unwrap();
        assert_eq!(quote.symbol, "AAPL");
        assert_eq!(quote.bid_size, 100);
        assert_eq!(quote.ask_size, 200);
    }
}

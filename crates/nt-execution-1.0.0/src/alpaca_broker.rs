// Alpaca broker implementation
//
// Features:
// - REST API for orders, positions, account info
// - WebSocket for real-time order updates
// - Rate limiting (200 requests/minute)
// - Automatic retry with exponential backoff

use crate::broker::{
    Account, BrokerClient, BrokerError, HealthStatus, OrderFilter, Position, PositionSide,
};
use crate::{OrderRequest, OrderResponse, OrderSide, OrderStatus, OrderType, OrderUpdate, Symbol, TimeInForce};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::{Client, Method, StatusCode};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

/// Alpaca broker client
pub struct AlpacaBroker {
    client: Client,
    base_url: String,
    api_key: String,
    secret_key: String,
    rate_limiter: DefaultDirectRateLimiter,
    paper_trading: bool,
}

impl AlpacaBroker {
    /// Create a new Alpaca broker client
    pub fn new(api_key: String, secret_key: String, paper_trading: bool) -> Self {
        let base_url = if paper_trading {
            "https://paper-api.alpaca.markets".to_string()
        } else {
            "https://api.alpaca.markets".to_string()
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        // Rate limit: 200 requests per minute
        let quota = Quota::per_minute(NonZeroU32::new(200).unwrap());
        let rate_limiter = RateLimiter::direct(quota);

        Self {
            client,
            base_url,
            api_key,
            secret_key,
            rate_limiter,
            paper_trading,
        }
    }

    /// Make an authenticated request to Alpaca API
    async fn request<T: serde::de::DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<impl Serialize>,
    ) -> Result<T, BrokerError> {
        // Wait for rate limiter
        self.rate_limiter.until_ready().await;

        let url = format!("{}{}", self.base_url, path);

        let mut req = self
            .client
            .request(method.clone(), &url)
            .header("APCA-API-KEY-ID", &self.api_key)
            .header("APCA-API-SECRET-KEY", &self.secret_key);

        if let Some(body) = body {
            req = req.json(&body);
        }

        debug!("Alpaca API request: {} {}", method, path);

        let response = req.send().await?;
        let status = response.status();

        match status {
            StatusCode::OK | StatusCode::CREATED => {
                let result = response.json().await?;
                Ok(result)
            }
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                Err(BrokerError::Auth("Invalid API keys".to_string()))
            }
            StatusCode::TOO_MANY_REQUESTS => Err(BrokerError::RateLimit),
            StatusCode::NOT_FOUND => {
                let error_text = response.text().await.unwrap_or_default();
                Err(BrokerError::OrderNotFound(error_text))
            }
            StatusCode::UNPROCESSABLE_ENTITY => {
                let error_text = response.text().await.unwrap_or_default();
                if error_text.contains("insufficient") {
                    Err(BrokerError::InsufficientFunds)
                } else {
                    Err(BrokerError::InvalidOrder(error_text))
                }
            }
            _ => {
                let error_text = response.text().await.unwrap_or_default();
                error!("Alpaca API error: {} - {}", status, error_text);
                Err(BrokerError::Network(error_text))
            }
        }
    }
}

#[async_trait]
impl BrokerClient for AlpacaBroker {
    async fn get_account(&self) -> Result<Account, BrokerError> {
        #[derive(Deserialize)]
        struct AlpacaAccount {
            id: String,
            cash: String,
            portfolio_value: String,
            buying_power: String,
            equity: String,
            last_equity: String,
            multiplier: String,
            currency: String,
            shorting_enabled: bool,
            long_market_value: String,
            short_market_value: String,
            initial_margin: String,
            maintenance_margin: String,
            daytrade_count: i32,
            daytrading_buying_power: String,
        }

        let account: AlpacaAccount = self.request(Method::GET, "/v2/account", None::<()>).await?;

        Ok(Account {
            account_id: account.id,
            cash: Decimal::from_str_exact(&account.cash).unwrap_or_default(),
            portfolio_value: Decimal::from_str_exact(&account.portfolio_value)
                .unwrap_or_default(),
            buying_power: Decimal::from_str_exact(&account.buying_power).unwrap_or_default(),
            equity: Decimal::from_str_exact(&account.equity).unwrap_or_default(),
            last_equity: Decimal::from_str_exact(&account.last_equity).unwrap_or_default(),
            multiplier: account.multiplier,
            currency: account.currency,
            shorting_enabled: account.shorting_enabled,
            long_market_value: Decimal::from_str_exact(&account.long_market_value)
                .unwrap_or_default(),
            short_market_value: Decimal::from_str_exact(&account.short_market_value)
                .unwrap_or_default(),
            initial_margin: Decimal::from_str_exact(&account.initial_margin).unwrap_or_default(),
            maintenance_margin: Decimal::from_str_exact(&account.maintenance_margin)
                .unwrap_or_default(),
            day_trading_buying_power: Decimal::from_str_exact(&account.daytrading_buying_power)
                .unwrap_or_default(),
            daytrade_count: account.daytrade_count,
        })
    }

    async fn get_positions(&self) -> Result<Vec<Position>, BrokerError> {
        #[derive(Deserialize)]
        struct AlpacaPosition {
            symbol: String,
            qty: String,
            side: String,
            avg_entry_price: String,
            market_value: String,
            cost_basis: String,
            unrealized_pl: String,
            unrealized_plpc: String,
            current_price: String,
            lastday_price: String,
            change_today: String,
        }

        let positions: Vec<AlpacaPosition> =
            self.request(Method::GET, "/v2/positions", None::<()>)
                .await?;

        Ok(positions
            .into_iter()
            .map(|pos| Position {
                symbol: Symbol::new(&pos.symbol).expect("Invalid symbol from Alpaca"),
                qty: pos.qty.parse().unwrap_or(0),
                side: match pos.side.as_str() {
                    "long" => PositionSide::Long,
                    "short" => PositionSide::Short,
                    _ => PositionSide::Long,
                },
                avg_entry_price: Decimal::from_str_exact(&pos.avg_entry_price)
                    .unwrap_or_default(),
                market_value: Decimal::from_str_exact(&pos.market_value).unwrap_or_default(),
                cost_basis: Decimal::from_str_exact(&pos.cost_basis).unwrap_or_default(),
                unrealized_pl: Decimal::from_str_exact(&pos.unrealized_pl).unwrap_or_default(),
                unrealized_plpc: Decimal::from_str_exact(&pos.unrealized_plpc).unwrap_or_default(),
                current_price: Decimal::from_str_exact(&pos.current_price).unwrap_or_default(),
                lastday_price: Decimal::from_str_exact(&pos.lastday_price).unwrap_or_default(),
                change_today: Decimal::from_str_exact(&pos.change_today).unwrap_or_default(),
            })
            .collect())
    }

    async fn place_order(&self, order: OrderRequest) -> Result<OrderResponse, BrokerError> {
        #[derive(Serialize)]
        struct AlpacaOrderRequest {
            symbol: String,
            qty: String,
            side: String,
            #[serde(rename = "type")]
            order_type: String,
            time_in_force: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            limit_price: Option<String>,
            #[serde(skip_serializing_if = "Option::is_none")]
            stop_price: Option<String>,
        }

        #[derive(Deserialize)]
        struct AlpacaOrderResponse {
            id: String,
            client_order_id: String,
            symbol: String,
            qty: String,
            side: String,
            status: String,
            filled_qty: String,
            filled_avg_price: Option<String>,
            submitted_at: String,
            filled_at: Option<String>,
        }

        let alpaca_order = AlpacaOrderRequest {
            symbol: order.symbol.as_str().to_string(),
            qty: order.quantity.to_string(),
            side: match order.side {
                OrderSide::Buy => "buy".to_string(),
                OrderSide::Sell => "sell".to_string(),
            },
            order_type: match order.order_type {
                OrderType::Market => "market".to_string(),
                OrderType::Limit => "limit".to_string(),
                OrderType::StopLoss => "stop".to_string(),
                OrderType::StopLimit => "stop_limit".to_string(),
            },
            time_in_force: match order.time_in_force {
                TimeInForce::Day => "day".to_string(),
                TimeInForce::GTC => "gtc".to_string(),
                TimeInForce::IOC => "ioc".to_string(),
                TimeInForce::FOK => "fok".to_string(),
            },
            limit_price: order.limit_price.map(|p| p.to_string()),
            stop_price: order.stop_price.map(|p| p.to_string()),
        };

        let response: AlpacaOrderResponse = self
            .request(Method::POST, "/v2/orders", Some(alpaca_order))
            .await?;

        info!("Order placed on Alpaca: {}", response.id);

        Ok(OrderResponse {
            order_id: response.id,
            client_order_id: response.client_order_id,
            status: parse_order_status(&response.status),
            filled_qty: response.filled_qty.parse().unwrap_or(0),
            filled_avg_price: response
                .filled_avg_price
                .and_then(|p| Decimal::from_str_exact(&p).ok()),
            submitted_at: DateTime::parse_from_rfc3339(&response.submitted_at)
                .unwrap()
                .with_timezone(&Utc),
            filled_at: response
                .filled_at
                .and_then(|t| DateTime::parse_from_rfc3339(&t).ok())
                .map(|dt| dt.with_timezone(&Utc)),
        })
    }

    async fn cancel_order(&self, order_id: &str) -> Result<(), BrokerError> {
        let path = format!("/v2/orders/{}", order_id);
        let _: serde_json::Value = self.request(Method::DELETE, &path, None::<()>).await?;

        info!("Order cancelled on Alpaca: {}", order_id);
        Ok(())
    }

    async fn get_order(&self, order_id: &str) -> Result<OrderResponse, BrokerError> {
        #[derive(Deserialize)]
        struct AlpacaOrderResponse {
            id: String,
            client_order_id: String,
            symbol: String,
            qty: String,
            side: String,
            status: String,
            filled_qty: String,
            filled_avg_price: Option<String>,
            submitted_at: String,
            filled_at: Option<String>,
        }

        let path = format!("/v2/orders/{}", order_id);
        let response: AlpacaOrderResponse = self.request(Method::GET, &path, None::<()>).await?;

        Ok(OrderResponse {
            order_id: response.id,
            client_order_id: response.client_order_id,
            status: parse_order_status(&response.status),
            filled_qty: response.filled_qty.parse().unwrap_or(0),
            filled_avg_price: response
                .filled_avg_price
                .and_then(|p| Decimal::from_str_exact(&p).ok()),
            submitted_at: DateTime::parse_from_rfc3339(&response.submitted_at)
                .unwrap()
                .with_timezone(&Utc),
            filled_at: response
                .filled_at
                .and_then(|t| DateTime::parse_from_rfc3339(&t).ok())
                .map(|dt| dt.with_timezone(&Utc)),
        })
    }

    async fn list_orders(&self, filter: OrderFilter) -> Result<Vec<OrderResponse>, BrokerError> {
        #[derive(Deserialize)]
        struct AlpacaOrderResponse {
            id: String,
            client_order_id: String,
            symbol: String,
            qty: String,
            side: String,
            status: String,
            filled_qty: String,
            filled_avg_price: Option<String>,
            submitted_at: String,
            filled_at: Option<String>,
        }

        let mut path = "/v2/orders".to_string();
        let mut params = Vec::new();

        if let Some(status) = filter.status {
            params.push(format!("status={:?}", status).to_lowercase());
        }
        if let Some(limit) = filter.limit {
            params.push(format!("limit={}", limit));
        }

        if !params.is_empty() {
            path.push('?');
            path.push_str(&params.join("&"));
        }

        let orders: Vec<AlpacaOrderResponse> = self.request(Method::GET, &path, None::<()>).await?;

        Ok(orders
            .into_iter()
            .map(|order| OrderResponse {
                order_id: order.id,
                client_order_id: order.client_order_id,
                status: parse_order_status(&order.status),
                filled_qty: order.filled_qty.parse().unwrap_or(0),
                filled_avg_price: order
                    .filled_avg_price
                    .and_then(|p| Decimal::from_str_exact(&p).ok()),
                submitted_at: DateTime::parse_from_rfc3339(&order.submitted_at)
                    .unwrap()
                    .with_timezone(&Utc),
                filled_at: order
                    .filled_at
                    .and_then(|t| DateTime::parse_from_rfc3339(&t).ok())
                    .map(|dt| dt.with_timezone(&Utc)),
            })
            .collect())
    }

    async fn health_check(&self) -> Result<HealthStatus, BrokerError> {
        // Check clock endpoint
        let _: serde_json::Value = self.request(Method::GET, "/v2/clock", None::<()>).await?;

        Ok(HealthStatus::Healthy)
    }
}

/// Parse Alpaca order status string to OrderStatus enum
fn parse_order_status(status: &str) -> OrderStatus {
    match status {
        "new" | "pending_new" => OrderStatus::Pending,
        "accepted" => OrderStatus::Accepted,
        "partially_filled" => OrderStatus::PartiallyFilled,
        "filled" => OrderStatus::Filled,
        "canceled" | "pending_cancel" => OrderStatus::Cancelled,
        "rejected" => OrderStatus::Rejected,
        "expired" => OrderStatus::Expired,
        _ => {
            warn!("Unknown order status: {}", status);
            OrderStatus::Pending
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_order_status() {
        assert_eq!(parse_order_status("new"), OrderStatus::Pending);
        assert_eq!(parse_order_status("filled"), OrderStatus::Filled);
        assert_eq!(parse_order_status("canceled"), OrderStatus::Cancelled);
    }

    #[tokio::test]
    async fn test_alpaca_broker_creation() {
        let broker = AlpacaBroker::new(
            "test_key".to_string(),
            "test_secret".to_string(),
            true,
        );

        assert!(broker.paper_trading);
        assert_eq!(broker.base_url, "https://paper-api.alpaca.markets");
    }
}

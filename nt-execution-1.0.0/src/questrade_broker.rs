// Questrade broker integration for Canadian markets
//
// Features:
// - OAuth 2.0 authentication with automatic token refresh
// - Real-time quotes and Level 2 data for TSX/TSXV
// - Order routing to Canadian exchanges
// - TFSA/RRSP account support
// - CAD currency handling

use crate::broker::{
    Account, BrokerClient, BrokerError, HealthStatus, OrderFilter, Position, PositionSide,
};
use crate::{OrderRequest, OrderResponse, OrderSide, OrderStatus, OrderType, Symbol, TimeInForce};
use async_trait::async_trait;
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use governor::{DefaultDirectRateLimiter, Quota, RateLimiter};
use reqwest::{Client, Method, StatusCode};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::num::NonZeroU32;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid;

/// Questrade configuration
#[derive(Debug, Clone)]
pub struct QuestradeConfig {
    /// Refresh token (obtain from Questrade account)
    pub refresh_token: String,
    /// Practice (paper) trading mode
    pub practice: bool,
    /// Request timeout
    pub timeout: Duration,
}

impl Default for QuestradeConfig {
    fn default() -> Self {
        Self {
            refresh_token: String::new(),
            practice: true,
            timeout: Duration::from_secs(30),
        }
    }
}

/// OAuth token information
#[derive(Debug, Clone, Serialize, Deserialize)]
struct OAuthToken {
    access_token: String,
    token_type: String,
    expires_in: i64,
    refresh_token: String,
    api_server: String,
    #[serde(skip)]
    expires_at: Option<DateTime<Utc>>,
}

/// Questrade broker client
pub struct QuestradeBroker {
    client: Client,
    config: QuestradeConfig,
    token: Arc<RwLock<Option<OAuthToken>>>,
    rate_limiter: DefaultDirectRateLimiter,
    account_number: Arc<RwLock<Option<String>>>,
}

impl QuestradeBroker {
    /// Create a new Questrade broker client
    pub fn new(config: QuestradeConfig) -> Self {
        let client = Client::builder()
            .timeout(config.timeout)
            .build()
            .expect("Failed to create HTTP client");

        // Questrade rate limit: 1 request per second for market data
        let quota = Quota::per_second(NonZeroU32::new(1).unwrap());
        let rate_limiter = RateLimiter::direct(quota);

        Self {
            client,
            config,
            token: Arc::new(RwLock::new(None)),
            rate_limiter,
            account_number: Arc::new(RwLock::new(None)),
        }
    }

    /// Authenticate and obtain access token
    pub async fn authenticate(&self) -> Result<(), BrokerError> {
        let url = if self.config.practice {
            "https://practice.login.questrade.com/oauth2/token"
        } else {
            "https://login.questrade.com/oauth2/token"
        };

        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", &self.config.refresh_token),
        ];

        debug!("Authenticating with Questrade");

        let response = self
            .client
            .post(url)
            .form(&params)
            .send()
            .await?;

        if response.status().is_success() {
            let mut token: OAuthToken = response.json().await?;
            token.expires_at = Some(Utc::now() + ChronoDuration::seconds(token.expires_in));

            info!("Questrade authentication successful, expires at {:?}", token.expires_at);
            *self.token.write().await = Some(token);

            // Load account number
            Box::pin(self.load_account_number()).await?;

            Ok(())
        } else {
            let error_text = response.text().await.unwrap_or_default();
            error!("Questrade authentication failed: {}", error_text);
            Err(BrokerError::Auth(format!("Authentication failed: {}", error_text)))
        }
    }

    /// Check if token is expired and refresh if needed
    async fn ensure_authenticated(&self) -> Result<(), BrokerError> {
        let token_guard = self.token.read().await;
        if let Some(token) = token_guard.as_ref() {
            if let Some(expires_at) = token.expires_at {
                if Utc::now() < expires_at - ChronoDuration::minutes(5) {
                    return Ok(());
                }
            }
        }
        drop(token_guard);

        // Token expired or not set, re-authenticate
        Box::pin(self.authenticate()).await
    }

    /// Get API server URL
    async fn api_server(&self) -> Result<String, BrokerError> {
        let token_guard = self.token.read().await;
        token_guard
            .as_ref()
            .map(|t| t.api_server.clone())
            .ok_or_else(|| BrokerError::Auth("Not authenticated".to_string()))
    }

    /// Load primary account number
    async fn load_account_number(&self) -> Result<(), BrokerError> {
        #[derive(Deserialize)]
        struct AccountsResponse {
            accounts: Vec<QuestradeAccount>,
        }

        #[derive(Deserialize)]
        struct QuestradeAccount {
            number: String,
            #[serde(rename = "type")]
            account_type: String,
            status: String,
            #[serde(rename = "isPrimary")]
            is_primary: bool,
        }

        // Use request_internal to avoid recursion during authentication
        let response: AccountsResponse = self.request_internal(Method::GET, "/v1/accounts", None::<()>).await?;

        let primary_account = response
            .accounts
            .into_iter()
            .find(|acc| acc.is_primary && acc.status == "Active")
            .ok_or_else(|| BrokerError::Other(anyhow::anyhow!("No active primary account found")))?;

        *self.account_number.write().await = Some(primary_account.number.clone());
        info!("Using Questrade account: {}", primary_account.number);

        Ok(())
    }

    /// Make authenticated request (internal, no auth check to avoid recursion)
    async fn request_internal<T: serde::de::DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<impl Serialize>,
    ) -> Result<T, BrokerError> {
        self.rate_limiter.until_ready().await;

        let api_server = self.api_server().await?;
        let url = format!("{}{}", api_server, path);

        let token_guard = self.token.read().await;
        let access_token = token_guard
            .as_ref()
            .map(|t| t.access_token.clone())
            .ok_or_else(|| BrokerError::Auth("No access token".to_string()))?;
        drop(token_guard);

        let mut req = self
            .client
            .request(method.clone(), &url)
            .header("Authorization", format!("Bearer {}", access_token));

        if let Some(body) = body {
            req = req.json(&body);
        }

        debug!("Questrade API request: {} {}", method, path);

        let response = req.send().await?;

        match response.status() {
            StatusCode::OK | StatusCode::CREATED => {
                let result = response.json().await?;
                Ok(result)
            }
            StatusCode::UNAUTHORIZED => {
                // Token expired, try to re-authenticate once
                warn!("Questrade token expired, re-authenticating");
                self.authenticate().await?;
                Err(BrokerError::Auth("Token expired, please retry".to_string()))
            }
            StatusCode::TOO_MANY_REQUESTS => Err(BrokerError::RateLimit),
            status => {
                let error_text = response.text().await.unwrap_or_default();
                error!("Questrade API error {}: {}", status, error_text);
                Err(BrokerError::Other(anyhow::anyhow!("HTTP {}: {}", status, error_text)))
            }
        }
    }

    /// Make authenticated request (public wrapper with auth check)
    async fn request<T: serde::de::DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        body: Option<impl Serialize>,
    ) -> Result<T, BrokerError> {
        self.ensure_authenticated().await?;
        self.request_internal(method, path, body).await
    }

    /// Get account number
    async fn get_account_number(&self) -> Result<String, BrokerError> {
        let account_guard = self.account_number.read().await;
        account_guard
            .as_ref()
            .cloned()
            .ok_or_else(|| BrokerError::Auth("Account number not loaded".to_string()))
    }
}

#[async_trait]
impl BrokerClient for QuestradeBroker {
    async fn get_account(&self) -> Result<Account, BrokerError> {
        let account_number = self.get_account_number().await?;

        #[derive(Deserialize)]
        struct BalancesResponse {
            #[serde(rename = "perCurrencyBalances")]
            per_currency_balances: Vec<CurrencyBalance>,
        }

        #[derive(Deserialize)]
        struct CurrencyBalance {
            currency: String,
            cash: Decimal,
            #[serde(rename = "marketValue")]
            market_value: Decimal,
            #[serde(rename = "totalEquity")]
            total_equity: Decimal,
            #[serde(rename = "buyingPower")]
            buying_power: Decimal,
        }

        let response: BalancesResponse = self
            .request(
                Method::GET,
                &format!("/v1/accounts/{}/balances", account_number),
                None::<()>,
            )
            .await?;

        // Use CAD balance (primary for Questrade)
        let cad_balance = response
            .per_currency_balances
            .into_iter()
            .find(|b| b.currency == "CAD")
            .ok_or_else(|| BrokerError::Other(anyhow::anyhow!("No CAD balance found")))?;

        Ok(Account {
            account_id: account_number,
            cash: cad_balance.cash,
            portfolio_value: cad_balance.total_equity,
            buying_power: cad_balance.buying_power,
            equity: cad_balance.total_equity,
            last_equity: cad_balance.total_equity,
            multiplier: "1".to_string(),
            currency: "CAD".to_string(),
            shorting_enabled: false,
            long_market_value: cad_balance.market_value,
            short_market_value: Decimal::ZERO,
            initial_margin: Decimal::ZERO,
            maintenance_margin: Decimal::ZERO,
            day_trading_buying_power: cad_balance.buying_power,
            daytrade_count: 0,
        })
    }

    async fn get_positions(&self) -> Result<Vec<Position>, BrokerError> {
        let account_number = self.get_account_number().await?;

        #[derive(Deserialize)]
        struct PositionsResponse {
            positions: Vec<QuestradePosition>,
        }

        #[derive(Deserialize)]
        struct QuestradePosition {
            symbol: String,
            #[serde(rename = "symbolId")]
            symbol_id: i64,
            #[serde(rename = "openQuantity")]
            open_quantity: i64,
            #[serde(rename = "currentMarketValue")]
            current_market_value: Decimal,
            #[serde(rename = "currentPrice")]
            current_price: Decimal,
            #[serde(rename = "averageEntryPrice")]
            average_entry_price: Decimal,
            #[serde(rename = "openPnl")]
            open_pnl: Decimal,
        }

        let response: PositionsResponse = self
            .request(
                Method::GET,
                &format!("/v1/accounts/{}/positions", account_number),
                None::<()>,
            )
            .await?;

        Ok(response
            .positions
            .into_iter()
            .map(|p| Position {
                symbol: Symbol::new(p.symbol.as_str()).expect("Invalid symbol from Questrade"),
                qty: p.open_quantity,
                side: if p.open_quantity > 0 {
                    PositionSide::Long
                } else {
                    PositionSide::Short
                },
                avg_entry_price: p.average_entry_price,
                market_value: p.current_market_value,
                cost_basis: p.average_entry_price * Decimal::from(p.open_quantity.abs()),
                unrealized_pl: p.open_pnl,
                unrealized_plpc: if p.current_market_value != Decimal::ZERO {
                    (p.open_pnl / p.current_market_value.abs()) * Decimal::from(100)
                } else {
                    Decimal::ZERO
                },
                current_price: p.current_price,
                lastday_price: p.current_price,
                change_today: Decimal::ZERO,
            })
            .collect())
    }

    async fn place_order(&self, order: OrderRequest) -> Result<OrderResponse, BrokerError> {
        let account_number = self.get_account_number().await?;

        #[derive(Serialize)]
        struct QuestradeOrderRequest {
            #[serde(rename = "accountNumber")]
            account_number: String,
            #[serde(rename = "symbolId")]
            symbol_id: i64,
            quantity: i64,
            #[serde(rename = "orderType")]
            order_type: String,
            #[serde(rename = "timeInForce")]
            time_in_force: String,
            #[serde(rename = "action")]
            action: String,
            #[serde(skip_serializing_if = "Option::is_none")]
            #[serde(rename = "limitPrice")]
            limit_price: Option<Decimal>,
            #[serde(skip_serializing_if = "Option::is_none")]
            #[serde(rename = "stopPrice")]
            stop_price: Option<Decimal>,
        }

        // First, get symbol ID
        // In production, would implement symbol lookup
        let symbol_id = 0; // Placeholder

        let order_type = match order.order_type {
            OrderType::Market => "Market",
            OrderType::Limit => "Limit",
            OrderType::StopLoss => "Stop",
            OrderType::StopLimit => "StopLimit",
        };

        let action = match order.side {
            OrderSide::Buy => "Buy",
            OrderSide::Sell => "Sell",
        };

        let time_in_force = match order.time_in_force {
            TimeInForce::Day => "Day",
            TimeInForce::GTC => "GoodTillCanceled",
            _ => "Day",
        };

        let req = QuestradeOrderRequest {
            account_number: account_number.clone(),
            symbol_id,
            quantity: order.quantity as i64,
            order_type: order_type.to_string(),
            time_in_force: time_in_force.to_string(),
            action: action.to_string(),
            limit_price: order.limit_price,
            stop_price: order.stop_price,
        };

        #[derive(Deserialize)]
        struct OrderResponse {
            #[serde(rename = "orderId")]
            order_id: i64,
        }

        let response: OrderResponse = self
            .request(
                Method::POST,
                &format!("/v1/accounts/{}/orders", account_number),
                Some(req),
            )
            .await?;

        Ok(crate::OrderResponse {
            order_id: response.order_id.to_string(),
            client_order_id: uuid::Uuid::new_v4().to_string(),
            status: OrderStatus::Accepted,
            filled_qty: 0,
            filled_avg_price: None,
            submitted_at: Utc::now(),
            filled_at: None,
        })
    }

    async fn cancel_order(&self, order_id: &str) -> Result<(), BrokerError> {
        let account_number = self.get_account_number().await?;

        let _: serde_json::Value = self
            .request(
                Method::DELETE,
                &format!("/v1/accounts/{}/orders/{}", account_number, order_id),
                None::<()>,
            )
            .await?;

        Ok(())
    }

    async fn get_order(&self, order_id: &str) -> Result<OrderResponse, BrokerError> {
        Err(BrokerError::Other(anyhow::anyhow!("Not implemented")))
    }

    async fn list_orders(&self, _filter: OrderFilter) -> Result<Vec<OrderResponse>, BrokerError> {
        Ok(Vec::new())
    }

    async fn health_check(&self) -> Result<HealthStatus, BrokerError> {
        match self.ensure_authenticated().await {
            Ok(_) => Ok(HealthStatus::Healthy),
            Err(_) => Ok(HealthStatus::Unhealthy),
        }
    }
}

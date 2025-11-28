// Broker adapter trait and error types
//
// This module defines the abstract broker interface that all
// broker implementations must implement.

use crate::{OrderRequest, OrderResponse, OrderStatus, OrderUpdate};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use nt_core::types::Symbol;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

/// Broker client trait
#[async_trait]
pub trait BrokerClient: Send + Sync {
    /// Get account information
    async fn get_account(&self) -> Result<Account>;

    /// Get current positions
    async fn get_positions(&self) -> Result<Vec<Position>>;

    /// Place an order
    async fn place_order(&self, order: OrderRequest) -> Result<OrderResponse>;

    /// Cancel an order
    async fn cancel_order(&self, order_id: &str) -> Result<()>;

    /// Get order status
    async fn get_order(&self, order_id: &str) -> Result<OrderResponse>;

    /// List all orders with optional filter
    async fn list_orders(&self, filter: OrderFilter) -> Result<Vec<OrderResponse>>;

    /// Health check
    async fn health_check(&self) -> Result<HealthStatus>;
}

/// Account information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub account_id: String,
    pub cash: Decimal,
    pub portfolio_value: Decimal,
    pub buying_power: Decimal,
    pub equity: Decimal,
    pub last_equity: Decimal,
    pub multiplier: String,
    pub currency: String,
    pub shorting_enabled: bool,
    pub long_market_value: Decimal,
    pub short_market_value: Decimal,
    pub initial_margin: Decimal,
    pub maintenance_margin: Decimal,
    pub day_trading_buying_power: Decimal,
    pub daytrade_count: i32,
}

/// Position information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub symbol: Symbol,
    pub qty: i64,
    pub side: PositionSide,
    pub avg_entry_price: Decimal,
    pub market_value: Decimal,
    pub cost_basis: Decimal,
    pub unrealized_pl: Decimal,
    pub unrealized_plpc: Decimal,
    pub current_price: Decimal,
    pub lastday_price: Decimal,
    pub change_today: Decimal,
}

/// Position side
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PositionSide {
    Long,
    Short,
}

/// Order filter for querying orders
#[derive(Debug, Clone, Default)]
pub struct OrderFilter {
    pub status: Option<OrderStatus>,
    pub limit: Option<usize>,
    pub after: Option<DateTime<Utc>>,
    pub until: Option<DateTime<Utc>>,
    pub direction: Option<String>,
    pub nested: Option<bool>,
    pub symbols: Option<Vec<String>>,
}

/// Health status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Unhealthy,
}

/// Broker error types
#[derive(Debug, Error)]
pub enum BrokerError {
    #[error("Insufficient funds")]
    InsufficientFunds,

    #[error("Invalid order: {0}")]
    InvalidOrder(String),

    #[error("Order not found: {0}")]
    OrderNotFound(String),

    #[error("Market closed")]
    MarketClosed,

    #[error("Rate limit exceeded")]
    RateLimit,

    #[error("Authentication failed: {0}")]
    Auth(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Parse error: {0}")]
    Parse(String),

    #[error("Broker unavailable: {0}")]
    Unavailable(String),

    #[error("Order error: {0}")]
    Order(String),

    #[error("Operation timeout")]
    Timeout,

    #[error("Circuit breaker open")]
    CircuitBreakerOpen,

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

impl From<reqwest::Error> for BrokerError {
    fn from(err: reqwest::Error) -> Self {
        BrokerError::Network(err.to_string())
    }
}

impl From<serde_json::Error> for BrokerError {
    fn from(err: serde_json::Error) -> Self {
        BrokerError::Parse(err.to_string())
    }
}

/// Execution error type (alias to BrokerError for compatibility)
pub type ExecutionError = BrokerError;

/// Result type for execution operations
pub type Result<T> = std::result::Result<T, BrokerError>;

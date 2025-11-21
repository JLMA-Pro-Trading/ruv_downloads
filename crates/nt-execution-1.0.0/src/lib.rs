// Neural Trader Execution Engine
//
// This crate provides broker integrations and order execution
// for 11+ brokers and market data providers

// Broker implementations
pub mod alpaca_broker;
pub mod ibkr_broker;
pub mod polygon_broker;
pub mod ccxt_broker;
pub mod questrade_broker;
pub mod oanda_broker;
pub mod lime_broker;

// Market data providers
pub mod alpha_vantage;
pub mod news_api;
pub mod yahoo_finance;
pub mod odds_api;

// Core execution modules
pub mod broker;
pub mod fill_reconciliation;
pub mod order_manager;
pub mod router;

// Re-exports
pub use broker::{
    Account, BrokerClient, BrokerError, ExecutionError, HealthStatus, OrderFilter,
    Position, PositionSide, Result,
};

pub use alpaca_broker::AlpacaBroker;
pub use ibkr_broker::{IBKRBroker, IBKRConfig};
pub use polygon_broker::{PolygonClient, PolygonConfig};
pub use ccxt_broker::{CCXTBroker, CCXTConfig};
pub use questrade_broker::{QuestradeBroker, QuestradeConfig};
pub use oanda_broker::{OANDABroker, OANDAConfig};
pub use lime_broker::{LimeBroker, LimeBrokerConfig};

pub use alpha_vantage::{AlphaVantageClient, AlphaVantageConfig};
pub use news_api::{NewsAPIClient, NewsAPIConfig};
pub use yahoo_finance::{YahooFinanceClient, YahooFinanceConfig};
pub use odds_api::{OddsAPIClient, OddsAPIConfig};

pub use order_manager::{OrderManager, OrderRequest, OrderResponse, OrderStatus, OrderUpdate};
pub use router::OrderRouter;

// Workspace types - re-export for convenience
pub use nt_core::types::{OrderType, Side as OrderSide, Symbol, TimeInForce};

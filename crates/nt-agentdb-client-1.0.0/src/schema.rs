// AgentDB Schema Definitions
//
// Matches the schemas defined in 05_Memory_and_AgentDB.md

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Serialize, Deserialize};
use uuid::Uuid;

/// Market observation with deterministic embedding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Observation {
    pub id: Uuid,
    pub timestamp_us: i64,
    pub symbol: String,
    pub price: Decimal,
    pub volume: Decimal,
    pub spread: Decimal,
    pub book_depth: BookDepth,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub embedding: Vec<f32>,

    #[serde(default)]
    pub metadata: serde_json::Value,

    pub provenance: Provenance,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BookDepth {
    pub bids: Vec<(Decimal, Decimal)>,
    pub asks: Vec<(Decimal, Decimal)>,
}

impl Observation {
    pub fn new(symbol: String, price: Decimal, volume: Decimal) -> Self {
        let id = Uuid::new_v4();
        let timestamp_us = Utc::now().timestamp_micros();

        Self {
            id,
            timestamp_us,
            symbol,
            price,
            volume,
            spread: Decimal::ZERO,
            book_depth: BookDepth::default(),
            embedding: Vec::new(),
            metadata: serde_json::json!({}),
            provenance: Provenance::new("market_data_collector"),
        }
    }

    pub fn with_embedding(mut self, embedding: Vec<f32>) -> Self {
        self.embedding = embedding;
        self
    }
}

/// Trading signal with causal links
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signal {
    pub id: Uuid,
    pub strategy_id: String,
    pub timestamp_us: i64,
    pub symbol: String,
    pub direction: Direction,
    pub confidence: f64,
    pub features: Vec<f64>,
    pub reasoning: String,
    pub causal_links: Vec<Uuid>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub embedding: Vec<f32>,

    pub provenance: Provenance,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum Direction {
    Long,
    Short,
    Neutral,
    Close,
}

impl Signal {
    pub fn new(strategy_id: String, symbol: String, direction: Direction, confidence: f64) -> Self {
        Self {
            id: Uuid::new_v4(),
            strategy_id,
            timestamp_us: Utc::now().timestamp_micros(),
            symbol,
            direction,
            confidence,
            features: Vec::new(),
            reasoning: String::new(),
            causal_links: Vec::new(),
            embedding: Vec::new(),
            provenance: Provenance::new("strategy_engine"),
        }
    }

    pub fn with_embedding(mut self, embedding: Vec<f32>) -> Self {
        self.embedding = embedding;
        self
    }
}

/// Order lifecycle tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub signal_id: Uuid,
    pub symbol: String,
    pub side: OrderSide,
    pub quantity: u32,
    pub order_type: OrderType,
    pub limit_price: Option<Decimal>,
    pub stop_price: Option<Decimal>,
    pub status: OrderStatus,
    pub timestamps: OrderTimestamps,
    pub fills: Vec<Fill>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub embedding: Vec<f32>,

    pub provenance: Provenance,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OrderSide {
    Buy,
    Sell,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OrderType {
    Market,
    Limit,
    StopLoss,
    StopLimit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum OrderStatus {
    Pending,
    Submitted,
    PartiallyFilled,
    Filled,
    Cancelled,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OrderTimestamps {
    pub created_us: i64,
    pub submitted_us: Option<i64>,
    pub first_fill_us: Option<i64>,
    pub completed_us: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Fill {
    pub timestamp_us: i64,
    pub quantity: u32,
    pub price: Decimal,
    pub fee: Decimal,
}

impl Order {
    pub fn new(signal_id: Uuid, symbol: String, side: OrderSide, quantity: u32) -> Self {
        Self {
            id: Uuid::new_v4(),
            signal_id,
            symbol,
            side,
            quantity,
            order_type: OrderType::Market,
            limit_price: None,
            stop_price: None,
            status: OrderStatus::Pending,
            timestamps: OrderTimestamps {
                created_us: Utc::now().timestamp_micros(),
                ..Default::default()
            },
            fills: Vec::new(),
            embedding: Vec::new(),
            provenance: Provenance::new("order_manager"),
        }
    }

    pub fn with_embedding(mut self, embedding: Vec<f32>) -> Self {
        self.embedding = embedding;
        self
    }
}

/// ReasoningBank reflexion trace
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReflexionTrace {
    pub id: Uuid,
    pub decision_id: Uuid,
    pub decision_type: DecisionType,
    pub trajectory: Vec<StateAction>,
    pub verdict: Verdict,
    pub learned_patterns: Vec<Pattern>,
    pub counterfactuals: Vec<Counterfactual>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub embedding: Vec<f32>,

    pub provenance: Provenance,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum DecisionType {
    Signal,
    Order,
    StrategySwitch,
    RiskLimit,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateAction {
    pub timestamp_us: i64,
    pub state: PortfolioState,
    pub action: TradingAction,
    pub reward: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortfolioState {
    pub cash: Decimal,
    pub unrealized_pnl: Decimal,
    pub market_features: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradingAction {
    pub action_type: ActionType,
    pub symbol: String,
    pub quantity: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ActionType {
    Buy,
    Sell,
    Hold,
    ClosePosition,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Verdict {
    pub score: f64,
    pub roi: f64,
    pub sharpe: f64,
    pub max_drawdown: f64,
    pub explanation: String,
    pub successes: Vec<String>,
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pattern {
    pub pattern_type: PatternType,
    pub description: String,
    pub confidence: f64,
    pub occurrences: usize,
    pub embedding: Vec<f32>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum PatternType {
    EntryTiming,
    ExitTiming,
    RiskManagement,
    MarketRegime,
    Correlation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Counterfactual {
    pub description: String,
    pub alternative_action: TradingAction,
    pub estimated_outcome: f64,
    pub probability: f64,
}

/// Data provenance tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Provenance {
    pub creator: String,
    pub created_us: i64,
    pub parent_id: Option<Uuid>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub signature: Vec<u8>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub public_key: Vec<u8>,

    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub hash: Vec<u8>,
}

impl Provenance {
    pub fn new(creator: &str) -> Self {
        Self {
            creator: creator.to_string(),
            created_us: Utc::now().timestamp_micros(),
            parent_id: None,
            signature: Vec::new(),
            public_key: Vec::new(),
            hash: Vec::new(),
        }
    }

    pub fn with_parent(mut self, parent_id: Uuid) -> Self {
        self.parent_id = Some(parent_id);
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn test_observation_creation() {
        let obs = Observation::new("AAPL".to_string(), dec!(150.00), dec!(1000));

        assert_eq!(obs.symbol, "AAPL");
        assert_eq!(obs.price, dec!(150.00));
        assert_eq!(obs.volume, dec!(1000));
    }

    #[test]
    fn test_signal_creation() {
        let signal = Signal::new(
            "momentum_v1".to_string(),
            "AAPL".to_string(),
            Direction::Long,
            0.85,
        );

        assert_eq!(signal.strategy_id, "momentum_v1");
        assert_eq!(signal.direction, Direction::Long);
        assert_eq!(signal.confidence, 0.85);
    }

    #[test]
    fn test_order_creation() {
        let signal_id = Uuid::new_v4();
        let order = Order::new(signal_id, "AAPL".to_string(), OrderSide::Buy, 100);

        assert_eq!(order.signal_id, signal_id);
        assert_eq!(order.quantity, 100);
        assert_eq!(order.status, OrderStatus::Pending);
    }

    #[test]
    fn test_provenance_with_parent() {
        let parent_id = Uuid::new_v4();
        let provenance = Provenance::new("test_creator").with_parent(parent_id);

        assert_eq!(provenance.creator, "test_creator");
        assert_eq!(provenance.parent_id, Some(parent_id));
    }
}

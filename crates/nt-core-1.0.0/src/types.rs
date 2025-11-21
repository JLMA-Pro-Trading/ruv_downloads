//! Core types for the Neural Trading system
//!
//! This module provides strongly-typed wrappers around primitive types to ensure type safety
//! and prevent common mistakes like confusing symbols with strings or mixing up prices.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::fmt;
use uuid::Uuid;

// ============================================================================
// Symbol Type
// ============================================================================

/// Represents a trading symbol (e.g., "AAPL", "GOOGL")
///
/// # Examples
///
/// ```
/// use nt_core::types::Symbol;
///
/// let symbol = Symbol::new("AAPL").unwrap();
/// assert_eq!(symbol.as_str(), "AAPL");
/// ```
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Symbol(String);

impl Symbol {
    /// Create a new Symbol, validating that it's not empty and uppercase
    ///
    /// # Errors
    ///
    /// Returns error if symbol is empty or contains invalid characters
    pub fn new(s: impl Into<String>) -> Result<Self, String> {
        let s = s.into();
        if s.is_empty() {
            return Err("Symbol cannot be empty".to_string());
        }
        if !s.chars().all(|c| c.is_ascii_alphanumeric()) {
            return Err("Symbol must contain only alphanumeric characters".to_string());
        }
        Ok(Self(s.to_uppercase()))
    }

    /// Get the symbol as a string slice
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for Symbol {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

// ============================================================================
// Price and Volume Types
// ============================================================================

/// Type alias for prices using Decimal for precision
pub type Price = Decimal;

/// Type alias for volume using Decimal for fractional shares
pub type Volume = Decimal;

/// Type alias for timestamps
pub type Timestamp = DateTime<Utc>;

// ============================================================================
// Trading Direction
// ============================================================================

/// Trading direction for positions and signals
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    /// Open or increase a long position
    Long,
    /// Open or increase a short position
    Short,
    /// Close existing position or remain neutral
    Neutral,
}

impl fmt::Display for Direction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Direction::Long => write!(f, "long"),
            Direction::Short => write!(f, "short"),
            Direction::Neutral => write!(f, "neutral"),
        }
    }
}

// ============================================================================
// Order Side
// ============================================================================

/// Order side (buy or sell)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Side {
    /// Buy order
    Buy,
    /// Sell order
    Sell,
}

impl fmt::Display for Side {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Side::Buy => write!(f, "buy"),
            Side::Sell => write!(f, "sell"),
        }
    }
}

impl From<Direction> for Side {
    fn from(direction: Direction) -> Self {
        match direction {
            Direction::Long => Side::Buy,
            Direction::Short | Direction::Neutral => Side::Sell,
        }
    }
}

// ============================================================================
// Order Type
// ============================================================================

/// Type of order to place
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderType {
    /// Market order (execute immediately at current price)
    Market,
    /// Limit order (execute only at specified price or better)
    Limit,
    /// Stop-loss order (trigger sell when price falls below threshold)
    StopLoss,
    /// Stop-limit order (combination of stop and limit)
    StopLimit,
}

impl fmt::Display for OrderType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderType::Market => write!(f, "market"),
            OrderType::Limit => write!(f, "limit"),
            OrderType::StopLoss => write!(f, "stop_loss"),
            OrderType::StopLimit => write!(f, "stop_limit"),
        }
    }
}

// ============================================================================
// Time in Force
// ============================================================================

/// How long an order remains active
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TimeInForce {
    /// Day order (cancelled at market close)
    Day,
    /// Good till cancelled
    GTC,
    /// Immediate or cancel
    IOC,
    /// Fill or kill (must fill entire order immediately)
    FOK,
}

impl fmt::Display for TimeInForce {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            TimeInForce::Day => write!(f, "day"),
            TimeInForce::GTC => write!(f, "gtc"),
            TimeInForce::IOC => write!(f, "ioc"),
            TimeInForce::FOK => write!(f, "fok"),
        }
    }
}

// ============================================================================
// Order Status
// ============================================================================

/// Current status of an order
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OrderStatus {
    /// Order has been received but not yet accepted
    Pending,
    /// Order has been accepted but not filled
    Accepted,
    /// Order is currently being filled
    PartiallyFilled,
    /// Order has been completely filled
    Filled,
    /// Order has been cancelled
    Cancelled,
    /// Order has been rejected
    Rejected,
    /// Order has expired
    Expired,
}

impl fmt::Display for OrderStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            OrderStatus::Pending => write!(f, "pending"),
            OrderStatus::Accepted => write!(f, "accepted"),
            OrderStatus::PartiallyFilled => write!(f, "partially_filled"),
            OrderStatus::Filled => write!(f, "filled"),
            OrderStatus::Cancelled => write!(f, "cancelled"),
            OrderStatus::Rejected => write!(f, "rejected"),
            OrderStatus::Expired => write!(f, "expired"),
        }
    }
}

// ============================================================================
// Market Data Types
// ============================================================================

/// Real-time market tick data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketTick {
    /// Trading symbol
    pub symbol: Symbol,
    /// Timestamp of the tick
    pub timestamp: Timestamp,
    /// Trade price
    pub price: Price,
    /// Trade volume
    pub volume: Volume,
    /// Bid price (optional, may not be available in all feeds)
    pub bid: Option<Price>,
    /// Ask price (optional, may not be available in all feeds)
    pub ask: Option<Price>,
}

impl MarketTick {
    /// Calculate the bid-ask spread if both are available
    pub fn spread(&self) -> Option<Price> {
        match (self.bid, self.ask) {
            (Some(bid), Some(ask)) => Some(ask - bid),
            _ => None,
        }
    }

    /// Calculate the mid-price if both bid and ask are available
    pub fn mid_price(&self) -> Option<Price> {
        match (self.bid, self.ask) {
            (Some(bid), Some(ask)) => Some((bid + ask) / Decimal::from(2)),
            _ => None,
        }
    }
}

/// OHLCV (Open, High, Low, Close, Volume) bar data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bar {
    /// Trading symbol
    pub symbol: Symbol,
    /// Bar start timestamp
    pub timestamp: Timestamp,
    /// Opening price
    pub open: Price,
    /// Highest price during the period
    pub high: Price,
    /// Lowest price during the period
    pub low: Price,
    /// Closing price
    pub close: Price,
    /// Total volume traded
    pub volume: Volume,
}

impl Bar {
    /// Calculate the typical price (high + low + close) / 3
    pub fn typical_price(&self) -> Price {
        (self.high + self.low + self.close) / Decimal::from(3)
    }

    /// Calculate the price range (high - low)
    pub fn range(&self) -> Price {
        self.high - self.low
    }

    /// Check if the bar is bullish (close > open)
    pub fn is_bullish(&self) -> bool {
        self.close > self.open
    }

    /// Check if the bar is bearish (close < open)
    pub fn is_bearish(&self) -> bool {
        self.close < self.open
    }
}

/// Order book snapshot with multiple price levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderBook {
    /// Trading symbol
    pub symbol: Symbol,
    /// Snapshot timestamp
    pub timestamp: Timestamp,
    /// Bid price levels (price, volume)
    pub bids: Vec<(Price, Volume)>,
    /// Ask price levels (price, volume)
    pub asks: Vec<(Price, Volume)>,
}

impl OrderBook {
    /// Get the best bid (highest buy price)
    pub fn best_bid(&self) -> Option<Price> {
        self.bids.first().map(|(price, _)| *price)
    }

    /// Get the best ask (lowest sell price)
    pub fn best_ask(&self) -> Option<Price> {
        self.asks.first().map(|(price, _)| *price)
    }

    /// Calculate the bid-ask spread
    pub fn spread(&self) -> Option<Price> {
        match (self.best_bid(), self.best_ask()) {
            (Some(bid), Some(ask)) => Some(ask - bid),
            _ => None,
        }
    }

    /// Calculate the mid-price
    pub fn mid_price(&self) -> Option<Price> {
        match (self.best_bid(), self.best_ask()) {
            (Some(bid), Some(ask)) => Some((bid + ask) / Decimal::from(2)),
            _ => None,
        }
    }
}

// ============================================================================
// Trading Signal
// ============================================================================

/// Trading signal generated by a strategy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signal {
    /// Unique signal ID
    pub id: Uuid,
    /// Strategy that generated the signal
    pub strategy_id: String,
    /// Trading symbol
    pub symbol: Symbol,
    /// Trading direction
    pub direction: Direction,
    /// Confidence level (0.0 to 1.0)
    pub confidence: f64,
    /// Optional target entry price
    pub entry_price: Option<Price>,
    /// Optional stop-loss price
    pub stop_loss: Option<Price>,
    /// Optional take-profit price
    pub take_profit: Option<Price>,
    /// Optional quantity
    pub quantity: Option<Volume>,
    /// Human-readable reasoning for the signal
    pub reasoning: String,
    /// Signal generation timestamp
    pub timestamp: Timestamp,
}

impl Signal {
    /// Create a new signal with default values
    pub fn new(
        strategy_id: impl Into<String>,
        symbol: Symbol,
        direction: Direction,
        confidence: f64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            strategy_id: strategy_id.into(),
            symbol,
            direction,
            confidence: confidence.clamp(0.0, 1.0),
            entry_price: None,
            stop_loss: None,
            take_profit: None,
            quantity: None,
            reasoning: String::new(),
            timestamp: Utc::now(),
        }
    }

    /// Builder method to set entry price
    pub fn with_entry_price(mut self, price: Price) -> Self {
        self.entry_price = Some(price);
        self
    }

    /// Builder method to set stop loss
    pub fn with_stop_loss(mut self, price: Price) -> Self {
        self.stop_loss = Some(price);
        self
    }

    /// Builder method to set take profit
    pub fn with_take_profit(mut self, price: Price) -> Self {
        self.take_profit = Some(price);
        self
    }

    /// Builder method to set quantity
    pub fn with_quantity(mut self, quantity: Volume) -> Self {
        self.quantity = Some(quantity);
        self
    }

    /// Builder method to set reasoning
    pub fn with_reasoning(mut self, reasoning: impl Into<String>) -> Self {
        self.reasoning = reasoning.into();
        self
    }
}

// ============================================================================
// Order
// ============================================================================

/// Order request to be sent to broker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Order {
    /// Unique order ID (assigned by client)
    pub id: Uuid,
    /// Trading symbol
    pub symbol: Symbol,
    /// Order side (buy/sell)
    pub side: Side,
    /// Order type
    pub order_type: OrderType,
    /// Quantity to trade
    pub quantity: Volume,
    /// Limit price (for limit orders)
    pub limit_price: Option<Price>,
    /// Stop price (for stop orders)
    pub stop_price: Option<Price>,
    /// Time in force
    pub time_in_force: TimeInForce,
    /// Order creation timestamp
    pub created_at: Timestamp,
}

impl Order {
    /// Create a new market order
    pub fn market(symbol: Symbol, side: Side, quantity: Volume) -> Self {
        Self {
            id: Uuid::new_v4(),
            symbol,
            side,
            order_type: OrderType::Market,
            quantity,
            limit_price: None,
            stop_price: None,
            time_in_force: TimeInForce::Day,
            created_at: Utc::now(),
        }
    }

    /// Create a new limit order
    pub fn limit(symbol: Symbol, side: Side, quantity: Volume, limit_price: Price) -> Self {
        Self {
            id: Uuid::new_v4(),
            symbol,
            side,
            order_type: OrderType::Limit,
            quantity,
            limit_price: Some(limit_price),
            stop_price: None,
            time_in_force: TimeInForce::Day,
            created_at: Utc::now(),
        }
    }

    /// Create a new stop-loss order
    pub fn stop_loss(symbol: Symbol, side: Side, quantity: Volume, stop_price: Price) -> Self {
        Self {
            id: Uuid::new_v4(),
            symbol,
            side,
            order_type: OrderType::StopLoss,
            quantity,
            limit_price: None,
            stop_price: Some(stop_price),
            time_in_force: TimeInForce::Day,
            created_at: Utc::now(),
        }
    }
}

// ============================================================================
// Position
// ============================================================================

/// Current position in a symbol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    /// Trading symbol
    pub symbol: Symbol,
    /// Quantity held (positive for long, negative for short)
    pub quantity: Volume,
    /// Average entry price
    pub avg_entry_price: Price,
    /// Current market price
    pub current_price: Price,
    /// Unrealized P&L
    pub unrealized_pnl: Price,
    /// Side of the position
    pub side: Side,
}

impl Position {
    /// Calculate the market value of the position
    pub fn market_value(&self) -> Price {
        self.quantity * self.current_price
    }

    /// Calculate the cost basis of the position
    pub fn cost_basis(&self) -> Price {
        self.quantity * self.avg_entry_price
    }

    /// Update the current price and recalculate P&L
    pub fn update_price(&mut self, new_price: Price) {
        self.current_price = new_price;
        self.unrealized_pnl = (new_price - self.avg_entry_price) * self.quantity;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_symbol_creation() {
        let symbol = Symbol::new("AAPL").unwrap();
        assert_eq!(symbol.as_str(), "AAPL");

        let symbol = Symbol::new("aapl").unwrap();
        assert_eq!(symbol.as_str(), "AAPL"); // Should be uppercase

        assert!(Symbol::new("").is_err());
        assert!(Symbol::new("AAP-L").is_err());
    }

    #[test]
    fn test_direction_display() {
        assert_eq!(Direction::Long.to_string(), "long");
        assert_eq!(Direction::Short.to_string(), "short");
        assert_eq!(Direction::Neutral.to_string(), "neutral");
    }

    #[test]
    fn test_side_from_direction() {
        assert_eq!(Side::from(Direction::Long), Side::Buy);
        assert_eq!(Side::from(Direction::Short), Side::Sell);
        assert_eq!(Side::from(Direction::Neutral), Side::Sell);
    }

    #[test]
    fn test_market_tick_spread() {
        let symbol = Symbol::new("AAPL").unwrap();
        let tick = MarketTick {
            symbol: symbol.clone(),
            timestamp: Utc::now(),
            price: Decimal::from(100),
            volume: Decimal::from(1000),
            bid: Some(Decimal::new(9995, 2)),
            ask: Some(Decimal::new(10005, 2)),
        };

        let spread = tick.spread().unwrap();
        assert_eq!(spread, Decimal::new(10, 2));

        let mid = tick.mid_price().unwrap();
        assert_eq!(mid, Decimal::from(100));
    }

    #[test]
    fn test_bar_calculations() {
        let symbol = Symbol::new("AAPL").unwrap();
        let bar = Bar {
            symbol: symbol.clone(),
            timestamp: Utc::now(),
            open: Decimal::from(100),
            high: Decimal::from(105),
            low: Decimal::from(95),
            close: Decimal::from(103),
            volume: Decimal::from(10000),
        };

        assert!(bar.is_bullish());
        assert!(!bar.is_bearish());
        assert_eq!(bar.range(), Decimal::from(10));
    }

    #[test]
    fn test_signal_builder() {
        let symbol = Symbol::new("AAPL").unwrap();
        let signal = Signal::new("momentum", symbol.clone(), Direction::Long, 0.85)
            .with_entry_price(Decimal::from(100))
            .with_stop_loss(Decimal::from(95))
            .with_take_profit(Decimal::from(110))
            .with_reasoning("Strong momentum detected");

        assert_eq!(signal.confidence, 0.85);
        assert_eq!(signal.entry_price, Some(Decimal::from(100)));
        assert_eq!(signal.stop_loss, Some(Decimal::from(95)));
        assert_eq!(signal.take_profit, Some(Decimal::from(110)));
    }

    #[test]
    fn test_order_creation() {
        let symbol = Symbol::new("AAPL").unwrap();

        let market_order = Order::market(symbol.clone(), Side::Buy, Decimal::from(100));
        assert_eq!(market_order.order_type, OrderType::Market);
        assert_eq!(market_order.quantity, Decimal::from(100));

        let limit_order = Order::limit(
            symbol.clone(),
            Side::Sell,
            Decimal::from(50),
            Decimal::from(105),
        );
        assert_eq!(limit_order.order_type, OrderType::Limit);
        assert_eq!(limit_order.limit_price, Some(Decimal::from(105)));
    }

    #[test]
    fn test_position_calculations() {
        let symbol = Symbol::new("AAPL").unwrap();
        let mut position = Position {
            symbol: symbol.clone(),
            quantity: Decimal::from(100),
            avg_entry_price: Decimal::from(100),
            current_price: Decimal::from(105),
            unrealized_pnl: Decimal::from(500),
            side: Side::Buy,
        };

        assert_eq!(position.market_value(), Decimal::from(10500));
        assert_eq!(position.cost_basis(), Decimal::from(10000));

        position.update_price(Decimal::from(110));
        assert_eq!(position.unrealized_pnl, Decimal::from(1000));
    }

    #[test]
    fn test_order_book() {
        let symbol = Symbol::new("AAPL").unwrap();
        let order_book = OrderBook {
            symbol: symbol.clone(),
            timestamp: Utc::now(),
            bids: vec![
                (Decimal::new(9995, 2), Decimal::from(100)),
                (Decimal::new(9990, 2), Decimal::from(200)),
            ],
            asks: vec![
                (Decimal::new(10005, 2), Decimal::from(150)),
                (Decimal::new(10010, 2), Decimal::from(250)),
            ],
        };

        assert_eq!(order_book.best_bid(), Some(Decimal::new(9995, 2)));
        assert_eq!(order_book.best_ask(), Some(Decimal::new(10005, 2)));
        assert_eq!(order_book.spread(), Some(Decimal::new(10, 2)));
        assert_eq!(order_book.mid_price(), Some(Decimal::from(100)));
    }
}

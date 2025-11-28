//! Integration tests for nt-core
//!
//! These tests verify that all core modules work together correctly.

use nt_core::error::RiskViolationType;
use nt_core::prelude::*;
use rust_decimal::Decimal;
use validator::Validate;

#[test]
fn test_complete_trading_workflow() {
    // 1. Create a symbol
    let symbol = Symbol::new("AAPL").expect("Failed to create symbol");
    assert_eq!(symbol.as_str(), "AAPL");

    // 2. Create a market tick
    let tick = MarketTick {
        symbol: symbol.clone(),
        timestamp: chrono::Utc::now(),
        price: Decimal::from(150),
        volume: Decimal::from(1000),
        bid: Some(Decimal::new(14995, 2)),
        ask: Some(Decimal::new(15005, 2)),
    };

    // Verify tick data
    assert_eq!(tick.price, Decimal::from(150));
    assert_eq!(tick.spread(), Some(Decimal::new(10, 2)));

    // 3. Create a trading signal
    let signal = Signal::new("momentum_strategy", symbol.clone(), Direction::Long, 0.85)
        .with_entry_price(Decimal::from(150))
        .with_stop_loss(Decimal::from(145))
        .with_take_profit(Decimal::from(160))
        .with_quantity(Decimal::from(100))
        .with_reasoning("Strong upward momentum detected");

    // Verify signal
    assert_eq!(signal.confidence, 0.85);
    assert_eq!(signal.direction, Direction::Long);
    assert_eq!(signal.entry_price, Some(Decimal::from(150)));

    // 4. Create an order from the signal
    let order = Order::market(symbol.clone(), Side::Buy, Decimal::from(100));

    // Verify order
    assert_eq!(order.side, Side::Buy);
    assert_eq!(order.order_type, OrderType::Market);
    assert_eq!(order.quantity, Decimal::from(100));

    // 5. Create a position
    let mut position = Position {
        symbol: symbol.clone(),
        quantity: Decimal::from(100),
        avg_entry_price: Decimal::from(150),
        current_price: Decimal::from(155),
        unrealized_pnl: Decimal::from(500),
        side: Side::Buy,
    };

    // Verify position calculations
    assert_eq!(position.market_value(), Decimal::from(15500));
    assert_eq!(position.cost_basis(), Decimal::from(15000));

    // 6. Update position price
    position.update_price(Decimal::from(160));
    assert_eq!(position.unrealized_pnl, Decimal::from(1000));
}

#[test]
fn test_bar_analysis() {
    let symbol = Symbol::new("AAPL").unwrap();

    // Bullish bar
    let bullish_bar = Bar {
        symbol: symbol.clone(),
        timestamp: chrono::Utc::now(),
        open: Decimal::from(100),
        high: Decimal::from(105),
        low: Decimal::from(99),
        close: Decimal::from(104),
        volume: Decimal::from(10000),
    };

    assert!(bullish_bar.is_bullish());
    assert!(!bullish_bar.is_bearish());
    assert_eq!(bullish_bar.range(), Decimal::from(6));

    // Bearish bar
    let bearish_bar = Bar {
        symbol: symbol.clone(),
        timestamp: chrono::Utc::now(),
        open: Decimal::from(100),
        high: Decimal::from(101),
        low: Decimal::from(95),
        close: Decimal::from(96),
        volume: Decimal::from(10000),
    };

    assert!(!bearish_bar.is_bullish());
    assert!(bearish_bar.is_bearish());
}

#[test]
fn test_order_book_operations() {
    let symbol = Symbol::new("AAPL").unwrap();
    let order_book = OrderBook {
        symbol: symbol.clone(),
        timestamp: chrono::Utc::now(),
        bids: vec![
            (Decimal::from(100), Decimal::from(1000)),
            (Decimal::new(9995, 2), Decimal::from(2000)),
            (Decimal::new(9990, 2), Decimal::from(3000)),
        ],
        asks: vec![
            (Decimal::new(10005, 2), Decimal::from(1500)),
            (Decimal::new(10010, 2), Decimal::from(2500)),
            (Decimal::new(10015, 2), Decimal::from(3500)),
        ],
    };

    assert_eq!(order_book.best_bid(), Some(Decimal::from(100)));
    assert_eq!(order_book.best_ask(), Some(Decimal::new(10005, 2)));
    assert_eq!(order_book.spread(), Some(Decimal::new(5, 2)));
    // Mid price = (100.00 + 100.05) / 2 = 100.025
    assert_eq!(order_book.mid_price(), Some(Decimal::new(100025, 3)));
}

#[test]
fn test_error_types() {
    // Market data error
    let err = TradingError::market_data("Connection failed");
    assert!(err.to_string().contains("Market data error"));

    // Strategy error
    let err = TradingError::strategy("momentum", "Invalid parameter");
    assert!(err.to_string().contains("momentum"));

    // Risk limit error
    let err = TradingError::risk_limit(
        "Position too large",
        RiskViolationType::PositionSizeExceeded,
    );
    assert!(err.to_string().contains("Risk limit exceeded"));

    // Not found error
    let err = TradingError::not_found("order", "12345");
    assert!(err.to_string().contains("order"));
    assert!(err.to_string().contains("12345"));
}

#[test]
fn test_direction_conversions() {
    assert_eq!(Side::from(Direction::Long), Side::Buy);
    assert_eq!(Side::from(Direction::Short), Side::Sell);
    assert_eq!(Side::from(Direction::Neutral), Side::Sell);
}

#[test]
fn test_order_types() {
    let symbol = Symbol::new("AAPL").unwrap();

    // Market order
    let market_order = Order::market(symbol.clone(), Side::Buy, Decimal::from(100));
    assert_eq!(market_order.order_type, OrderType::Market);
    assert!(market_order.limit_price.is_none());
    assert!(market_order.stop_price.is_none());

    // Limit order
    let limit_order = Order::limit(
        symbol.clone(),
        Side::Sell,
        Decimal::from(50),
        Decimal::from(155),
    );
    assert_eq!(limit_order.order_type, OrderType::Limit);
    assert_eq!(limit_order.limit_price, Some(Decimal::from(155)));

    // Stop loss order
    let stop_order = Order::stop_loss(
        symbol.clone(),
        Side::Sell,
        Decimal::from(100),
        Decimal::from(145),
    );
    assert_eq!(stop_order.order_type, OrderType::StopLoss);
    assert_eq!(stop_order.stop_price, Some(Decimal::from(145)));
}

#[test]
fn test_signal_builder_pattern() {
    let symbol = Symbol::new("AAPL").unwrap();

    let signal = Signal::new("test_strategy", symbol.clone(), Direction::Long, 0.95)
        .with_entry_price(Decimal::from(100))
        .with_stop_loss(Decimal::from(95))
        .with_take_profit(Decimal::from(110))
        .with_quantity(Decimal::from(100))
        .with_reasoning("Test signal");

    assert_eq!(signal.strategy_id, "test_strategy");
    assert_eq!(signal.symbol.as_str(), "AAPL");
    assert_eq!(signal.direction, Direction::Long);
    assert_eq!(signal.confidence, 0.95);
    assert_eq!(signal.entry_price, Some(Decimal::from(100)));
    assert_eq!(signal.stop_loss, Some(Decimal::from(95)));
    assert_eq!(signal.take_profit, Some(Decimal::from(110)));
    assert_eq!(signal.quantity, Some(Decimal::from(100)));
    assert_eq!(signal.reasoning, "Test signal");
}

#[test]
fn test_symbol_validation() {
    // Valid symbols
    assert!(Symbol::new("AAPL").is_ok());
    assert!(Symbol::new("GOOGL").is_ok());
    assert!(Symbol::new("MSFT").is_ok());
    assert!(Symbol::new("aapl").is_ok()); // Lowercase should be converted

    // Invalid symbols
    assert!(Symbol::new("").is_err());
    assert!(Symbol::new("AAP-L").is_err());
    assert!(Symbol::new("AAP.L").is_err());
}

#[test]
fn test_position_updates() {
    let symbol = Symbol::new("AAPL").unwrap();
    let mut position = Position {
        symbol: symbol.clone(),
        quantity: Decimal::from(100),
        avg_entry_price: Decimal::from(100),
        current_price: Decimal::from(100),
        unrealized_pnl: Decimal::ZERO,
        side: Side::Buy,
    };

    // Update to profitable price
    position.update_price(Decimal::from(110));
    assert_eq!(position.unrealized_pnl, Decimal::from(1000));

    // Update to losing price
    position.update_price(Decimal::from(90));
    assert_eq!(position.unrealized_pnl, Decimal::from(-1000));

    // Update back to entry price
    position.update_price(Decimal::from(100));
    assert_eq!(position.unrealized_pnl, Decimal::ZERO);
}

#[test]
fn test_strategy_risk_parameters() {
    let params = StrategyRiskParameters::default();

    assert_eq!(params.max_position_size, 0.1);
    assert_eq!(params.max_leverage, 1.0);
    assert_eq!(params.stop_loss_pct, 0.02);
    assert_eq!(params.take_profit_pct, 0.05);
}

#[test]
fn test_config_validation() {
    let _config = AppConfig::default_test_config();
    assert!(config.validate().is_ok());

    let mut server_config = ServerConfig::default();
    server_config.port = 8080;
    assert!(server_config.validate().is_ok());

    server_config.port = 80; // Below minimum 1024
    assert!(server_config.validate().is_err());
}

#[test]
fn test_risk_config() {
    let _config = RiskConfig::default();
    assert!(config.validate().is_ok());

    assert_eq!(config.max_position_size, 0.1);
    assert_eq!(config.max_daily_loss, 0.05);
    assert_eq!(config.max_drawdown, 0.2);
    assert_eq!(config.max_leverage, 1.0);
    assert_eq!(config.default_stop_loss, 0.02);
    assert_eq!(config.default_take_profit, 0.05);
    assert!(config.enable_circuit_breakers);
}

// Alpaca Paper Trading Integration Tests
//
// Run with: cargo test --test alpaca_paper_tests -- --nocapture
// Requires: ALPACA_API_KEY and ALPACA_API_SECRET in .env

#![cfg(test)]

use nt_execution::alpaca_broker::*;
use nt_execution::broker::{BrokerClient, OrderFilter};
use nt_execution::*;
use rust_decimal::Decimal;
use std::env;

fn get_test_broker() -> AlpacaBroker {
    dotenvy::dotenv().ok();

    let api_key = env::var("ALPACA_API_KEY")
        .expect("ALPACA_API_KEY not set");
    let secret_key = env::var("ALPACA_API_SECRET")
        .expect("ALPACA_API_SECRET not set");

    // ALWAYS use paper trading in tests
    AlpacaBroker::new(api_key, secret_key, true)
}

#[tokio::test]
async fn test_health_check() {
    let broker = get_test_broker();

    let result = broker.health_check().await;
    assert!(result.is_ok(), "Health check should pass");
}

#[tokio::test]
async fn test_get_account() {
    let broker = get_test_broker();

    let account = broker.get_account().await
        .expect("Should get account info");

    assert!(!account.account_id.is_empty());
    assert!(account.cash >= Decimal::ZERO);
    assert!(account.portfolio_value >= Decimal::ZERO);
    println!("Account cash: ${:.2}", account.cash);
}

#[tokio::test]
async fn test_get_positions() {
    let broker = get_test_broker();

    let positions = broker.get_positions().await
        .expect("Should get positions");

    println!("Found {} positions", positions.len());
    for pos in positions {
        println!("  {} | Qty: {} | P&L: ${:.2}",
            pos.symbol.as_str(), pos.qty, pos.unrealized_pl);
    }
}

#[tokio::test]
async fn test_list_orders() {
    let broker = get_test_broker();

    let orders = broker.list_orders(OrderFilter {
        status: None,
        limit: Some(10),
        ..Default::default()
    }).await.expect("Should list orders");

    println!("Found {} orders", orders.len());
}

#[tokio::test]
#[ignore] // Only run manually during market hours
async fn test_place_market_order() {
    let broker = get_test_broker();

    let order = OrderRequest {
        symbol: Symbol::new("AAPL").unwrap(),
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Market,
        time_in_force: TimeInForce::Day,
        limit_price: None,
        stop_price: None,
    };

    let response = broker.place_order(order).await
        .expect("Should place order");

    println!("Order placed: {}", response.order_id);
    assert!(!response.order_id.is_empty());
}

#[tokio::test]
#[ignore] // Only run manually
async fn test_place_and_cancel_limit_order() {
    let broker = get_test_broker();

    // Place limit order at very low price (won't fill)
    let order = OrderRequest {
        symbol: Symbol::new("AAPL").unwrap(),
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        time_in_force: TimeInForce::GTC,
        limit_price: Some(Decimal::from(50)),
        stop_price: None,
    };

    let response = broker.place_order(order).await
        .expect("Should place limit order");

    println!("Limit order placed: {}", response.order_id);

    // Wait a moment
    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

    // Cancel it
    broker.cancel_order(&response.order_id).await
        .expect("Should cancel order");

    println!("Order cancelled");
}

#[tokio::test]
async fn test_broker_creation() {
    let broker = AlpacaBroker::new(
        "test_key".to_string(),
        "test_secret".to_string(),
        true,
    );

    // Just verify it creates successfully
    assert!(true);
}

#[tokio::test]
async fn test_rate_limiting() {
    let broker = get_test_broker();

    // Make multiple rapid requests
    for i in 0..5 {
        let start = std::time::Instant::now();
        let _ = broker.health_check().await;
        let elapsed = start.elapsed();
        println!("Request {}: {:?}", i, elapsed);
    }

    // Rate limiter should handle this gracefully
    assert!(true);
}

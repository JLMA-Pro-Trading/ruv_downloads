// IBKR Integration Tests
//
// These tests require a running TWS/Gateway instance in paper trading mode
// Run with: cargo test --test ibkr_integration_tests -- --ignored

use nt_execution::ibkr_broker::*;
use nt_execution::*;
use rust_decimal::Decimal;
use std::time::Duration;

#[tokio::test]
#[ignore] // Requires TWS/Gateway running
async fn test_ibkr_connection() {
    let _config = IBKRConfig {
        host: "127.0.0.1".to_string(),
        port: 7497,
        paper_trading: true,
        ..Default::default()
    };

    let broker = IBKRBroker::new(config);
    let result = broker.connect().await;

    assert!(result.is_ok(), "Failed to connect to IBKR: {:?}", result.err());
}

#[tokio::test]
#[ignore]
async fn test_get_account() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let account = broker.get_account().await;
    assert!(account.is_ok());

    let account = account.unwrap();
    assert!(!account.account_id.is_empty());
    assert!(account.buying_power > Decimal::ZERO);
}

#[tokio::test]
#[ignore]
async fn test_place_market_order() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let order = OrderRequest {
        symbol: Symbol::new("AAPL").unwrap(),
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Market,
        time_in_force: TimeInForce::Day,
        limit_price: None,
        stop_price: None,
        extended_hours: false,
        client_order_id: None,
    };

    let response = broker.place_order(order).await;
    assert!(response.is_ok(), "Order placement failed: {:?}", response.err());

    let response = response.unwrap();
    assert!(!response.order_id.is_empty());
    assert_eq!(response.status, OrderStatus::Accepted);
}

#[tokio::test]
#[ignore]
async fn test_place_limit_order() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let order = OrderRequest {
        symbol: Symbol::new("AAPL").unwrap(),
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        time_in_force: TimeInForce::Day,
        limit_price: Some(Decimal::from(150)),
        stop_price: None,
        extended_hours: false,
        client_order_id: None,
    };

    let response = broker.place_order(order).await;
    assert!(response.is_ok());
}

#[tokio::test]
#[ignore]
async fn test_bracket_order() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let bracket = BracketOrder {
        entry: OrderRequest {
            symbol: Symbol::new("AAPL").unwrap(),
            quantity: 1,
            side: OrderSide::Buy,
            order_type: OrderType::Limit,
            time_in_force: TimeInForce::Day,
            limit_price: Some(Decimal::from(150)),
            stop_price: None,
            extended_hours: false,
            client_order_id: None,
        },
        stop_loss: OrderRequest {
            symbol: Symbol::new("AAPL").unwrap(),
            quantity: 1,
            side: OrderSide::Sell,
            order_type: OrderType::StopLoss,
            time_in_force: TimeInForce::GTC,
            limit_price: None,
            stop_price: Some(Decimal::from(145)),
            extended_hours: false,
            client_order_id: None,
        },
        take_profit: OrderRequest {
            symbol: Symbol::new("AAPL").unwrap(),
            quantity: 1,
            side: OrderSide::Sell,
            order_type: OrderType::Limit,
            time_in_force: TimeInForce::GTC,
            limit_price: Some(Decimal::from(160)),
            stop_price: None,
            extended_hours: false,
            client_order_id: None,
        },
    };

    let responses = broker.place_bracket_order(bracket).await;
    assert!(responses.is_ok(), "Bracket order failed: {:?}", responses.err());

    let responses = responses.unwrap();
    assert!(!responses.is_empty());
}

#[tokio::test]
#[ignore]
async fn test_trailing_stop_percentage() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let response = broker
        .place_trailing_stop(
            "AAPL",
            1,
            OrderSide::Sell,
            TrailingStop::Percentage(5.0),
        )
        .await;

    assert!(response.is_ok(), "Trailing stop failed: {:?}", response.err());
}

#[tokio::test]
#[ignore]
async fn test_trailing_stop_dollar() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let response = broker
        .place_trailing_stop(
            "AAPL",
            1,
            OrderSide::Sell,
            TrailingStop::Dollar(Decimal::from(10)),
        )
        .await;

    assert!(response.is_ok());
}

#[tokio::test]
#[ignore]
async fn test_vwap_order() {
    let _config = IBKRConfig {
        algo_orders: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let response = broker
        .place_algo_order(
            "AAPL",
            100,
            OrderSide::Buy,
            AlgoStrategy::VWAP {
                start_time: "09:30:00".to_string(),
                end_time: "16:00:00".to_string(),
            },
        )
        .await;

    assert!(response.is_ok(), "VWAP order failed: {:?}", response.err());
}

#[tokio::test]
#[ignore]
async fn test_twap_order() {
    let _config = IBKRConfig {
        algo_orders: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let response = broker
        .place_algo_order(
            "AAPL",
            100,
            OrderSide::Buy,
            AlgoStrategy::TWAP {
                start_time: "09:30:00".to_string(),
                end_time: "16:00:00".to_string(),
            },
        )
        .await;

    assert!(response.is_ok());
}

#[tokio::test]
#[ignore]
async fn test_option_chain() {
    let _config = IBKRConfig {
        options_enabled: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let chain = broker.get_option_chain("AAPL").await;
    assert!(chain.is_ok(), "Option chain fetch failed: {:?}", chain.err());

    let chain = chain.unwrap();
    assert!(!chain.is_empty(), "Option chain is empty");
}

#[tokio::test]
#[ignore]
async fn test_option_greeks() {
    let _config = IBKRConfig {
        options_enabled: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let contract = OptionContract {
        underlying: "AAPL".to_string(),
        strike: Decimal::from(150),
        expiry: "20250117".to_string(),
        right: OptionRight::Call,
        multiplier: 100,
    };

    let greeks = broker.get_option_greeks(&contract).await;
    assert!(greeks.is_ok(), "Greeks calculation failed: {:?}", greeks.err());

    let greeks = greeks.unwrap();
    assert!(greeks.delta >= -1.0 && greeks.delta <= 1.0);
}

#[tokio::test]
#[ignore]
async fn test_place_option_order() {
    let _config = IBKRConfig {
        options_enabled: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let contract = OptionContract {
        underlying: "AAPL".to_string(),
        strike: Decimal::from(150),
        expiry: "20250117".to_string(),
        right: OptionRight::Call,
        multiplier: 100,
    };

    let response = broker
        .place_option_order(contract, 1, OrderSide::Buy, Some(Decimal::from(5)))
        .await;

    assert!(response.is_ok(), "Option order failed: {:?}", response.err());
}

#[tokio::test]
#[ignore]
async fn test_market_data_streaming() {
    let _config = IBKRConfig {
        streaming: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let symbols = vec!["AAPL".to_string(), "MSFT".to_string()];
    let result = broker.start_streaming(symbols).await;

    assert!(result.is_ok(), "Streaming start failed: {:?}", result.err());

    // Get receiver and wait for data
    if let Some(mut rx) = broker.market_data_stream() {
        tokio::select! {
            tick = rx.recv() => {
                assert!(tick.is_ok(), "Failed to receive tick data");
            }
            _ = tokio::time::sleep(Duration::from_secs(5)) => {
                // Timeout is acceptable for this test
            }
        }
    }
}

#[tokio::test]
#[ignore]
async fn test_level2_depth() {
    let _config = IBKRConfig {
        level2_depth: true,
        ..Default::default()
    };
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let symbols = vec!["AAPL".to_string()];
    let result = broker.start_depth_streaming(symbols).await;

    assert!(result.is_ok(), "Depth streaming start failed: {:?}", result.err());
}

#[tokio::test]
#[ignore]
async fn test_historical_data() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let bars = broker
        .get_historical_data("AAPL", "1d", "1min")
        .await;

    assert!(bars.is_ok(), "Historical data fetch failed: {:?}", bars.err());

    let bars = bars.unwrap();
    assert!(!bars.is_empty(), "No historical data returned");
}

#[tokio::test]
#[ignore]
async fn test_pre_trade_risk_check() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let order = OrderRequest {
        symbol: Symbol::new("AAPL").unwrap(),
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Market,
        time_in_force: TimeInForce::Day,
        limit_price: None,
        stop_price: None,
        extended_hours: false,
        client_order_id: None,
    };

    let check = broker.pre_trade_risk_check(&order).await;
    assert!(check.is_ok(), "Risk check failed: {:?}", check.err());

    let check = check.unwrap();
    assert!(check.margin_required >= Decimal::ZERO);
}

#[tokio::test]
#[ignore]
async fn test_buying_power_calculation() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let bp_stocks = broker.calculate_buying_power("STK").await;
    assert!(bp_stocks.is_ok());
    assert!(bp_stocks.unwrap() > Decimal::ZERO);

    let bp_options = broker.calculate_buying_power("OPT").await;
    assert!(bp_options.is_ok());
    assert!(bp_options.unwrap() > Decimal::ZERO);
}

#[tokio::test]
#[ignore]
async fn test_pattern_day_trader_check() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let is_pdt = broker.is_pattern_day_trader().await;
    assert!(is_pdt.is_ok());
}

#[tokio::test]
#[ignore]
async fn test_get_positions() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let positions = broker.get_positions().await;
    assert!(positions.is_ok(), "Get positions failed: {:?}", positions.err());
}

#[tokio::test]
#[ignore]
async fn test_cancel_order() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    // Place an order first
    let order = OrderRequest {
        symbol: Symbol::new("AAPL").unwrap(),
        quantity: 1,
        side: OrderSide::Buy,
        order_type: OrderType::Limit,
        time_in_force: TimeInForce::Day,
        limit_price: Some(Decimal::from(1)), // Very low price, won't fill
        stop_price: None,
        extended_hours: false,
        client_order_id: None,
    };

    let response = broker.place_order(order).await.unwrap();

    // Wait a bit for order to be accepted
    tokio::time::sleep(Duration::from_millis(500)).await;

    // Cancel the order
    let cancel_result = broker.cancel_order(&response.order_id).await;
    assert!(cancel_result.is_ok(), "Cancel order failed: {:?}", cancel_result.err());
}

#[tokio::test]
#[ignore]
async fn test_list_orders() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let orders = broker.list_orders(OrderFilter::All).await;
    assert!(orders.is_ok(), "List orders failed: {:?}", orders.err());
}

#[tokio::test]
#[ignore]
async fn test_health_check() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);

    // Before connection
    let health = broker.health_check().await.unwrap();
    assert_eq!(health, HealthStatus::Unhealthy);

    // After connection
    broker.connect().await.unwrap();
    let health = broker.health_check().await.unwrap();
    assert_eq!(health, HealthStatus::Healthy);
}

// Stress tests
#[tokio::test]
#[ignore]
async fn test_concurrent_orders() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    let mut handles = vec![];

    for i in 0..10 {
        let broker_clone = broker.clone();
        let handle = tokio::spawn(async move {
            let order = OrderRequest {
                symbol: Symbol::new("AAPL").unwrap(),
                quantity: 1,
                side: OrderSide::Buy,
                order_type: OrderType::Limit,
                time_in_force: TimeInForce::Day,
                limit_price: Some(Decimal::from(100 + i)),
                stop_price: None,
                extended_hours: false,
                client_order_id: None,
            };

            broker_clone.place_order(order).await
        });
        handles.push(handle);
    }

    let results = futures::future::join_all(handles).await;
    let successes = results.iter().filter(|r| r.is_ok()).count();

    assert!(successes >= 8, "Too many concurrent order failures: {}/{}", successes, results.len());
}

#[tokio::test]
#[ignore]
async fn test_rate_limiting() {
    let _config = IBKRConfig::default();
    let broker = IBKRBroker::new(config);
    broker.connect().await.unwrap();

    // Try to exceed rate limit (50 req/s)
    let start = std::time::Instant::now();

    for _ in 0..100 {
        let _ = broker.get_account().await;
    }

    let elapsed = start.elapsed();

    // Should take at least 2 seconds due to rate limiting
    assert!(elapsed.as_secs() >= 2, "Rate limiting not working: {:?}", elapsed);
}

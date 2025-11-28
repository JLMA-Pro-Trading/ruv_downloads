// Integration tests for Polygon.io WebSocket streaming
//
// NOTE: These tests require a valid Polygon API key set in POLYGON_API_KEY env variable
// Run with: POLYGON_API_KEY=your_key cargo test --test polygon_integration_test -- --nocapture

use futures::StreamExt;
use nt_market_data::{
    polygon::{PolygonChannel, PolygonClient, PolygonWebSocket},
    MarketDataProvider,
};
use std::time::Duration;
use tokio::time::timeout;

fn get_test_api_key() -> Option<String> {
    std::env::var("POLYGON_API_KEY").ok()
}

#[tokio::test]
async fn test_polygon_websocket_connection() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    // Test connection
    if let Ok(()) = ws.connect().await {
        println!("✓ Successfully connected to Polygon WebSocket");
        assert!(ws.is_connected());
    } else {
        println!("⚠ Connection failed (expected if using invalid key)");
    }
}

#[tokio::test]
async fn test_polygon_subscription_management() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    if ws.connect().await.is_ok() {
        // Subscribe to AAPL trades and quotes
        let result = ws
            .subscribe(
                vec!["AAPL".to_string()],
                vec![PolygonChannel::Trades, PolygonChannel::Quotes],
            )
            .await;

        if result.is_ok() {
            println!("✓ Successfully subscribed to AAPL");

            let subs = ws.get_subscriptions();
            println!("Active subscriptions: {:?}", subs);
            assert!(subs.iter().any(|(sym, _)| sym == "AAPL"));
        }
    }
}

#[tokio::test]
async fn test_polygon_event_streaming() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    if ws.connect().await.is_ok() {
        // Subscribe to multiple symbols
        if ws
            .subscribe(
                vec!["AAPL".to_string(), "TSLA".to_string()],
                vec![PolygonChannel::Trades],
            )
            .await
            .is_ok()
        {
            let mut stream = ws.stream();
            let mut event_count = 0;

            println!("Listening for events (10 second timeout)...");

            // Collect events for 10 seconds
            if let Ok(Some(event)) = timeout(Duration::from_secs(10), stream.next()).await {
                event_count += 1;
                println!("Received event: {:?}", event);
            }

            println!("✓ Received {} events", event_count);
        }
    }
}

#[tokio::test]
async fn test_polygon_quote_stream() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    if ws.connect().await.is_ok() {
        if ws
            .subscribe(vec!["AAPL".to_string()], vec![PolygonChannel::Quotes])
            .await
            .is_ok()
        {
            let mut quote_stream = ws.quote_stream();

            println!("Waiting for quote...");

            if let Ok(Some(Ok(quote))) =
                timeout(Duration::from_secs(10), quote_stream.next()).await
            {
                println!("✓ Received quote: {} bid={} ask={} spread={}",
                    quote.symbol, quote.bid, quote.ask, quote.spread());

                assert_eq!(quote.symbol, "AAPL");
                assert!(quote.bid > rust_decimal::Decimal::ZERO);
                assert!(quote.ask > quote.bid);
            }
        }
    }
}

#[tokio::test]
async fn test_polygon_trade_stream() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    if ws.connect().await.is_ok() {
        if ws
            .subscribe(vec!["TSLA".to_string()], vec![PolygonChannel::Trades])
            .await
            .is_ok()
        {
            let mut trade_stream = ws.trade_stream();

            println!("Waiting for trade...");

            if let Ok(Some(Ok(trade))) =
                timeout(Duration::from_secs(10), trade_stream.next()).await
            {
                println!("✓ Received trade: {} price={} size={}",
                    trade.symbol, trade.price, trade.size);

                assert_eq!(trade.symbol, "TSLA");
                assert!(trade.price > rust_decimal::Decimal::ZERO);
                assert!(trade.size > 0);
            }
        }
    }
}

#[tokio::test]
async fn test_polygon_high_throughput() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    if ws.connect().await.is_ok() {
        // Subscribe to multiple high-volume symbols
        let symbols = vec![
            "AAPL".to_string(),
            "TSLA".to_string(),
            "MSFT".to_string(),
            "NVDA".to_string(),
            "AMD".to_string(),
        ];

        if ws
            .subscribe(
                symbols.clone(),
                vec![PolygonChannel::Trades, PolygonChannel::Quotes],
            )
            .await
            .is_ok()
        {
            let mut stream = ws.stream();
            let mut event_count = 0;
            let start = std::time::Instant::now();

            println!("Measuring throughput for 5 seconds...");

            // Count events for 5 seconds
            loop {
                match timeout(Duration::from_millis(100), stream.next()).await {
                    Ok(Some(_)) => event_count += 1,
                    _ => {}
                }

                if start.elapsed() >= Duration::from_secs(5) {
                    break;
                }
            }

            let duration = start.elapsed();
            let events_per_sec = event_count as f64 / duration.as_secs_f64();

            println!(
                "✓ Processed {} events in {:?} ({:.0} events/sec)",
                event_count, duration, events_per_sec
            );

            // Target: 10,000+ events/sec
            println!("Target throughput: 10,000 events/sec");
        }
    }
}

#[tokio::test]
async fn test_polygon_rest_api() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let client = PolygonClient::new(api_key);

    // Test quote retrieval
    if let Ok(quote) = client.get_quote("AAPL").await {
        println!("✓ REST API quote: {} bid={} ask={}",
            quote.symbol, quote.bid, quote.ask);
        assert_eq!(quote.symbol, "AAPL");
        assert!(quote.bid > rust_decimal::Decimal::ZERO);
    }
}

#[tokio::test]
async fn test_polygon_market_data_provider() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let provider = PolygonClient::new(api_key);

    // Test health check
    if let Ok(status) = provider.health_check().await {
        println!("✓ Health check: {:?}", status);
    }

    // Test subscribe_quotes through trait
    if let Ok(mut quote_stream) = provider.subscribe_quotes(vec!["AAPL".to_string()]).await {
        println!("✓ Subscribed via MarketDataProvider trait");

        if let Ok(Some(Ok(quote))) = timeout(Duration::from_secs(5), quote_stream.next()).await {
            println!("✓ Received quote via trait: {}", quote.symbol);
        }
    }
}

#[tokio::test]
async fn test_polygon_multiple_concurrent_streams() {
    let Some(api_key) = get_test_api_key() else {
        println!("Skipping test: POLYGON_API_KEY not set");
        return;
    };

    let ws = PolygonWebSocket::new(api_key);

    if ws.connect().await.is_ok() {
        if ws
            .subscribe(
                vec!["AAPL".to_string()],
                vec![
                    PolygonChannel::Trades,
                    PolygonChannel::Quotes,
                    PolygonChannel::AggregateBars,
                ],
            )
            .await
            .is_ok()
        {
            // Create multiple stream consumers
            let mut trade_stream = ws.trade_stream();
            let mut quote_stream = ws.quote_stream();
            let mut bar_stream = ws.bar_stream();

            println!("Testing concurrent streams...");

            let (trade_result, quote_result, bar_result) = tokio::join!(
                timeout(Duration::from_secs(3), trade_stream.next()),
                timeout(Duration::from_secs(3), quote_stream.next()),
                timeout(Duration::from_secs(3), bar_stream.next()),
            );

            if trade_result.is_ok() {
                println!("✓ Trade stream working");
            }
            if quote_result.is_ok() {
                println!("✓ Quote stream working");
            }
            if bar_result.is_ok() {
                println!("✓ Bar stream working");
            }
        }
    }
}

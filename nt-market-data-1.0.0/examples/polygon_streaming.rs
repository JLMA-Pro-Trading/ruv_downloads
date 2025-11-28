// Example: High-performance Polygon.io WebSocket streaming
//
// Usage:
//   POLYGON_API_KEY=your_key cargo run --example polygon_streaming

use futures::StreamExt;
use nt_market_data::polygon::{PolygonChannel, PolygonWebSocket};
use std::time::Duration;
use tracing::{info, Level};
use tracing_subscriber;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_max_level(Level::INFO)
        .init();

    // Get API key from environment
    let api_key = std::env::var("POLYGON_API_KEY")
        .expect("POLYGON_API_KEY environment variable must be set");

    info!("🚀 Starting Polygon WebSocket streaming example");

    // Create WebSocket client
    let ws = PolygonWebSocket::new(api_key);

    // Connect
    ws.connect().await?;
    info!("✓ Connected to Polygon WebSocket");

    // Subscribe to multiple symbols and channels
    let symbols = vec![
        "AAPL".to_string(),
        "TSLA".to_string(),
        "MSFT".to_string(),
        "NVDA".to_string(),
    ];

    let channels = vec![
        PolygonChannel::Trades,
        PolygonChannel::Quotes,
        PolygonChannel::AggregateBars,
    ];

    ws.subscribe(symbols.clone(), channels).await?;
    info!("✓ Subscribed to {} symbols", symbols.len());

    // Spawn task to monitor trade stream
    let trade_stream_handle = {
        let mut trade_stream = ws.trade_stream();
        tokio::spawn(async move {
            let mut count = 0;
            info!("📊 Trade stream started");

            while let Some(result) = trade_stream.next().await {
                match result {
                    Ok(trade) => {
                        count += 1;
                        if count % 100 == 0 {
                            info!(
                                "Trade #{}: {} @ {} size={}",
                                count, trade.symbol, trade.price, trade.size
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("Trade stream error: {}", e);
                    }
                }
            }
        })
    };

    // Spawn task to monitor quote stream
    let quote_stream_handle = {
        let mut quote_stream = ws.quote_stream();
        tokio::spawn(async move {
            let mut count = 0;
            info!("📈 Quote stream started");

            while let Some(result) = quote_stream.next().await {
                match result {
                    Ok(quote) => {
                        count += 1;
                        if count % 100 == 0 {
                            info!(
                                "Quote #{}: {} bid={} ask={} spread={:.2} bps",
                                count,
                                quote.symbol,
                                quote.bid,
                                quote.ask,
                                quote.spread_bps()
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("Quote stream error: {}", e);
                    }
                }
            }
        })
    };

    // Spawn task to monitor bar stream
    let bar_stream_handle = {
        let mut bar_stream = ws.bar_stream();
        tokio::spawn(async move {
            let mut count = 0;
            info!("📊 Bar stream started");

            while let Some(result) = bar_stream.next().await {
                match result {
                    Ok(bar) => {
                        count += 1;
                        info!(
                            "Bar #{}: {} O={} H={} L={} C={} V={}",
                            count, bar.symbol, bar.open, bar.high, bar.low, bar.close, bar.volume
                        );
                    }
                    Err(e) => {
                        eprintln!("Bar stream error: {}", e);
                    }
                }
            }
        })
    };

    // Monitor connection status
    let status_handle = {
        let ws_clone = ws.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(10)).await;

                let connected = ws_clone.is_connected();
                let subs = ws_clone.get_subscriptions();

                info!(
                    "Status: connected={} subscriptions={}",
                    connected,
                    subs.len()
                );
            }
        })
    };

    info!("🔄 Streaming market data... (Press Ctrl+C to stop)");
    info!("📊 Monitoring {} symbols with real-time updates", symbols.len());

    // Run for demonstration (or until Ctrl+C)
    tokio::time::sleep(Duration::from_secs(60)).await;

    info!("✓ Demo completed");

    // Clean shutdown
    drop(trade_stream_handle);
    drop(quote_stream_handle);
    drop(bar_stream_handle);
    drop(status_handle);

    Ok(())
}

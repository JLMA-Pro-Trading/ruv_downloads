# nt-market-data

[![Crates.io](https://img.shields.io/crates/v/nt-market-data.svg)](https://crates.io/crates/nt-market-data)
[![Documentation](https://docs.rs/nt-market-data/badge.svg)](https://docs.rs/nt-market-data)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

**Real-time and historical market data providers for stocks, crypto, forex, and options.**

The `nt-market-data` crate provides unified interfaces for fetching market data from multiple providers including Alpaca, Polygon, Yahoo Finance, Alpha Vantage, and cryptocurrency exchanges.

## Features

- **Multi-Source** - Unified API across 10+ data providers
- **Real-Time Streaming** - WebSocket connections for live market data
- **Historical Data** - OHLCV bars, ticks, and quotes
- **Order Book** - Level 2 market depth data
- **Rate Limiting** - Built-in rate limiting per provider
- **Caching** - Intelligent caching to reduce API calls
- **Reconnection** - Automatic reconnection with exponential backoff
- **Normalization** - Consistent data format across providers

## Supported Providers

| Provider | Real-Time | Historical | Asset Classes |
|----------|-----------|------------|---------------|
| **Alpaca** | ✅ | ✅ | Stocks, Crypto |
| **Polygon** | ✅ | ✅ | Stocks, Options, Forex |
| **Yahoo Finance** | ❌ | ✅ | Stocks, ETFs, Crypto |
| **Alpha Vantage** | ❌ | ✅ | Stocks, Forex, Crypto |
| **Binance** | ✅ | ✅ | Crypto |
| **Coinbase** | ✅ | ✅ | Crypto |
| **Kraken** | ✅ | ✅ | Crypto |
| **IEX Cloud** | ✅ | ✅ | Stocks |

## Quick Start

```toml
[dependencies]
nt-market-data = "0.1"
```

### Stream Real-Time Market Data

```rust
use nt_market_data::{
    providers::AlpacaProvider,
    types::{MarketDataType, Subscription},
};
use tokio_stream::StreamExt;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let provider = AlpacaProvider::new(
        std::env::var("ALPACA_API_KEY")?,
        std::env::var("ALPACA_SECRET_KEY")?,
    );

    let mut stream = provider.subscribe(vec![
        Subscription {
            symbol: "AAPL".to_string(),
            data_type: MarketDataType::Trades,
        },
        Subscription {
            symbol: "TSLA".to_string(),
            data_type: MarketDataType::Quotes,
        },
    ]).await?;

    while let Some(data) = stream.next().await {
        match data {
            Ok(market_data) => {
                println!("Received: {:?}", market_data);
            }
            Err(e) => eprintln!("Error: {}", e),
        }
    }

    Ok(())
}
```

### Fetch Historical Data

```rust
use nt_market_data::{
    providers::PolygonProvider,
    types::{TimeFrame, HistoricalRequest},
};
use chrono::{Utc, Duration};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let provider = PolygonProvider::new(
        std::env::var("POLYGON_API_KEY")?
    );

    let request = HistoricalRequest {
        symbol: "AAPL".to_string(),
        timeframe: TimeFrame::Day,
        start: Utc::now() - Duration::days(365),
        end: Utc::now(),
        limit: Some(1000),
    };

    let bars = provider.get_bars(request).await?;

    for bar in bars {
        println!(
            "{}: O={} H={} L={} C={} V={}",
            bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume
        );
    }

    Ok(())
}
```

### Order Book Data

```rust
use nt_market_data::{
    providers::BinanceProvider,
    types::OrderBookRequest,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let provider = BinanceProvider::new();

    let order_book = provider.get_order_book(OrderBookRequest {
        symbol: "BTCUSDT".to_string(),
        depth: 20,
    }).await?;

    println!("Best Bid: {} @ {}", order_book.bids[0].quantity, order_book.bids[0].price);
    println!("Best Ask: {} @ {}", order_book.asks[0].quantity, order_book.asks[0].price);
    println!("Spread: {}", order_book.spread());

    Ok(())
}
```

## Architecture

```
nt-market-data/
├── providers/          # Data provider implementations
│   ├── alpaca.rs
│   ├── polygon.rs
│   ├── yahoo.rs
│   ├── alpha_vantage.rs
│   ├── binance.rs
│   ├── coinbase.rs
│   └── iex.rs
├── types.rs           # Market data types
├── traits.rs          # Provider traits
├── normalization.rs   # Data normalization
├── cache.rs           # Caching layer
└── lib.rs
```

## Configuration

Create a `market_data.toml` configuration file:

```toml
[alpaca]
api_key = "${ALPACA_API_KEY}"
secret_key = "${ALPACA_SECRET_KEY}"
base_url = "https://data.alpaca.markets"

[polygon]
api_key = "${POLYGON_API_KEY}"

[rate_limits]
alpaca_requests_per_minute = 200
polygon_requests_per_minute = 300

[cache]
enabled = true
ttl_seconds = 300
```

## Dependencies

| Crate | Purpose |
|-------|---------|
| `nt-core` | Core types and traits |
| `tokio` | Async runtime |
| `reqwest` | HTTP client |
| `tokio-tungstenite` | WebSocket client |
| `serde_json` | JSON serialization |
| `governor` | Rate limiting |

## Testing

```bash
# Unit tests
cargo test -p nt-market-data

# Integration tests with real providers
ALPACA_API_KEY=xxx POLYGON_API_KEY=yyy cargo test -p nt-market-data --features integration

# Test specific provider
cargo test -p nt-market-data alpaca
```

## Performance

- **WebSocket latency**: <10ms (provider-dependent)
- **Historical data throughput**: 10,000+ bars/sec
- **Concurrent streams**: 100+ symbols simultaneously
- **Memory usage**: <100MB for 50 symbols

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Licensed under MIT OR Apache-2.0.

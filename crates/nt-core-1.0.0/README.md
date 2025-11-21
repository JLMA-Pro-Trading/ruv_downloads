# nt-core

[![Crates.io](https://img.shields.io/crates/v/nt-core.svg)](https://crates.io/crates/nt-core)
[![Documentation](https://docs.rs/nt-core/badge.svg)](https://docs.rs/nt-core)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)
[![Build Status](https://github.com/ruvnet/neural-trader/workflows/CI/badge.svg)](https://github.com/ruvnet/neural-trader/actions)

**Core types, traits, and abstractions for the NeuralTrader algorithmic trading system.**

The `nt-core` crate provides the foundational building blocks used across all NeuralTrader components, including order types, position management, market data structures, account abstractions, and essential trading primitives.

## Features

- **Zero-Copy Serialization** - Efficient binary serialization with `serde`
- **Decimal Precision** - Financial-grade calculations with `rust_decimal`
- **Type Safety** - Strong typing for orders, positions, and market data
- **Async-First** - Built on `tokio` for high-performance concurrent operations
- **Thread-Safe** - Concurrent data structures with `dashmap` and `parking_lot`
- **Validation** - Input validation with `validator` derive macros
- **Configuration** - TOML-based configuration management
- **Error Handling** - Comprehensive error types with `thiserror` and `anyhow`

## Quick Start

Add `nt-core` to your `Cargo.toml`:

```toml
[dependencies]
nt-core = "0.1"
```

### Basic Usage

```rust
use nt_core::{
    types::{Order, OrderType, Side, Position, MarketData, Account},
    traits::{OrderManager, PositionManager},
    config::TradingConfig,
};
use rust_decimal::Decimal;
use chrono::Utc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Create a market order
    let order = Order {
        id: uuid::Uuid::new_v4(),
        symbol: "AAPL".to_string(),
        side: Side::Buy,
        order_type: OrderType::Market,
        quantity: Decimal::from(100),
        price: None,
        status: OrderStatus::Pending,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    };

    // Create a position
    let position = Position {
        symbol: "AAPL".to_string(),
        quantity: Decimal::from(100),
        entry_price: Decimal::new(15000, 2), // $150.00
        current_price: Decimal::new(15200, 2), // $152.00
        unrealized_pnl: Decimal::from(200),
        realized_pnl: Decimal::ZERO,
        opened_at: Utc::now(),
    };

    // Load configuration
    let config = TradingConfig::from_file("config.toml")?;

    println!("Position P&L: ${}", position.unrealized_pnl);

    Ok(())
}
```

## Architecture

The crate is organized into several key modules:

```
nt-core/
├── types.rs          # Core data types (Order, Position, MarketData, Account)
├── traits.rs         # Trait definitions (OrderManager, PositionManager, DataProvider)
├── config.rs         # Configuration management
├── error.rs          # Error types and conversions
└── lib.rs            # Module exports and prelude
```

### Core Types

- **Order** - Order representation with type, side, quantity, price
- **Position** - Open position with P&L tracking
- **MarketData** - OHLCV bars, ticks, quotes, order books
- **Account** - Account balance, margin, buying power
- **Trade** - Executed trade with fees and timestamps

### Core Traits

- **OrderManager** - Order placement, cancellation, modification
- **PositionManager** - Position tracking and management
- **DataProvider** - Market data subscription and retrieval
- **RiskManager** - Risk checks and limit enforcement

## Dependencies

| Crate | Purpose |
|-------|---------|
| `tokio` | Async runtime |
| `serde` | Serialization/deserialization |
| `rust_decimal` | Decimal arithmetic for financial calculations |
| `chrono` | Date and time handling |
| `uuid` | Unique identifiers |
| `thiserror` | Error type derivation |
| `validator` | Input validation |
| `dashmap` | Concurrent hash map |
| `parking_lot` | Efficient synchronization primitives |

## Testing

Run the test suite:

```bash
cargo test -p nt-core
```

Run with property-based testing:

```bash
cargo test -p nt-core --features proptest
```

Run benchmarks:

```bash
cargo bench -p nt-core
```

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `cargo test -p nt-core`
2. Code is formatted: `cargo fmt -p nt-core`
3. No clippy warnings: `cargo clippy -p nt-core -- -D warnings`
4. Documentation builds: `cargo doc -p nt-core --no-deps`

## License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](../../LICENSE-APACHE))
- MIT License ([LICENSE-MIT](../../LICENSE-MIT))

at your option.

# nt-features

[![Crates.io](https://img.shields.io/crates/v/nt-features.svg)](https://crates.io/crates/nt-features)
[![Documentation](https://docs.rs/nt-features/badge.svg)](https://docs.rs/nt-features)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

**Technical indicators and feature engineering for quantitative trading strategies.**

The `nt-features` crate provides a comprehensive library of technical indicators, statistical features, and feature engineering tools optimized for algorithmic trading.

## Features

- **100+ Technical Indicators** - Moving averages, oscillators, volatility, volume
- **Statistical Features** - Rolling statistics, correlations, distributions
- **Feature Engineering** - Automated feature generation and selection
- **Polars Integration** - High-performance DataFrame operations
- **Lazy Evaluation** - Efficient computation with Polars lazy API
- **Custom Indicators** - Extensible framework for custom indicators
- **Real-Time Processing** - Stream-friendly incremental calculations
- **GPU Acceleration** - Optional CUDA support for large datasets

## Technical Indicators

### Trend Indicators
- Simple Moving Average (SMA)
- Exponential Moving Average (EMA)
- Weighted Moving Average (WMA)
- MACD (Moving Average Convergence Divergence)
- ADX (Average Directional Index)
- Parabolic SAR

### Momentum Indicators
- RSI (Relative Strength Index)
- Stochastic Oscillator
- Williams %R
- Rate of Change (ROC)
- Momentum
- CCI (Commodity Channel Index)

### Volatility Indicators
- Bollinger Bands
- ATR (Average True Range)
- Keltner Channels
- Standard Deviation
- Historical Volatility

### Volume Indicators
- On-Balance Volume (OBV)
- Volume-Weighted Average Price (VWAP)
- Accumulation/Distribution
- Chaikin Money Flow
- Volume Oscillator

## Quick Start

```toml
[dependencies]
nt-features = "0.1"
```

### Basic Usage

```rust
use nt_features::{
    indicators::{SMA, RSI, BollingerBands, MACD},
    FeatureEngine,
};
use polars::prelude::*;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load market data
    let df = CsvReader::from_path("AAPL.csv")?
        .has_header(true)
        .finish()?;

    // Calculate indicators
    let sma_20 = SMA::new(20).calculate(&df)?;
    let rsi_14 = RSI::new(14).calculate(&df)?;
    let bb = BollingerBands::new(20, 2.0).calculate(&df)?;
    let macd = MACD::new(12, 26, 9).calculate(&df)?;

    // Add indicators to DataFrame
    let df = df
        .lazy()
        .with_column(sma_20.alias("sma_20"))
        .with_column(rsi_14.alias("rsi_14"))
        .with_column(bb.upper.alias("bb_upper"))
        .with_column(bb.lower.alias("bb_lower"))
        .with_column(macd.macd_line.alias("macd"))
        .with_column(macd.signal_line.alias("macd_signal"))
        .collect()?;

    println!("{}", df);

    Ok(())
}
```

### Feature Engineering

```rust
use nt_features::{FeatureEngine, FeatureConfig};
use polars::prelude::*;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = FeatureConfig {
        lookback_periods: vec![5, 10, 20, 50, 200],
        include_technical: true,
        include_statistical: true,
        include_interactions: true,
        pca_components: Some(50),
    };

    let engine = FeatureEngine::new(config);

    // Load and prepare data
    let df = CsvReader::from_path("market_data.csv")?
        .has_header(true)
        .finish()?;

    // Generate features automatically
    let features = engine.generate_features(&df)?;

    println!("Generated {} features", features.width());
    println!("Feature names: {:?}", features.get_column_names());

    // Feature importance
    let importance = engine.calculate_importance(&features, "returns")?;
    println!("Top 10 features:\n{}", importance.head(Some(10)));

    Ok(())
}
```

### Real-Time Indicators

```rust
use nt_features::indicators::streaming::{StreamingSMA, StreamingRSI};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut sma = StreamingSMA::new(20);
    let mut rsi = StreamingRSI::new(14);

    // Process streaming data
    let prices = vec![100.0, 101.5, 99.8, 102.3, 103.1];

    for price in prices {
        let sma_value = sma.update(price);
        let rsi_value = rsi.update(price);

        println!("Price: {}, SMA: {:.2}, RSI: {:.2}", price, sma_value, rsi_value);
    }

    Ok(())
}
```

## Architecture

```
nt-features/
├── indicators/
│   ├── trend.rs          # Trend indicators (SMA, EMA, MACD)
│   ├── momentum.rs       # Momentum indicators (RSI, Stochastic)
│   ├── volatility.rs     # Volatility indicators (Bollinger, ATR)
│   ├── volume.rs         # Volume indicators (OBV, VWAP)
│   └── streaming.rs      # Real-time streaming indicators
├── statistics/
│   ├── rolling.rs        # Rolling statistics
│   ├── correlation.rs    # Correlation analysis
│   └── distributions.rs  # Distribution metrics
├── feature_engine.rs     # Automated feature generation
├── selection.rs          # Feature selection algorithms
└── lib.rs
```

## Performance

| Operation | Throughput | Latency |
|-----------|------------|---------|
| SMA calculation | 10M+ samples/sec | <1μs |
| RSI calculation | 5M+ samples/sec | <2μs |
| Feature generation | 100K+ rows/sec | <10ms |
| Streaming update | <100ns | Real-time |

Benchmarks run on: AMD EPYC 7763 (single core)

## Dependencies

| Crate | Purpose |
|-------|---------|
| `nt-core` | Core types |
| `polars` | DataFrame operations |
| `statrs` | Statistical functions |
| `ndarray` | Numerical arrays |
| `rayon` | Parallel processing |

## Testing

```bash
# Unit tests
cargo test -p nt-features

# Benchmarks
cargo bench -p nt-features

# Property-based tests
cargo test -p nt-features --features proptest
```

## Contributing

Contributions welcome! Areas for improvement:

- Additional technical indicators
- GPU acceleration for more indicators
- Feature selection algorithms
- Documentation and examples

## License

Licensed under MIT OR Apache-2.0.

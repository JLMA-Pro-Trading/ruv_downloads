# nt-portfolio

[![Crates.io](https://img.shields.io/crates/v/nt-portfolio.svg)](https://crates.io/crates/nt-portfolio)
[![Documentation](https://docs.rs/nt-portfolio/badge.svg)](https://docs.rs/nt-portfolio)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

**Portfolio management, optimization, and real-time P&L tracking for algorithmic trading.**

The `nt-portfolio` crate provides comprehensive portfolio management capabilities including position tracking, P&L calculation, rebalancing, and portfolio optimization using modern portfolio theory.

## Features

- **Real-Time P&L** - Mark-to-market position and portfolio P&L
- **Portfolio Optimization** - Mean-variance, risk parity, Black-Litterman
- **Rebalancing** - Automatic rebalancing with configurable thresholds
- **Asset Allocation** - Strategic and tactical asset allocation
- **Risk Metrics** - VaR, CVaR, Sharpe ratio, max drawdown
- **Performance Attribution** - Decompose returns by asset and factor
- **Multi-Currency** - Support for multi-currency portfolios
- **Tax-Loss Harvesting** - Optimize for after-tax returns
- **Benchmark Tracking** - Track against indices (S&P 500, etc.)

## Quick Start

```toml
[dependencies]
nt-portfolio = "0.1"
```

### Basic Portfolio Management

```rust
use nt_portfolio::{Portfolio, Position};
use rust_decimal::Decimal;
use chrono::Utc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut portfolio = Portfolio::new(
        "main_portfolio",
        Decimal::from(100_000), // Initial capital
    );

    // Add positions
    portfolio.add_position(Position {
        symbol: "AAPL".to_string(),
        quantity: Decimal::from(100),
        entry_price: Decimal::new(15000, 2), // $150.00
        current_price: Decimal::new(15500, 2), // $155.00
        entry_date: Utc::now(),
    });

    portfolio.add_position(Position {
        symbol: "MSFT".to_string(),
        quantity: Decimal::from(50),
        entry_price: Decimal::new(30000, 2), // $300.00
        current_price: Decimal::new(31000, 2), // $310.00
        entry_date: Utc::now(),
    });

    // Calculate metrics
    println!("Total Value: ${}", portfolio.total_value());
    println!("Total P&L: ${}", portfolio.total_pnl());
    println!("Total Return: {:.2}%", portfolio.total_return() * Decimal::from(100));

    // Position-level metrics
    for position in portfolio.positions() {
        println!(
            "{}: P&L ${} ({:.2}%)",
            position.symbol,
            position.unrealized_pnl(),
            position.return_pct() * Decimal::from(100)
        );
    }

    Ok(())
}
```

### Portfolio Optimization

```rust
use nt_portfolio::{
    optimizer::{PortfolioOptimizer, OptimizationMethod},
    constraints::Constraints,
};
use rust_decimal::Decimal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let symbols = vec!["AAPL", "MSFT", "GOOGL", "AMZN", "TSLA"];

    let optimizer = PortfolioOptimizer::new(
        symbols,
        OptimizationMethod::MeanVariance {
            target_return: Some(Decimal::new(12, 2)), // 12% annual
            risk_free_rate: Decimal::new(4, 2),        // 4% risk-free
        },
    );

    // Set constraints
    let constraints = Constraints {
        min_weight: Decimal::new(5, 2),  // 5% minimum
        max_weight: Decimal::new(30, 2), // 30% maximum
        max_sector_weight: Some(Decimal::new(40, 2)), // 40% per sector
        max_volatility: Some(Decimal::new(20, 2)),    // 20% max vol
    };

    // Optimize portfolio
    let optimal_weights = optimizer
        .optimize()
        .with_constraints(constraints)
        .await?;

    println!("Optimal Portfolio Weights:");
    for (symbol, weight) in optimal_weights {
        println!("  {}: {:.2}%", symbol, weight * Decimal::from(100));
    }

    // Get expected metrics
    let metrics = optimizer.expected_metrics(&optimal_weights)?;
    println!("\nExpected Return: {:.2}%", metrics.expected_return * Decimal::from(100));
    println!("Expected Volatility: {:.2}%", metrics.volatility * Decimal::from(100));
    println!("Sharpe Ratio: {:.2}", metrics.sharpe_ratio);

    Ok(())
}
```

### Portfolio Rebalancing

```rust
use nt_portfolio::{
    Portfolio,
    rebalancer::{Rebalancer, RebalancingStrategy},
};
use rust_decimal::Decimal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut portfolio = Portfolio::load("main_portfolio")?;

    let rebalancer = Rebalancer::new(
        RebalancingStrategy::TargetWeights {
            weights: vec![
                ("AAPL".to_string(), Decimal::new(25, 2)),
                ("MSFT".to_string(), Decimal::new(25, 2)),
                ("GOOGL".to_string(), Decimal::new(25, 2)),
                ("AMZN".to_string(), Decimal::new(25, 2)),
            ].into_iter().collect(),
        },
    );

    // Calculate rebalancing trades
    let trades = rebalancer.calculate_trades(&portfolio)?;

    println!("Rebalancing Trades:");
    for trade in &trades {
        println!(
            "  {} {} {} shares @ ${}",
            trade.side,
            trade.symbol,
            trade.quantity,
            trade.estimated_price
        );
    }

    // Execute rebalancing
    rebalancer.execute_trades(trades, &mut portfolio).await?;

    println!("Portfolio rebalanced successfully");

    Ok(())
}
```

### Risk Parity Portfolio

```rust
use nt_portfolio::optimizer::{PortfolioOptimizer, OptimizationMethod};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let assets = vec![
        "SPY",  // Stocks
        "TLT",  // Bonds
        "GLD",  // Gold
        "DBC",  // Commodities
    ];

    let optimizer = PortfolioOptimizer::new(
        assets,
        OptimizationMethod::RiskParity,
    );

    let weights = optimizer.optimize().await?;

    println!("Risk Parity Portfolio:");
    for (symbol, weight) in weights {
        println!("  {}: {:.2}%", symbol, weight * Decimal::from(100));
    }

    Ok(())
}
```

### Performance Attribution

```rust
use nt_portfolio::attribution::PerformanceAttributor;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let portfolio = Portfolio::load("main_portfolio")?;
    let benchmark = "SPY"; // S&P 500

    let attributor = PerformanceAttributor::new(
        portfolio,
        benchmark,
    );

    let attribution = attributor.calculate().await?;

    println!("Performance Attribution:");
    println!("  Total Return: {:.2}%", attribution.total_return * Decimal::from(100));
    println!("  Benchmark Return: {:.2}%", attribution.benchmark_return * Decimal::from(100));
    println!("  Alpha: {:.2}%", attribution.alpha * Decimal::from(100));
    println!("  Beta: {:.2}", attribution.beta);

    println!("\nReturn Decomposition:");
    println!("  Asset Selection: {:.2}%", attribution.selection_effect * Decimal::from(100));
    println!("  Sector Allocation: {:.2}%", attribution.allocation_effect * Decimal::from(100));
    println!("  Interaction: {:.2}%", attribution.interaction_effect * Decimal::from(100));

    Ok(())
}
```

### Tax-Loss Harvesting

```rust
use nt_portfolio::tax::{TaxLossHarvester, HarvestingStrategy};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let portfolio = Portfolio::load("taxable_portfolio")?;

    let harvester = TaxLossHarvester::new(
        HarvestingStrategy {
            min_loss_threshold: Decimal::new(1000, 0), // $1,000 minimum loss
            max_lots_per_symbol: 10,
            avoid_wash_sales: true,
        },
    );

    let opportunities = harvester.find_opportunities(&portfolio)?;

    println!("Tax-Loss Harvesting Opportunities:");
    for opp in opportunities {
        println!(
            "  {} {} shares: Loss ${} (save ${})",
            opp.symbol,
            opp.quantity,
            opp.loss_amount,
            opp.tax_savings
        );
    }

    // Execute harvesting
    let trades = harvester.generate_trades(opportunities)?;
    // ... execute trades

    Ok(())
}
```

## Architecture

```
nt-portfolio/
├── portfolio.rs         # Core portfolio management
├── position.rs          # Position tracking
├── optimizer/
│   ├── mean_variance.rs # Mean-variance optimization
│   ├── risk_parity.rs   # Risk parity
│   ├── black_litterman.rs # Black-Litterman model
│   └── constraints.rs   # Portfolio constraints
├── rebalancer.rs        # Rebalancing logic
├── attribution.rs       # Performance attribution
├── tax.rs               # Tax-loss harvesting
├── metrics.rs           # Portfolio metrics
└── lib.rs
```

## Portfolio Metrics

The crate calculates comprehensive portfolio metrics:

- **Return Metrics**: Total return, annualized return, daily returns
- **Risk Metrics**: Volatility, VaR, CVaR, max drawdown, Sharpe ratio
- **Risk-Adjusted**: Sortino ratio, Calmar ratio, information ratio
- **Factor Exposure**: Beta, alpha, correlation to benchmark
- **Concentration**: Herfindahl index, top N concentration

## Dependencies

| Crate | Purpose |
|-------|---------|
| `nt-core` | Core types |
| `nt-risk` | Risk calculations |
| `polars` | DataFrame operations |
| `statrs` | Statistical functions |
| `nalgebra` | Linear algebra for optimization |

## Testing

```bash
# Unit tests
cargo test -p nt-portfolio

# Integration tests
cargo test -p nt-portfolio --features integration

# Benchmarks
cargo bench -p nt-portfolio
```

## Performance

- Portfolio valuation: <1ms for 1000 positions
- Optimization: <100ms for 100 assets
- Rebalancing calculation: <10ms for 50 positions
- Real-time P&L updates: <1μs per position

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

Licensed under MIT OR Apache-2.0.

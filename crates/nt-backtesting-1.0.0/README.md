# nt-backtesting

[![Crates.io](https://img.shields.io/crates/v/nt-backtesting.svg)](https://crates.io/crates/nt-backtesting)
[![Documentation](https://docs.rs/nt-backtesting/badge.svg)](https://docs.rs/nt-backtesting)
[![License: MIT OR Apache-2.0](https://img.shields.io/badge/License-MIT%20OR%20Apache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.75%2B-orange.svg)](https://www.rust-lang.org/)

**High-performance backtesting engine with realistic execution simulation and comprehensive performance analytics.**

The `nt-backtesting` crate provides a production-grade backtesting framework with tick-level precision, slippage modeling, commission structures, and detailed performance metrics for evaluating trading strategies.

## Features

- **Event-Driven Architecture** - Accurate simulation of real-time trading
- **Multiple Data Frequencies** - Tick, second, minute, daily bars
- **Realistic Execution** - Slippage modeling, partial fills, order queues
- **Commission Models** - Fixed, percentage, tiered structures
- **Performance Analytics** - 40+ metrics including Sharpe, Sortino, Calmar
- **Benchmark Comparison** - Compare against indices and other strategies
- **Monte Carlo Analysis** - Statistical robustness testing
- **Walk-Forward Optimization** - Prevent overfitting
- **Multi-Strategy Backtests** - Test portfolios of strategies
- **Parallel Execution** - Multi-threaded backtesting

## Quick Start

```toml
[dependencies]
nt-backtesting = "0.1"
```

### Basic Backtest

```rust
use nt_backtesting::{Backtester, BacktestConfig};
use nt_strategies::MeanReversionStrategy;
use chrono::{Utc, Duration};
use rust_decimal::Decimal;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let strategy = MeanReversionStrategy::builder()
        .lookback_period(20)
        .entry_std_devs(Decimal::new(2, 0))
        .build()?;

    let config = BacktestConfig {
        start_date: Utc::now() - Duration::days(365),
        end_date: Utc::now(),
        initial_capital: Decimal::from(100_000),
        commission: Commission::PerShare(Decimal::new(1, 3)), // $0.001/share
        slippage: Slippage::Percentage(Decimal::new(5, 3)),   // 0.5%
    };

    let backtester = Backtester::new(config);
    let results = backtester.run(strategy).await?;

    println!("Backtest Results:");
    println!("  Total Return: {:.2}%", results.total_return * 100.0);
    println!("  Annual Return: {:.2}%", results.annual_return * 100.0);
    println!("  Sharpe Ratio: {:.2}", results.sharpe_ratio);
    println!("  Max Drawdown: {:.2}%", results.max_drawdown * 100.0);
    println!("  Win Rate: {:.2}%", results.win_rate * 100.0);
    println!("  Total Trades: {}", results.total_trades);

    Ok(())
}
```

### Detailed Performance Metrics

```rust
use nt_backtesting::analytics::PerformanceAnalyzer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let results = backtester.run(strategy).await?;
    let analyzer = PerformanceAnalyzer::new(&results);

    // Return metrics
    println!("Return Metrics:");
    println!("  Total Return: {:.2}%", analyzer.total_return() * 100.0);
    println!("  CAGR: {:.2}%", analyzer.cagr() * 100.0);
    println!("  Daily Returns (mean): {:.4}%", analyzer.mean_daily_return() * 100.0);
    println!("  Monthly Returns (mean): {:.2}%", analyzer.mean_monthly_return() * 100.0);

    // Risk metrics
    println!("\nRisk Metrics:");
    println!("  Volatility (annual): {:.2}%", analyzer.annual_volatility() * 100.0);
    println!("  Sharpe Ratio: {:.2}", analyzer.sharpe_ratio());
    println!("  Sortino Ratio: {:.2}", analyzer.sortino_ratio());
    println!("  Calmar Ratio: {:.2}", analyzer.calmar_ratio());
    println!("  Max Drawdown: {:.2}%", analyzer.max_drawdown() * 100.0);
    println!("  Max Drawdown Duration: {} days", analyzer.max_drawdown_duration_days());

    // Trade statistics
    println!("\nTrade Statistics:");
    println!("  Total Trades: {}", analyzer.total_trades());
    println!("  Win Rate: {:.2}%", analyzer.win_rate() * 100.0);
    println!("  Avg Win: ${:.2}", analyzer.avg_win());
    println!("  Avg Loss: ${:.2}", analyzer.avg_loss());
    println!("  Profit Factor: {:.2}", analyzer.profit_factor());
    println!("  Avg Holding Period: {:.1} days", analyzer.avg_holding_period_days());

    // Risk-adjusted returns
    println!("\nRisk-Adjusted Returns:");
    println!("  Information Ratio: {:.2}", analyzer.information_ratio());
    println!("  Omega Ratio: {:.2}", analyzer.omega_ratio());
    println!("  Kurtosis: {:.2}", analyzer.kurtosis());
    println!("  Skewness: {:.2}", analyzer.skewness());

    Ok(())
}
```

### Benchmark Comparison

```rust
use nt_backtesting::benchmark::BenchmarkComparison;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let strategy_results = backtester.run(strategy).await?;

    let comparison = BenchmarkComparison::new(
        strategy_results,
        "SPY", // S&P 500 ETF
    );

    let metrics = comparison.compare().await?;

    println!("Strategy vs S&P 500:");
    println!("  Strategy Return: {:.2}%", metrics.strategy_return * 100.0);
    println!("  Benchmark Return: {:.2}%", metrics.benchmark_return * 100.0);
    println!("  Excess Return: {:.2}%", metrics.excess_return * 100.0);
    println!("  Alpha: {:.2}%", metrics.alpha * 100.0);
    println!("  Beta: {:.2}", metrics.beta);
    println!("  Correlation: {:.2}", metrics.correlation);
    println!("  Tracking Error: {:.2}%", metrics.tracking_error * 100.0);

    Ok(())
}
```

### Commission and Slippage Models

```rust
use nt_backtesting::{Commission, Slippage};

// Commission models
let fixed = Commission::Fixed(Decimal::new(5, 0)); // $5 per trade
let per_share = Commission::PerShare(Decimal::new(1, 3)); // $0.001 per share
let percentage = Commission::Percentage(Decimal::new(1, 3)); // 0.1%
let tiered = Commission::Tiered(vec![
    (10_000, Decimal::new(5, 3)),    // 0.5% for < $10k
    (100_000, Decimal::new(2, 3)),   // 0.2% for < $100k
    (u64::MAX, Decimal::new(1, 3)),  // 0.1% for >= $100k
]);

// Slippage models
let fixed_slippage = Slippage::Fixed(Decimal::new(5, 2)); // $0.05 per share
let percentage_slippage = Slippage::Percentage(Decimal::new(5, 3)); // 0.5%
let volume_based = Slippage::VolumeBased {
    base_slippage: Decimal::new(1, 3),
    volume_impact_factor: Decimal::new(5, 4), // 0.05% per 1% of volume
};

let config = BacktestConfig {
    commission: tiered,
    slippage: volume_based,
    ..Default::default()
};
```

### Walk-Forward Optimization

```rust
use nt_backtesting::optimization::{WalkForwardOptimizer, OptimizationConfig};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let optimizer = WalkForwardOptimizer::new(OptimizationConfig {
        in_sample_days: 252,  // 1 year training
        out_sample_days: 63,  // 1 quarter testing
        step_days: 21,        // 1 month step
        metric: OptimizationMetric::SharpeRatio,
    });

    // Define parameter ranges
    let param_space = vec![
        ("lookback_period", vec![10, 20, 30, 50]),
        ("entry_threshold", vec![1.5, 2.0, 2.5, 3.0]),
        ("exit_threshold", vec![0.0, 0.5, 1.0]),
    ];

    // Run walk-forward optimization
    let results = optimizer.optimize(
        strategy_builder,
        param_space,
    ).await?;

    println!("Walk-Forward Optimization Results:");
    println!("  Optimal Parameters: {:?}", results.best_params);
    println!("  In-Sample Sharpe: {:.2}", results.in_sample_sharpe);
    println!("  Out-Sample Sharpe: {:.2}", results.out_sample_sharpe);
    println!("  Degradation: {:.2}%", results.degradation_pct * 100.0);

    Ok(())
}
```

### Monte Carlo Analysis

```rust
use nt_backtesting::monte_carlo::MonteCarloAnalyzer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let results = backtester.run(strategy).await?;

    let mc_analyzer = MonteCarloAnalyzer::new(
        10_000, // 10,000 simulations
        42,     // random seed
    );

    let mc_results = mc_analyzer.analyze(&results)?;

    println!("Monte Carlo Analysis (10,000 simulations):");
    println!("  Mean Return: {:.2}%", mc_results.mean_return * 100.0);
    println!("  Median Return: {:.2}%", mc_results.median_return * 100.0);
    println!("  Std Dev: {:.2}%", mc_results.std_dev * 100.0);
    println!("  95% Confidence Interval: [{:.2}%, {:.2}%]",
        mc_results.ci_lower_95 * 100.0,
        mc_results.ci_upper_95 * 100.0
    );
    println!("  Probability of Profit: {:.2}%", mc_results.prob_profit * 100.0);
    println!("  Risk of Ruin: {:.2}%", mc_results.risk_of_ruin * 100.0);

    Ok(())
}
```

### Multi-Strategy Backtesting

```rust
use nt_backtesting::MultiStrategyBacktester;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let mut backtester = MultiStrategyBacktester::new(config);

    // Add strategies with capital allocation
    backtester.add_strategy("pairs", pairs_strategy, Decimal::new(4, 1));      // 40%
    backtester.add_strategy("momentum", momentum_strategy, Decimal::new(3, 1)); // 30%
    backtester.add_strategy("neural", neural_strategy, Decimal::new(3, 1));     // 30%

    let results = backtester.run().await?;

    println!("Multi-Strategy Results:");
    println!("  Portfolio Return: {:.2}%", results.total_return * 100.0);
    println!("  Portfolio Sharpe: {:.2}", results.sharpe_ratio);

    println!("\nStrategy Breakdown:");
    for (name, strategy_result) in results.strategy_results {
        println!("  {}: {:.2}% return, {:.2} Sharpe",
            name,
            strategy_result.total_return * 100.0,
            strategy_result.sharpe_ratio
        );
    }

    Ok(())
}
```

### Custom Performance Metrics

```rust
use nt_backtesting::analytics::CustomMetric;

struct UlcerIndex;

impl CustomMetric for UlcerIndex {
    fn calculate(&self, equity_curve: &[Decimal]) -> Decimal {
        let mut sum_squared_drawdowns = Decimal::ZERO;
        let mut peak = equity_curve[0];

        for &value in equity_curve {
            peak = peak.max(value);
            let drawdown = (peak - value) / peak;
            sum_squared_drawdowns += drawdown * drawdown;
        }

        (sum_squared_drawdowns / Decimal::from(equity_curve.len())).sqrt()
    }
}

// Use custom metric
let ulcer_index = analyzer.custom_metric(UlcerIndex);
println!("Ulcer Index: {:.2}", ulcer_index);
```

## Architecture

```
nt-backtesting/
├── engine/
│   ├── event_loop.rs      # Event-driven simulation
│   ├── execution.rs       # Order execution logic
│   └── portfolio.rs       # Portfolio state tracking
├── analytics/
│   ├── metrics.rs         # Performance metrics
│   ├── returns.rs         # Return calculations
│   ├── risk.rs            # Risk metrics
│   └── drawdown.rs        # Drawdown analysis
├── optimization/
│   ├── walk_forward.rs    # Walk-forward optimization
│   ├── grid_search.rs     # Grid search
│   └── genetic.rs         # Genetic algorithm
├── monte_carlo.rs         # Monte Carlo analysis
├── benchmark.rs           # Benchmark comparison
├── commission.rs          # Commission models
├── slippage.rs            # Slippage models
└── lib.rs
```

## Performance Metrics

The backtester calculates 40+ performance metrics:

**Returns**: Total, Annual, Monthly, Daily, CAGR
**Risk**: Volatility, VaR, CVaR, Max Drawdown
**Risk-Adjusted**: Sharpe, Sortino, Calmar, Omega
**Trade Stats**: Win rate, Profit factor, Avg trade
**Statistical**: Skewness, Kurtosis, Correlation

## Dependencies

| Crate | Purpose |
|-------|---------|
| `nt-core` | Core types |
| `nt-strategies` | Strategy trait |
| `polars` | Data processing |
| `statrs` | Statistical functions |
| `rayon` | Parallel processing |

## Testing

```bash
# Unit tests
cargo test -p nt-backtesting

# Integration tests
cargo test -p nt-backtesting --features integration

# Benchmarks
cargo bench -p nt-backtesting
```

## Performance

- Backtest speed: 10,000+ bars/sec
- Memory usage: <500MB for 10 years daily data
- Parallel backtests: 8+ strategies simultaneously

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

Licensed under MIT OR Apache-2.0.

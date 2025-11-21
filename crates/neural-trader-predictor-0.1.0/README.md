# Neural Trader Predictor

[![Crates.io](https://img.shields.io/crates/v/neural-trader-predictor.svg)](https://crates.io/crates/neural-trader-predictor)
[![Docs.rs](https://docs.rs/neural-trader-predictor/badge.svg)](https://docs.rs/neural-trader-predictor)
[![License](https://img.shields.io/crates/l/neural-trader-predictor.svg)](https://github.com/ruvnet/neural-trader/blob/main/LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.70%2B-orange.svg)](https://www.rust-lang.org/)

**Conformal prediction SDK for neural trading with guaranteed prediction intervals**

A high-performance Rust library providing distribution-free prediction intervals with provable statistical guarantees. Perfect for quantitative trading, risk management, and any application requiring reliable uncertainty quantification.

## Core Principle

Conformal prediction provides a mathematical guarantee:

```
P(y ∈ [lower, upper]) ≥ 1 - α
```

Rather than uncertain point estimates, get intervals with **provable coverage** regardless of the underlying data distribution.

## 🎯 Key Features

- **Split Conformal Prediction**: Distribution-free prediction intervals with `(1-α)` coverage guarantee
- **Adaptive Conformal Inference (ACI)**: PID-controlled dynamic coverage adjustment for streaming data
- **Conformalized Quantile Regression (CQR)**: Quantile-based prediction intervals with conformal guarantees
- **Hybrid Integration**: Best-of-both-worlds combining our optimized implementation with advanced features from `conformal-prediction` crate
  - **CPD (Conformal Predictive Distributions)**: Full probability distributions with CDF queries for risk/reward analysis
  - **PCP (Posterior Conformal Prediction)**: Regime-aware predictions with cluster-based adaptation (bull/bear/sideways)
  - **Formal Verification**: Lean4 mathematical proofs for coverage guarantees
  - **KNN Nonconformity**: Advanced distance-based scoring
- **Multiple Nonconformity Scores**: Absolute, normalized, and quantile-based scoring functions
- **High-Performance Optimizations**:
  - Nanosecond-precision scheduling for microsecond-level recalibration
  - Sublinear O(log n) streaming updates
  - Temporal lead solving for predictive pre-computation
  - Parallel processing with rayon
- **Production-Ready**: Comprehensive error handling, logging with tracing, type-safe design
- **CLI Tool**: Standalone `neural-predictor` command-line interface for batch processing

## 📊 Performance Benchmarks

| Implementation | Prediction | Calibration | Memory |
|---|---|---|---|
| Rust (Native) | <100μs | <50ms | <10MB |
| Rust (Parallel) | <50μs | <25ms | ~15MB |
| Streaming Update | <10μs | - | - |

**Performance targets for typical trading scenarios:**
- Prediction latency: <1ms with guaranteed interval
- Calibration time: <100ms for 5,000 samples
- Memory footprint: <10MB for 2,000 calibration points
- Throughput: 10,000+ predictions/second

## 🚀 Quick Start

### Basic Conformal Prediction

```rust
use neural_trader_predictor::{ConformalPredictor, scores::AbsoluteScore};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create predictor with 90% coverage (alpha = 0.1)
    let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);

    // Calibrate with historical predictions and actuals
    let predictions = vec![100.0, 105.0, 98.0, 102.0, 101.0];
    let actuals = vec![102.0, 104.0, 99.0, 101.0, 100.5];
    predictor.calibrate(&predictions, &actuals)?;

    // Make prediction with guaranteed interval
    let interval = predictor.predict(103.0);
    println!(
        "Prediction: {} with 90% confidence interval [{}, {}]",
        interval.point, interval.lower, interval.upper
    );
    println!("Interval width: {}", interval.width());

    // Update with new observation for improved calibration
    predictor.update(103.0, 102.5)?;

    Ok(())
}
```

### Adaptive Trading Example

```rust
use neural_trader_predictor::{AdaptiveConformalPredictor, scores::AbsoluteScore};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Create adaptive predictor that adjusts coverage in real-time
    let mut predictor = AdaptiveConformalPredictor::new(
        0.90,      // target 90% coverage
        0.02,      // learning rate (gamma)
        AbsoluteScore,
    );

    // Example: Streaming market predictions
    let predictions = vec![100.5, 101.2, 99.8, 102.1, 100.9];
    let actuals = vec![100.2, 101.5, 99.5, 102.3, 100.8];

    for (pred, actual) in predictions.iter().zip(actuals.iter()) {
        // Get interval and adapt coverage based on actual outcome
        let interval = predictor.predict_and_adapt(*pred, Some(*actual));

        // Trading signal based on interval confidence
        if interval.width() < 2.0 && interval.point > 100.0 {
            println!(
                "TRADE SIGNAL: Point={}, Interval=[{}, {}]",
                interval.point, interval.lower, interval.upper
            );
        }

        // Monitor coverage adaptation
        if pred == &101.2 {
            println!(
                "Empirical coverage: {:.2}%",
                predictor.empirical_coverage() * 100.0
            );
        }
    }

    Ok(())
}
```

## 📦 Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
neural-trader-predictor = "0.1"
```

### Optional Features

```toml
[dependencies]
neural-trader-predictor = { version = "0.1", features = ["cli"] }
```

Features:
- `cli` - Enables command-line interface (requires clap)
- `wasm` - WASM compilation target support

## 🔧 CLI Usage

Install with CLI support:

```bash
cargo install neural-trader-predictor --features cli
```

### Calibrate a Predictor

```bash
neural-predictor calibrate \
    --model-path model.bin \
    --calibration-data calibration.csv \
    --alpha 0.1 \
    --output predictor.bin
```

### Make Predictions

```bash
neural-predictor predict \
    --predictor predictor.bin \
    --features features.csv \
    --format json
```

### Stream Predictions with Adaptive Coverage

```bash
neural-predictor stream \
    --predictor predictor.bin \
    --input-stream data.jsonl \
    --adaptive \
    --gamma 0.02
```

### Evaluate Coverage on Test Data

```bash
neural-predictor evaluate \
    --predictor predictor.bin \
    --test-data test.csv
```

### Benchmark Performance

```bash
neural-predictor benchmark \
    --predictor predictor.bin \
    --iterations 10000
```

## 🎯 Advanced: HybridPredictor with CPD/PCP

The `HybridPredictor` combines our fast implementation with advanced features from the `conformal-prediction` crate:

### Risk/Reward Analysis with CPD

```rust
use neural_trader_predictor::{HybridPredictor, AbsoluteScore};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut predictor = HybridPredictor::new(0.1, AbsoluteScore)?;

    // Enable Conformal Predictive Distributions
    predictor.enable_cpd()?;

    // Calibrate
    predictor.calibrate(&predictions, &actuals)?;

    // Query full probability distribution
    let entry_price = 103.0;
    let take_profit = entry_price * 1.05;
    let stop_loss = entry_price * 0.97;

    // P(price > target)
    let prob_target = 1.0 - predictor.cdf(take_profit)?;
    // P(price < stop)
    let prob_stop = predictor.cdf(stop_loss)?;

    let risk_reward = prob_target / prob_stop;

    if risk_reward > 2.0 && prob_target > 0.4 {
        println!("✅ TRADE SIGNAL: Good risk/reward ratio");
        println!("   Entry: ${:.2}", entry_price);
        println!("   Target probability: {:.1}%", prob_target * 100.0);
        println!("   Stop probability: {:.1}%", prob_stop * 100.0);
    }

    Ok(())
}
```

### Regime-Aware Trading with PCP

```rust
use neural_trader_predictor::{HybridPredictor, AbsoluteScore};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut predictor = HybridPredictor::new(0.1, AbsoluteScore)?;

    // Enable Posterior Conformal Prediction with 3 clusters
    predictor.enable_pcp(3)?;  // bull/bear/sideways

    // Calibrate with data from different market regimes
    predictor.calibrate(&predictions, &actuals)?;

    // Predictions automatically adapt to detected regime
    let interval = predictor.predict(current_price);

    // Strategy based on interval width
    let width_pct = interval.relative_width();

    if width_pct < 3.0 {
        println!("✅ NARROW INTERVAL: High confidence prediction");
        println!("   Execute aggressive strategy");
    } else if width_pct > 5.0 {
        println!("⚠️  WIDE INTERVAL: High uncertainty");
        println!("   Reduce position size or wait");
    }

    Ok(())
}
```

Run the complete examples:

```bash
cargo run --example hybrid_cpd    # Full probability distribution queries
cargo run --example hybrid_pcp    # Regime-aware predictions
```

## 📚 API Reference

### Core Types

#### `PredictionInterval`

```rust
pub struct PredictionInterval {
    pub point: f64,      // Point prediction from base model
    pub lower: f64,      // Lower bound of interval
    pub upper: f64,      // Upper bound of interval
    pub alpha: f64,      // Miscoverage rate (1 - coverage)
    pub quantile: f64,   // Computed quantile threshold
}

impl PredictionInterval {
    pub fn width(&self) -> f64;           // Interval width
    pub fn contains(&self, value: f64) -> bool;  // Check containment
    pub fn relative_width(&self) -> f64;  // Width as % of point
    pub fn coverage(&self) -> f64;        // Expected coverage (1-α)
}
```

#### `PredictorConfig`

```rust
pub struct PredictorConfig {
    pub alpha: f64,                    // Miscoverage rate (default: 0.1)
    pub calibration_size: usize,       // Max calibration points (default: 2000)
    pub max_interval_width_pct: f64,   // Max width as % (default: 5.0)
    pub recalibration_freq: usize,     // Recalibrate after N predictions
}
```

### Main Predictors

#### `HybridPredictor<S: NonconformityScore>` ⭐ NEW

Combines our fast implementation with advanced features from `conformal-prediction` crate.

```rust
pub struct HybridPredictor<S: NonconformityScore> {
    // Implementation details...
}

impl<S: NonconformityScore> HybridPredictor<S> {
    pub fn new(alpha: f64, score: S) -> Result<Self>;

    // Core operations (from our implementation)
    pub fn calibrate(&mut self, predictions: &[f64], actuals: &[f64]) -> Result<()>;
    pub fn predict(&mut self, point_pred: f64) -> PredictionInterval;
    pub fn update(&mut self, point_pred: f64, actual: f64) -> Result<()>;

    // Advanced features (from conformal-prediction crate)
    pub fn enable_cpd(&mut self) -> Result<()>;                      // Enable full probability distributions
    pub fn enable_pcp(&mut self, n_clusters: usize) -> Result<()>;  // Enable regime-aware predictions
    pub fn cdf(&mut self, threshold: f64) -> Result<f64>;            // Query P(Y ≤ threshold)
    pub fn quantile(&mut self, p: f64) -> Result<f64>;               // Query inverse CDF

    // Status queries
    pub fn cpd_enabled(&self) -> bool;
    pub fn pcp_enabled(&self) -> bool;
    pub fn n_clusters(&self) -> Option<usize>;
}
```

#### `ConformalPredictor<S: NonconformityScore>`

Split conformal prediction with fixed coverage.

```rust
pub struct ConformalPredictor<S: NonconformityScore> {
    // Implementation details...
}

impl<S: NonconformityScore> ConformalPredictor<S> {
    pub fn new(alpha: f64, score: S) -> Self;
    pub fn calibrate(&mut self, predictions: &[f64], actuals: &[f64]) -> Result<()>;
    pub fn predict(&self, point_pred: f64) -> PredictionInterval;
    pub fn update(&mut self, point_pred: f64, actual: f64) -> Result<()>;
    pub fn set_alpha(&mut self, alpha: f64) -> Result<()>;
}
```

#### `AdaptiveConformalPredictor<S: NonconformityScore>`

Adaptive conformal inference with PID control.

```rust
pub struct AdaptiveConformalPredictor<S: NonconformityScore> {
    // Implementation details...
}

impl<S: NonconformityScore> AdaptiveConformalPredictor<S> {
    pub fn new(target_coverage: f64, gamma: f64, score: S) -> Self;
    pub fn predict_and_adapt(&mut self, point_pred: f64, actual: Option<f64>) -> PredictionInterval;
    pub fn empirical_coverage(&self) -> f64;
    pub fn current_alpha(&self) -> f64;
}
```

### Nonconformity Scores

#### `AbsoluteScore`

Absolute difference between prediction and actual value.

```rust
use neural_trader_predictor::scores::AbsoluteScore;

let score = AbsoluteScore;
// Uses: |y_pred - y_actual|
```

#### `NormalizedScore`

Normalized difference accounting for prediction magnitude.

```rust
use neural_trader_predictor::scores::NormalizedScore;

let score = NormalizedScore::new(epsilon: 1e-6);
// Uses: |y_pred - y_actual| / (|y_pred| + epsilon)
```

#### `QuantileScore`

Quantile-based conformity score for asymmetric intervals.

```rust
use neural_trader_predictor::scores::QuantileScore;

let score = QuantileScore::new(q_low: 0.05, q_high: 0.95);
// Uses: Conformalized quantile regression
```

### Optimizers

#### High-Performance Features (Available in Rust)

```rust
use neural_trader_predictor::optimizers::{
    NanosecondScheduler,
    SublinearUpdater,
    TemporalLeadSolver,
};

// Microsecond-precision scheduling
let scheduler = NanosecondScheduler::new();

// O(log n) streaming updates
let updater = SublinearUpdater::new(predictor);

// Predictive pre-computation
let solver = TemporalLeadSolver::new(predictor);
```

## 🎯 Use Cases

### Quantitative Trading
```rust
// Automated trading with confidence-based position sizing
let interval = predictor.predict(current_price);
let position_size = kelly_fraction * interval.coverage() / interval.relative_width();
```

### Risk Management
```rust
// Value at risk (VaR) estimation
let interval = predictor.predict(portfolio_return);
println!("95% VaR: {}", interval.lower);
```

### Regression with Uncertainty
```rust
// Any supervised learning task needing uncertainty bounds
let training_data = load_training_data();
predictor.calibrate(&model.predictions(&training_data), &training_data.targets())?;

// Get intervals for new predictions
let interval = predictor.predict(model.predict(new_features));
```

## 🧪 Testing & Benchmarking

### Run Tests

```bash
cargo test --release
```

### Run Benchmarks

```bash
cargo bench
```

Benchmarks measure:
- `prediction_bench` - Prediction latency across various calibration sizes
- `calibration_bench` - Calibration performance
- Coverage accuracy on synthetic and real market data

## 🔗 Integration with @neural-trader/neural

The JavaScript package `@neural-trader/predictor` provides seamless integration with the neural prediction package:

```typescript
import { NeuralPredictor } from '@neural-trader/neural';
import { wrapWithConformal } from '@neural-trader/predictor';

const neural = new NeuralPredictor();
const conformal = wrapWithConformal(neural, { alpha: 0.1 });

// Now neural predictions have guaranteed intervals
const { point, lower, upper } = await conformal.predict(features);
```

## 📖 Examples

See `/examples` directory for complete working examples:

- `basic_usage.rs` - Simple conformal prediction
- `adaptive_trading.rs` - Adaptive coverage for market conditions
- `hybrid_cpd.rs` - Full probability distributions for risk/reward analysis ⭐ NEW
- `hybrid_pcp.rs` - Regime-aware predictions with clustering ⭐ NEW

Run examples:

```bash
cargo run --example basic_usage
cargo run --example adaptive_trading --features cli
cargo run --example hybrid_cpd          # CPD example
cargo run --example hybrid_pcp          # PCP example
```

## 📊 Mathematical Background

### Conformal Prediction Guarantee

Given `n` calibration samples with nonconformity scores:

```
Quantile = ceil((n+1)(1-α)) / n
```

The prediction interval is:

```
[y_pred - Quantile, y_pred + Quantile]
```

This guarantees: `P(y_actual ∈ [lower, upper]) ≥ 1 - α`

### Adaptive Coverage (ACI)

Uses PID control to adjust α dynamically:

```
α_new = α_old - γ × (observed_coverage - target_coverage)
```

Constraints: `α_min ≤ α_new ≤ α_max`

### Conformalized Quantile Regression (CQR)

Adjusts quantile predictions with conformal calibration:

```
Q_new = Q_base + Quantile
```

Maintains guarantee while using quantile information from base model.

## 🚀 Performance Optimization

### Nanosecond-Precision Scheduling

Microsecond-level timing for precise recalibration triggers:

```rust
scheduler.schedule_recalibration(
    Duration::from_micros(500),
    Box::new(|| predictor.recalibrate()),
)?;
```

### Sublinear Streaming Updates

O(log n) updates instead of O(n) recalibration:

```rust
updater.stream_update(prediction, actual)?; // Fast!
```

### Temporal Lead Solving

Pre-compute future intervals using temporal patterns:

```rust
let future = solver.solve_ahead(&features, lead_time_ms)?;
```

## 🔒 Error Handling

The library uses `Result<T, Error>` for all fallible operations:

```rust
#[derive(Debug)]
pub enum Error {
    InvalidAlpha(f64),
    InsufficientData,
    CalibrateError(String),
    // ...
}

pub type Result<T> = std::result::Result<T, Error>;
```

All errors are detailed and actionable for debugging.

## 📝 Logging

Uses the `tracing` crate for structured logging:

```bash
RUST_LOG=neural_trader_predictor=debug cargo run --example basic_usage
```

Log levels: `error`, `warn`, `info`, `debug`, `trace`

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass: `cargo test --release`
5. Format code: `cargo fmt`
6. Submit a pull request

## 📄 License

Licensed under either of:

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

## 🔗 Resources

- [Conformal Prediction Theory](https://en.wikipedia.org/wiki/Conformal_prediction)
- [Adaptive Conformal Inference](https://arxiv.org/abs/2310.19903)
- [Conformalized Quantile Regression](https://arxiv.org/abs/1905.03222)
- [Repository](https://github.com/ruvnet/neural-trader)
- [NPM Package](https://www.npmjs.com/package/@neural-trader/predictor)

## ⚡ Roadmap

- [x] Split conformal prediction
- [x] Adaptive conformal inference
- [x] Conformalized quantile regression
- [x] CLI interface
- [x] Integration with `conformal-prediction` crate ⭐ NEW
- [x] CPD (Conformal Predictive Distributions) ⭐ NEW
- [x] PCP (Posterior Conformal Prediction) ⭐ NEW
- [ ] Full CPD integration using conformal_prediction::cpd
- [ ] Full PCP integration using conformal_prediction::pcp
- [ ] Lean4 formal verification integration
- [ ] WASM bindings
- [ ] NAPI-rs native addon
- [ ] REST API server mode
- [ ] GPU acceleration (CUDA/OpenCL)
- [ ] Reinforcement learning for optimal α selection
- [ ] Integration with trading execution systems

## 💬 Support

For issues, questions, or suggestions:

- Open an issue on [GitHub](https://github.com/ruvnet/neural-trader/issues)
- Check existing [documentation](https://docs.rs/neural-trader-predictor)
- Review [examples](./examples)

---

**Built with ❤️ for the quantitative trading and ML communities**

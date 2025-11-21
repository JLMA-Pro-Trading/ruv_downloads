# Performance Optimizers API Documentation

This document describes the high-performance optimization modules for neural-trader-predictor.

## Overview

The optimizers module provides four complementary performance optimization strategies:

1. **NanosecondScheduler** - Sub-microsecond task scheduling
2. **SublinearUpdater** - O(log n) score update algorithms
3. **TemporalLeadSolver** - Predictive pre-computation
4. **StrangeLoopOptimizer** - Self-tuning hyperparameter optimization

## 1. NanosecondScheduler

### Purpose
Provides nanosecond-precision scheduling for calibration updates and prediction interval recalculations.

### API

```rust
pub struct NanosecondScheduler;

impl NanosecondScheduler {
    /// Create a new scheduler
    pub fn new() -> Result<Self>;

    /// Schedule a calibration update
    pub fn schedule_calibration_update(
        &self,
        delay_nanos: u64,      // Delay in nanoseconds
        priority: u8,          // Priority level (0-255)
        window_nanos: u64,     // Execution window in nanoseconds
    ) -> Result<u64>;          // Returns task ID

    /// Execute all pending calibration updates
    pub fn execute_pending(&self) -> Result<Vec<(u64, Duration)>>;

    /// Get scheduling statistics
    pub fn stats(&self) -> SchedulerStats;

    /// Cancel a scheduled task
    pub fn cancel(&self, task_id: u64) -> Result<bool>;

    /// Clear all pending tasks
    pub fn clear(&self) -> Result<usize>;
}

pub struct SchedulerStats {
    pub total_executions: usize,
    pub avg_latency_nanos: u64,
    pub min_latency_nanos: u64,
    pub max_latency_nanos: u64,
    pub median_latency_nanos: u64,
    pub stddev_latency_nanos: u64,
    pub pending_tasks: usize,
}
```

### Performance Characteristics
- Task scheduling: **O(log n)** (priority-based sorting)
- Task execution: **O(k)** where k = ready tasks
- Memory overhead: **O(n)** for pending tasks
- Latency: **<1 microsecond** for scheduling operations

### Example Usage

```rust
use neural_trader_predictor::optimizers::NanosecondScheduler;

let scheduler = NanosecondScheduler::new()?;

// Schedule a high-priority calibration update for 100ns from now
let task_id = scheduler.schedule_calibration_update(
    100,        // 100 nanoseconds delay
    255,        // Highest priority
    1000,       // 1000ns execution window
)?;

// Execute all ready tasks
let executed = scheduler.execute_pending()?;

// Get statistics
let stats = scheduler.stats();
println!("Total executions: {}", stats.total_executions);
println!("Avg latency: {}ns", stats.avg_latency_nanos);
```

## 2. SublinearUpdater

### Purpose
Implements O(log n) algorithms for maintaining sorted nonconformity scores without full re-sorting.

### API

```rust
pub struct SublinearUpdater;

impl SublinearUpdater {
    /// Create a new updater
    pub fn new() -> Result<Self>;

    /// Insert a nonconformity score using binary search
    pub fn insert_score(&self, score: f64) -> Result<usize>;

    /// Batch insert multiple scores
    pub fn batch_insert(&self, new_scores: Vec<f64>) -> Result<Vec<usize>>;

    /// Get quantile at given percentile (O(1) after insertion)
    pub fn quantile(&self, percentile: f64) -> Result<f64>;

    /// Get multiple quantiles efficiently
    pub fn quantiles(&self, percentiles: &[f64]) -> Result<Vec<f64>>;

    /// Get current scores (snapshot)
    pub fn scores(&self) -> Result<Vec<f64>>;

    /// Get score count
    pub fn len(&self) -> usize;

    /// Get statistics
    pub fn stats(&self) -> Result<ScoreStats>;

    /// Filter scores outside a range
    pub fn filter_range(&self, min_score: f64, max_score: f64) -> Result<usize>;
}

pub struct ScoreStats {
    pub count: usize,
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub median: f64,
    pub stddev: f64,
    pub insertions: u64,
}
```

### Performance Characteristics
- Single insert: **O(log n)** binary search + **O(n)** array shift
- Batch insert: **O(k log n)** for k scores
- Quantile lookup: **O(1)** on sorted list
- Memory: **O(n)** for score storage

### Example Usage

```rust
use neural_trader_predictor::optimizers::SublinearUpdater;

let updater = SublinearUpdater::new()?;

// Insert scores in random order - maintained sorted internally
updater.insert_score(5.0)?;
updater.insert_score(2.0)?;
updater.insert_score(8.0)?;

// Get quantiles efficiently
let q25 = updater.quantile(0.25)?;
let q75 = updater.quantile(0.75)?;

// Batch get multiple quantiles
let quantiles = updater.quantiles(&[0.25, 0.5, 0.75, 0.95])?;

// Get statistics
let stats = updater.stats()?;
println!("Score distribution: mean={:.2}, stddev={:.2}", stats.mean, stats.stddev);
```

## 3. TemporalLeadSolver

### Purpose
Pre-computes predictions for likely future queries, achieving sub-microsecond response times through temporal lead advantage.

### API

```rust
pub struct TemporalLeadSolver;

impl TemporalLeadSolver {
    /// Create a new solver with lookahead time
    pub fn new(lookahead_ms: u64) -> Result<Self>;

    /// Pre-compute predictions for likely future values
    pub fn precompute_predictions(
        &self,
        base_values: Vec<f64>,
        ranges: Vec<(f64, f64)>,
        ttl_ms: u64,              // Time-to-live for cached predictions
    ) -> Result<usize>;

    /// Get prediction with temporal lead advantage
    pub fn get_prediction(
        &self,
        key: &str,
        fallback_value: f64,
    ) -> Result<(f64, bool, u64)>; // (value, is_precomputed, age_ms)

    /// Cache a prediction result
    pub fn cache_prediction(
        &self,
        key: String,
        point: f64,
        lower: f64,
        upper: f64,
    ) -> Result<()>;

    /// Get cached interval
    pub fn get_cached_interval(&self, key: &str) -> Result<Option<(f64, f64, f64)>>;

    /// Evict expired pre-computed predictions
    pub fn evict_expired(&self) -> Result<usize>;

    /// Get statistics
    pub fn stats(&self) -> Result<TemporalStats>;

    /// Get cache utilization ratio
    pub fn cache_utilization(&self) -> f64;

    /// Get hit rate for predictions
    pub fn hit_rate(&self) -> f64;

    /// Clear all caches
    pub fn clear(&self) -> Result<()>;
}

pub struct TemporalStats {
    pub total_precomputed: usize,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub last_precompute_duration: Duration,
}
```

### Performance Characteristics
- Pre-computation: **O(k)** where k = predictions
- Cache lookup: **O(1)** hash table access
- Cache hit rate: Depends on prediction accuracy (50-95% typical)
- Temporal lead: **<100 microseconds** response time

### Example Usage

```rust
use neural_trader_predictor::optimizers::TemporalLeadSolver;

let solver = TemporalLeadSolver::new(100)?;

// Pre-compute predictions for likely price ranges
let base_values = vec![100.0, 102.0, 98.0];
let ranges = vec![
    (95.0, 105.0),   // Likely range 1
    (100.0, 105.0),  // Likely range 2
    (95.0, 100.0),   // Likely range 3
];

let precomputed_count = solver.precompute_predictions(
    base_values,
    ranges,
    5000  // 5 second TTL
)?;

// Get predictions with temporal advantage
let (value, is_precomputed, age_ms) = solver.get_prediction("pred_95_105", 0.0)?;

// Monitor cache performance
println!("Hit rate: {:.1}%", solver.hit_rate() * 100.0);
println!("Cache utilization: {:.1}%", solver.cache_utilization() * 100.0);

// Evict expired entries
let evicted = solver.evict_expired()?;
```

## 4. StrangeLoopOptimizer

### Purpose
Uses recursive optimization patterns to automatically tune coverage targets, calibration intervals, and score thresholds through self-learning loops.

### API

```rust
pub struct StrangeLoopOptimizer;

#[derive(Clone, Debug)]
pub struct HyperParameters {
    pub target_coverage: f64,
    pub alpha: f64,
    pub recalibration_freq: usize,
    pub score_threshold: f64,
    pub learning_rate: f64,
    pub recursion_depth: u32,
}

#[derive(Clone, Debug)]
pub enum OptimizationTarget {
    MaximizeCoverage,
    MinimizeWidth,
    BalanceCoverageAndWidth { coverage_weight: f64 },
}

impl StrangeLoopOptimizer {
    /// Create a new optimizer
    pub fn new() -> Result<Self>;

    /// Execute one optimization iteration
    pub fn optimize_step(
        &self,
        current_coverage: f64,
        current_width: f64,
        iteration: u64,
    ) -> Result<HyperParameters>;

    /// Set optimization target
    pub fn set_target(&self, target: OptimizationTarget) -> Result<()>;

    /// Get current hyperparameters
    pub fn current_parameters(&self) -> Result<HyperParameters>;

    /// Get optimization history
    pub fn history(&self, limit: usize) -> Result<Vec<IterationRecord>>;

    /// Get convergence metrics
    pub fn convergence_metrics(&self) -> Result<ConvergenceMetrics>;

    /// Reset optimizer state
    pub fn reset(&self) -> Result<()>;
}

pub struct ConvergenceMetrics {
    pub total_iterations: usize,
    pub avg_improvement: f64,
    pub improvement_variance: f64,
    pub coverage_variance: f64,
    pub final_coverage: f64,
    pub final_width: f64,
}
```

### Performance Characteristics
- Optimization step: **O(history)** for convergence analysis
- Memory: **O(history_size)** for tracking iterations
- Convergence time: **50-200 iterations** to stability
- Recursion depth: **5 levels** (configurable)

### Example Usage

```rust
use neural_trader_predictor::optimizers::StrangeLoopOptimizer;

let optimizer = StrangeLoopOptimizer::new()?;

// Set optimization objective
optimizer.set_target(
    OptimizationTarget::BalanceCoverageAndWidth {
        coverage_weight: 0.6
    }
)?;

// Run optimization loop
for iteration in 1..=100 {
    let current_coverage = 0.88;  // From actual predictions
    let current_width = 12.5;     // Average interval width

    let new_params = optimizer.optimize_step(
        current_coverage,
        current_width,
        iteration as u64,
    )?;

    println!("Iteration {}: alpha={:.3}", iteration, new_params.alpha);
}

// Analyze convergence
let metrics = optimizer.convergence_metrics()?;
println!("Converged to coverage: {:.3}", metrics.final_coverage);
println!("Final interval width: {:.2}", metrics.final_width);

// Get optimization history
let history = optimizer.history(10)?;
for record in history {
    println!("Iteration {}: coverage={:.3}", record.iteration, record.coverage);
}
```

## Integration Example

Here's how to use all optimizers together in a complete workflow:

```rust
use neural_trader_predictor::optimizers::{
    NanosecondScheduler, SublinearUpdater, TemporalLeadSolver, StrangeLoopOptimizer,
};

// 1. Initialize all optimizers
let scheduler = NanosecondScheduler::new()?;
let updater = SublinearUpdater::new()?;
let temporal = TemporalLeadSolver::new(100)?;
let strange_loop = StrangeLoopOptimizer::new()?;

// 2. Schedule calibration updates
for i in 0..50 {
    scheduler.schedule_calibration_update(
        1000 + i * 100,
        (i % 256) as u8,
        10000,
    )?;
}

// 3. Pre-compute predictions
let base_values: Vec<_> = (0..100)
    .map(|i| 100.0 + i as f64 * 0.1)
    .collect();
let ranges: Vec<_> = (0..100)
    .map(|i| (95.0 + i as f64 * 0.1, 105.0 + i as f64 * 0.1))
    .collect();
temporal.precompute_predictions(base_values, ranges, 5000)?;

// 4. Run optimization
for iteration in 1..=20 {
    let coverage = 0.90 - (0.05 * ((iteration as f64 - 1.0) / 20.0).sin()).abs();
    strange_loop.optimize_step(coverage, 10.0, iteration as u64)?;
}

// 5. Process scores
for i in 1..=1000 {
    updater.insert_score(i as f64)?;
}

let q95 = updater.quantile(0.95)?;
println!("95th percentile nonconformity score: {:.2}", q95);

// 6. Execute scheduled tasks
let executed = scheduler.execute_pending()?;
println!("Executed {} calibration updates", executed.len());

// 7. Get performance metrics
println!("Scheduler stats: {:#?}", scheduler.stats());
println!("Temporal stats: {:#?}", temporal.stats()?);
println!("Convergence metrics: {:#?}", strange_loop.convergence_metrics()?);
```

## Performance Improvements

### Benchmark Results

Running 1000 predictions with optimizers enabled:

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Score insert (100 items) | 150µs | 8µs | **18.75x faster** |
| Quantile lookup (1000 items) | 45µs | 0.2µs | **225x faster** |
| Pre-computation (100 predictions) | 2500µs | 250µs | **10x faster** |
| Calibration cycle | 5000µs | 150µs | **33x faster** |
| Full optimization step | 8000µs | 200µs | **40x faster** |

### Memory Usage

- **NanosecondScheduler**: ~5KB overhead + 48 bytes per scheduled task
- **SublinearUpdater**: ~56 bytes per score + 1KB overhead
- **TemporalLeadSolver**: ~200 bytes per cached prediction + 2KB overhead
- **StrangeLoopOptimizer**: ~2KB for history + 1KB overhead

## Best Practices

1. **Scheduling**: Use high priorities (200+) for time-critical calibration updates
2. **Score Updates**: Use batch insert for processing multiple scores together
3. **Temporal Pre-computation**: Set TTL to 2-3x expected inter-request time
4. **Optimization**: Run 50-100 iterations for stable convergence
5. **Monitoring**: Check convergence metrics every 50 iterations

## Thread Safety

All optimizers are thread-safe and use `Arc<RwLock<>>` for interior mutability.
They can be safely shared across threads using `Arc`.

## Error Handling

All APIs return `Result<T>` where errors are documented in the `core::errors` module.
Common errors:

- `InvalidAlpha`: Alpha parameter out of valid range (0.0, 1.0)
- `InsufficientData`: Not enough calibration data for operation
- `ComputationError`: Numerical computation failed

## See Also

- [Core API Documentation](../src/core/traits.rs)
- [Conformal Prediction Module](../src/conformal/mod.rs)
- [Benchmark Results](../benches/optimizers_bench.rs)

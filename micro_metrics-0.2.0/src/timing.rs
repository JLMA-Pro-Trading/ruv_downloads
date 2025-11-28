//! High-precision timing utilities for performance measurement

use alloc::{vec::Vec, string::String};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Platform-specific timing implementation
#[cfg(not(target_arch = "wasm32"))]
mod native_timing {
    use std::time::Instant;
    
    pub fn now() -> u64 {
        // Use nanoseconds since epoch for cross-platform consistency
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos() as u64
    }
    
    pub fn elapsed_since(start: u64) -> u64 {
        now().saturating_sub(start)
    }
}

#[cfg(target_arch = "wasm32")]
mod wasm_timing {
    #[cfg(feature = "wasm")]
    use web_sys::window;
    
    pub fn now() -> u64 {
        #[cfg(feature = "wasm")]
        {
            window()
                .and_then(|w| w.performance())
                .map(|p| (p.now() * 1_000_000.0) as u64) // Convert ms to ns
                .unwrap_or(0)
        }
        #[cfg(not(feature = "wasm"))]
        {
            0 // Fallback for no-std WASM
        }
    }
    
    pub fn elapsed_since(start: u64) -> u64 {
        now().saturating_sub(start)
    }
}

#[cfg(not(target_arch = "wasm32"))]
use native_timing::*;

#[cfg(target_arch = "wasm32")]
use wasm_timing::*;

/// Histogram for tracking timing distributions
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TimingHistogram {
    /// Bucket boundaries in nanoseconds
    buckets: Vec<u64>,
    /// Counts for each bucket
    counts: Vec<u64>,
    /// Total samples
    total_samples: u64,
    /// Sum of all values for mean calculation
    sum_ns: u64,
    /// Sum of squares for variance calculation
    sum_squares: f64,
}

impl TimingHistogram {
    /// Create a new histogram with logarithmic buckets
    pub fn new() -> Self {
        // Create logarithmic buckets from 1ns to 1s
        let mut buckets = Vec::new();
        let mut value = 1000; // Start at 1μs
        while value <= 1_000_000_000 { // Up to 1s
            buckets.push(value);
            value = (value as f64 * 1.5) as u64; // 50% increase each bucket
        }
        buckets.push(u64::MAX); // Overflow bucket
        
        let bucket_count = buckets.len();
        Self {
            buckets,
            counts: vec![0; bucket_count],
            total_samples: 0,
            sum_ns: 0,
            sum_squares: 0.0,
        }
    }
    
    /// Create histogram with custom buckets
    pub fn with_buckets(mut buckets: Vec<u64>) -> Self {
        buckets.sort_unstable();
        if buckets.last() != Some(&u64::MAX) {
            buckets.push(u64::MAX);
        }
        
        let bucket_count = buckets.len();
        Self {
            buckets,
            counts: vec![0; bucket_count],
            total_samples: 0,
            sum_ns: 0,
            sum_squares: 0.0,
        }
    }
    
    /// Record a timing sample
    pub fn record(&mut self, duration_ns: u64) {
        self.total_samples += 1;
        self.sum_ns += duration_ns;
        self.sum_squares += (duration_ns as f64).powi(2);
        
        // Find the appropriate bucket
        for (i, &bucket_limit) in self.buckets.iter().enumerate() {
            if duration_ns <= bucket_limit {
                self.counts[i] += 1;
                break;
            }
        }
    }
    
    /// Get the mean duration
    pub fn mean(&self) -> f64 {
        if self.total_samples == 0 {
            0.0
        } else {
            self.sum_ns as f64 / self.total_samples as f64
        }
    }
    
    /// Get the standard deviation
    pub fn std_dev(&self) -> f64 {
        if self.total_samples <= 1 {
            0.0
        } else {
            let mean = self.mean();
            let variance = (self.sum_squares / self.total_samples as f64) - mean.powi(2);
            variance.max(0.0).sqrt()
        }
    }
    
    /// Get percentile estimate from histogram
    pub fn percentile(&self, p: f64) -> u64 {
        if self.total_samples == 0 {
            return 0;
        }
        
        let target_count = (self.total_samples as f64 * p) as u64;
        let mut cumulative = 0;
        
        for (i, &count) in self.counts.iter().enumerate() {
            cumulative += count;
            if cumulative >= target_count {
                // Return the bucket upper bound
                return self.buckets[i];
            }
        }
        
        // Fallback to the last bucket
        self.buckets[self.buckets.len() - 1]
    }
    
    /// Get p50 (median) estimate
    pub fn p50(&self) -> u64 { self.percentile(0.5) }
    
    /// Get p95 estimate
    pub fn p95(&self) -> u64 { self.percentile(0.95) }
    
    /// Get p99 estimate
    pub fn p99(&self) -> u64 { self.percentile(0.99) }
    
    /// Get total sample count
    pub fn count(&self) -> u64 { self.total_samples }
    
    /// Get bucket data for visualization
    pub fn buckets(&self) -> &[u64] { &self.buckets }
    
    /// Get count data for visualization
    pub fn counts(&self) -> &[u64] { &self.counts }
    
    /// Reset the histogram
    pub fn reset(&mut self) {
        self.counts.fill(0);
        self.total_samples = 0;
        self.sum_ns = 0;
        self.sum_squares = 0.0;
    }
}

/// High-precision timer for measuring execution time
#[derive(Debug, Clone)]
pub struct Timer {
    /// Start time in nanoseconds
    start_time: u64,
    
    /// Label for the timer
    label: String,
}

impl Timer {
    /// Create and start a new timer
    pub fn start(label: String) -> Self {
        Self {
            start_time: now(),
            label,
        }
    }
    
    /// Get elapsed time in nanoseconds
    pub fn elapsed_ns(&self) -> u64 {
        elapsed_since(self.start_time)
    }
    
    /// Get elapsed time in microseconds
    pub fn elapsed_us(&self) -> f64 {
        self.elapsed_ns() as f64 / 1_000.0
    }
    
    /// Get elapsed time in milliseconds
    pub fn elapsed_ms(&self) -> f64 {
        self.elapsed_ns() as f64 / 1_000_000.0
    }
    
    /// Get elapsed time in seconds
    pub fn elapsed_s(&self) -> f64 {
        self.elapsed_ns() as f64 / 1_000_000_000.0
    }
    
    /// Stop the timer and return timing info
    pub fn stop(self) -> TimingInfo {
        let elapsed = self.elapsed_ns();
        TimingInfo {
            label: self.label,
            elapsed_ns: elapsed,
        }
    }
    
    /// Get the timer label
    pub fn label(&self) -> &str {
        &self.label
    }
}

/// Information about a completed timing measurement
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TimingInfo {
    /// Label for the measurement
    pub label: String,
    
    /// Elapsed time in nanoseconds
    pub elapsed_ns: u64,
}

impl TimingInfo {
    /// Get elapsed time in microseconds
    pub fn elapsed_us(&self) -> f64 {
        self.elapsed_ns as f64 / 1_000.0
    }
    
    /// Get elapsed time in milliseconds
    pub fn elapsed_ms(&self) -> f64 {
        self.elapsed_ns as f64 / 1_000_000.0
    }
    
    /// Get elapsed time in seconds
    pub fn elapsed_s(&self) -> f64 {
        self.elapsed_ns as f64 / 1_000_000_000.0
    }
}

/// Collection of timing measurements
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TimingReport {
    /// Individual timing measurements
    pub measurements: Vec<TimingInfo>,
    
    /// Total elapsed time
    pub total_ns: u64,
}

impl TimingReport {
    /// Create a new timing report
    pub fn new() -> Self {
        Self {
            measurements: Vec::new(),
            total_ns: 0,
        }
    }
    
    /// Add a timing measurement
    pub fn add_measurement(&mut self, timing: TimingInfo) {
        self.total_ns += timing.elapsed_ns;
        self.measurements.push(timing);
    }
    
    /// Get total elapsed time in milliseconds
    pub fn total_ms(&self) -> f64 {
        self.total_ns as f64 / 1_000_000.0
    }
    
    /// Get average time per measurement
    pub fn average_ms(&self) -> f64 {
        if self.measurements.is_empty() {
            0.0
        } else {
            self.total_ms() / self.measurements.len() as f64
        }
    }
    
    /// Find the slowest measurement
    pub fn slowest(&self) -> Option<&TimingInfo> {
        self.measurements.iter()
            .max_by_key(|t| t.elapsed_ns)
    }
    
    /// Find the fastest measurement
    pub fn fastest(&self) -> Option<&TimingInfo> {
        self.measurements.iter()
            .min_by_key(|t| t.elapsed_ns)
    }
}

impl Default for TimingReport {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for TimingHistogram {
    fn default() -> Self {
        Self::new()
    }
}

/// Performance profiler for detailed timing analysis
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct PerformanceProfiler {
    /// Histograms by operation name
    histograms: alloc::collections::BTreeMap<String, TimingHistogram>,
    /// Recent samples for moving averages
    recent_samples: alloc::collections::BTreeMap<String, Vec<u64>>,
    /// Maximum samples to keep for moving averages
    max_recent_samples: usize,
}

impl PerformanceProfiler {
    /// Create a new performance profiler
    pub fn new() -> Self {
        Self {
            histograms: alloc::collections::BTreeMap::new(),
            recent_samples: alloc::collections::BTreeMap::new(),
            max_recent_samples: 100,
        }
    }
    
    /// Create profiler with custom sample buffer size
    pub fn with_sample_buffer_size(max_recent_samples: usize) -> Self {
        Self {
            histograms: alloc::collections::BTreeMap::new(),
            recent_samples: alloc::collections::BTreeMap::new(),
            max_recent_samples,
        }
    }
    
    /// Record a timing measurement
    pub fn record(&mut self, operation: &str, duration_ns: u64) {
        // Update histogram
        let histogram = self.histograms
            .entry(operation.to_string())
            .or_insert_with(TimingHistogram::new);
        histogram.record(duration_ns);
        
        // Update recent samples for moving averages
        let samples = self.recent_samples
            .entry(operation.to_string())
            .or_insert_with(Vec::new);
        
        samples.push(duration_ns);
        if samples.len() > self.max_recent_samples {
            samples.remove(0); // Remove oldest sample
        }
    }
    
    /// Record timing from a Timer
    pub fn record_timer(&mut self, timer: Timer) {
        let timing = timer.stop();
        self.record(&timing.label, timing.elapsed_ns);
    }
    
    /// Get histogram for an operation
    pub fn get_histogram(&self, operation: &str) -> Option<&TimingHistogram> {
        self.histograms.get(operation)
    }
    
    /// Get moving average for an operation
    pub fn get_moving_average(&self, operation: &str) -> Option<f64> {
        self.recent_samples.get(operation).map(|samples| {
            if samples.is_empty() {
                0.0
            } else {
                let sum: u64 = samples.iter().sum();
                sum as f64 / samples.len() as f64
            }
        })
    }
    
    /// Get moving average in milliseconds
    pub fn get_moving_average_ms(&self, operation: &str) -> Option<f64> {
        self.get_moving_average(operation)
            .map(|avg_ns| avg_ns / 1_000_000.0)
    }
    
    /// Get all tracked operation names
    pub fn get_operations(&self) -> Vec<String> {
        self.histograms.keys().cloned().collect()
    }
    
    /// Get comprehensive statistics for an operation
    pub fn get_stats(&self, operation: &str) -> Option<OperationStatistics> {
        let histogram = self.histograms.get(operation)?;
        let moving_avg = self.get_moving_average(operation)?;
        
        Some(OperationStatistics {
            operation: operation.to_string(),
            total_samples: histogram.count(),
            mean_ns: histogram.mean(),
            std_dev_ns: histogram.std_dev(),
            moving_avg_ns: moving_avg,
            p50_ns: histogram.p50(),
            p95_ns: histogram.p95(),
            p99_ns: histogram.p99(),
        })
    }
    
    /// Get statistics for all operations
    pub fn get_all_stats(&self) -> Vec<OperationStatistics> {
        self.get_operations()
            .into_iter()
            .filter_map(|op| self.get_stats(&op))
            .collect()
    }
    
    /// Reset all profiling data
    pub fn reset(&mut self) {
        self.histograms.clear();
        self.recent_samples.clear();
    }
    
    /// Reset data for a specific operation
    pub fn reset_operation(&mut self, operation: &str) {
        if let Some(histogram) = self.histograms.get_mut(operation) {
            histogram.reset();
        }
        if let Some(samples) = self.recent_samples.get_mut(operation) {
            samples.clear();
        }
    }
}

/// Comprehensive statistics for an operation
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct OperationStatistics {
    /// Operation name
    pub operation: String,
    /// Total number of samples
    pub total_samples: u64,
    /// Mean duration in nanoseconds
    pub mean_ns: f64,
    /// Standard deviation in nanoseconds
    pub std_dev_ns: f64,
    /// Moving average in nanoseconds
    pub moving_avg_ns: f64,
    /// 50th percentile (median) in nanoseconds
    pub p50_ns: u64,
    /// 95th percentile in nanoseconds
    pub p95_ns: u64,
    /// 99th percentile in nanoseconds
    pub p99_ns: u64,
}

impl OperationStatistics {
    /// Get mean duration in milliseconds
    pub fn mean_ms(&self) -> f64 { self.mean_ns / 1_000_000.0 }
    
    /// Get standard deviation in milliseconds
    pub fn std_dev_ms(&self) -> f64 { self.std_dev_ns / 1_000_000.0 }
    
    /// Get moving average in milliseconds
    pub fn moving_avg_ms(&self) -> f64 { self.moving_avg_ns / 1_000_000.0 }
    
    /// Get p50 in milliseconds
    pub fn p50_ms(&self) -> f64 { self.p50_ns as f64 / 1_000_000.0 }
    
    /// Get p95 in milliseconds
    pub fn p95_ms(&self) -> f64 { self.p95_ns as f64 / 1_000_000.0 }
    
    /// Get p99 in milliseconds
    pub fn p99_ms(&self) -> f64 { self.p99_ns as f64 / 1_000_000.0 }
}

impl Default for PerformanceProfiler {
    fn default() -> Self {
        Self::new()
    }
}

/// Macro for easy timing of code blocks
#[macro_export]
macro_rules! time_block {
    ($label:expr, $block:block) => {{
        let timer = $crate::timing::Timer::start($label.to_string());
        let result = $block;
        let timing = timer.stop();
        (result, timing)
    }};
}
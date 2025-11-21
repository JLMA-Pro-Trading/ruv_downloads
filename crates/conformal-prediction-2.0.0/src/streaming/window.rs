//! Sliding Window Management for Streaming CP
//!
//! Efficient data structures for managing calibration history with:
//! - Fixed-size circular buffer
//! - O(1) add/remove operations
//! - Time-based expiration
//! - Weight tracking

use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Configuration for sliding window
#[derive(Debug, Clone)]
pub struct WindowConfig {
    /// Maximum number of samples to retain
    pub max_size: Option<usize>,

    /// Maximum age of samples (time-based expiration)
    pub max_age: Option<Duration>,

    /// Initial capacity for pre-allocation
    pub initial_capacity: usize,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            max_size: Some(1000),
            max_age: Some(Duration::from_secs(3600)), // 1 hour
            initial_capacity: 100,
        }
    }
}

/// A sample in the sliding window
#[derive(Debug, Clone)]
pub struct Sample {
    /// Nonconformity score
    pub score: f64,

    /// Weight for this sample
    pub weight: f64,

    /// Timestamp when added
    pub timestamp: Instant,
}

impl Sample {
    /// Create a new sample
    pub fn new(score: f64, weight: f64, timestamp: Instant) -> Self {
        Self {
            score,
            weight,
            timestamp,
        }
    }

    /// Check if sample has expired
    pub fn is_expired(&self, max_age: Duration, now: Instant) -> bool {
        now.duration_since(self.timestamp) > max_age
    }
}

/// Sliding window for calibration scores
///
/// Maintains a fixed-size window of recent calibration samples
/// with efficient add/remove operations.
pub struct SlidingWindow {
    /// Circular buffer of samples
    samples: VecDeque<Sample>,

    /// Configuration
    config: WindowConfig,
}

impl SlidingWindow {
    /// Create a new sliding window
    pub fn new(config: WindowConfig) -> Self {
        Self {
            samples: VecDeque::with_capacity(config.initial_capacity),
            config,
        }
    }

    /// Add a new sample to the window
    ///
    /// O(1) amortized complexity
    pub fn push(&mut self, score: f64, weight: f64) {
        let sample = Sample::new(score, weight, Instant::now());

        // Remove expired samples first
        self.remove_expired();

        // Add new sample
        self.samples.push_back(sample);

        // Enforce size limit
        if let Some(max_size) = self.config.max_size {
            while self.samples.len() > max_size {
                self.samples.pop_front();
            }
        }
    }

    /// Remove expired samples based on time
    ///
    /// O(k) where k is number of expired samples
    pub fn remove_expired(&mut self) {
        if let Some(max_age) = self.config.max_age {
            let now = Instant::now();
            while let Some(oldest) = self.samples.front() {
                if oldest.is_expired(max_age, now) {
                    self.samples.pop_front();
                } else {
                    break;
                }
            }
        }
    }

    /// Get all samples as a slice (for iteration)
    pub fn samples(&self) -> &VecDeque<Sample> {
        &self.samples
    }

    /// Number of samples in window
    pub fn len(&self) -> usize {
        self.samples.len()
    }

    /// Check if window is empty
    pub fn is_empty(&self) -> bool {
        self.samples.is_empty()
    }

    /// Clear all samples
    pub fn clear(&mut self) {
        self.samples.clear();
    }

    /// Get total weight of all samples
    pub fn total_weight(&self) -> f64 {
        self.samples.iter().map(|s| s.weight).sum()
    }

    /// Get weighted quantile from samples
    ///
    /// # Arguments
    ///
    /// * `quantile` - Target quantile in [0, 1]
    ///
    /// # Returns
    ///
    /// The weighted quantile value, or None if window is empty
    pub fn weighted_quantile(&self, quantile: f64) -> Option<f64> {
        if self.is_empty() {
            return None;
        }

        // Sort samples by score
        let mut sorted: Vec<_> = self.samples.iter().collect();
        sorted.sort_by(|a, b| a.score.partial_cmp(&b.score).unwrap());

        // Calculate weighted quantile
        let total_weight = self.total_weight();
        let target_weight = quantile * total_weight;

        let mut cumulative_weight = 0.0;
        for sample in sorted.iter() {
            cumulative_weight += sample.weight;
            if cumulative_weight >= target_weight {
                return Some(sample.score);
            }
        }

        // Return largest score if we didn't reach target
        sorted.last().map(|s| s.score)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_window_creation() {
        let config = WindowConfig::default();
        let window = SlidingWindow::new(config);

        assert_eq!(window.len(), 0);
        assert!(window.is_empty());
    }

    #[test]
    fn test_push_samples() {
        let config = WindowConfig {
            max_size: Some(5),
            max_age: None,
            initial_capacity: 10,
        };
        let mut window = SlidingWindow::new(config);

        // Add samples
        for i in 0..3 {
            window.push(i as f64, 1.0);
        }

        assert_eq!(window.len(), 3);
        assert!(!window.is_empty());
    }

    #[test]
    fn test_size_limit() {
        let config = WindowConfig {
            max_size: Some(3),
            max_age: None,
            initial_capacity: 10,
        };
        let mut window = SlidingWindow::new(config);

        // Add more samples than limit
        for i in 0..5 {
            window.push(i as f64, 1.0);
        }

        // Should only keep last 3
        assert_eq!(window.len(), 3);

        // Oldest samples should be removed
        let scores: Vec<_> = window.samples().iter().map(|s| s.score).collect();
        assert_eq!(scores, vec![2.0, 3.0, 4.0]);
    }

    #[test]
    fn test_time_expiration() {
        let config = WindowConfig {
            max_size: Some(10),
            max_age: Some(Duration::from_millis(50)),
            initial_capacity: 10,
        };
        let mut window = SlidingWindow::new(config);

        // Add samples
        window.push(1.0, 1.0);
        window.push(2.0, 1.0);

        assert_eq!(window.len(), 2);

        // Wait for expiration
        thread::sleep(Duration::from_millis(60));

        // Add another sample (triggers cleanup)
        window.push(3.0, 1.0);

        // Old samples should be expired
        assert_eq!(window.len(), 1);
        assert_eq!(window.samples()[0].score, 3.0);
    }

    #[test]
    fn test_total_weight() {
        let config = WindowConfig::default();
        let mut window = SlidingWindow::new(config);

        window.push(1.0, 0.5);
        window.push(2.0, 0.3);
        window.push(3.0, 0.2);

        let total = window.total_weight();
        assert!((total - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_weighted_quantile() {
        let config = WindowConfig::default();
        let mut window = SlidingWindow::new(config);

        // Add samples with equal weights
        for i in 1..=10 {
            window.push(i as f64, 1.0);
        }

        // Test median
        let median = window.weighted_quantile(0.5).unwrap();
        assert!((median - 5.0).abs() < 1.0);

        // Test 90th percentile
        let p90 = window.weighted_quantile(0.9).unwrap();
        assert!(p90 >= 9.0);
    }

    #[test]
    fn test_weighted_quantile_unequal_weights() {
        let config = WindowConfig::default();
        let mut window = SlidingWindow::new(config);

        // Recent samples have higher weight
        window.push(1.0, 0.1);
        window.push(5.0, 0.4);
        window.push(10.0, 0.5);

        // Median should be closer to higher-weighted samples
        let median = window.weighted_quantile(0.5).unwrap();
        assert!(median >= 5.0);
    }

    #[test]
    fn test_empty_quantile() {
        let config = WindowConfig::default();
        let window = SlidingWindow::new(config);

        assert!(window.weighted_quantile(0.5).is_none());
    }

    #[test]
    fn test_clear() {
        let config = WindowConfig::default();
        let mut window = SlidingWindow::new(config);

        window.push(1.0, 1.0);
        window.push(2.0, 1.0);
        assert_eq!(window.len(), 2);

        window.clear();
        assert_eq!(window.len(), 0);
        assert!(window.is_empty());
    }
}

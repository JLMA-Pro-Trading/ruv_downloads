//! Exponentially Weighted Conformal Prediction
//!
//! Implements streaming conformal prediction with exponential weighting
//! to handle non-stationary data and concept drift.
//!
//! ## Theory
//!
//! Traditional conformal prediction assumes exchangeability, which breaks
//! under concept drift. We weight calibration samples exponentially:
//!
//! w_i = exp(-λ × (t_current - t_i))
//!
//! where λ is the decay rate (adaptively tuned via PID control).
//!
//! ## Performance
//!
//! - O(1) updates with circular buffer
//! - O(n log n) quantile calculation (only when predicting)
//! - <0.5ms per update for windows up to 10,000 samples

use crate::{Error, Result};
use super::adaptive::{PIDController, PIDConfig};
use super::window::{SlidingWindow, WindowConfig};
use std::time::Instant;

/// Streaming conformal predictor with exponential weighting
///
/// Maintains a sliding window of calibration scores with exponential
/// decay weighting for robust prediction under concept drift.
pub struct StreamingConformalPredictor {
    /// Significance level (e.g., 0.1 for 90% confidence)
    alpha: f64,

    /// Sliding window of calibration scores
    window: SlidingWindow,

    /// PID controller for adaptive decay
    pid: PIDController,

    /// Starting timestamp for relative time calculations
    start_time: Instant,
}

impl StreamingConformalPredictor {
    /// Create a new streaming conformal predictor
    ///
    /// # Arguments
    ///
    /// * `alpha` - Significance level in (0, 1)
    /// * `decay_rate` - Initial exponential decay rate λ
    ///
    /// # Example
    ///
    /// ```rust
    /// use conformal_prediction::streaming::StreamingConformalPredictor;
    ///
    /// let predictor = StreamingConformalPredictor::new(0.1, 0.01);
    /// ```
    pub fn new(alpha: f64, decay_rate: f64) -> Self {
        let window_config = WindowConfig {
            max_size: Some(10000),
            max_age: None, // Use exponential weighting instead
            initial_capacity: 1000,
        };

        let mut pid_config = PIDConfig {
            target_coverage: 1.0 - alpha,
            ..Default::default()
        };

        // Set initial decay rate
        pid_config.min_decay = decay_rate.min(pid_config.min_decay);
        pid_config.max_decay = decay_rate.max(pid_config.max_decay);

        let pid = PIDController::new(pid_config);

        Self {
            alpha,
            window: SlidingWindow::new(window_config),
            pid,
            start_time: Instant::now(),
        }
    }

    /// Create with custom configuration
    pub fn with_config(
        alpha: f64,
        _decay_rate: f64,
        window_config: WindowConfig,
        pid_config: PIDConfig,
    ) -> Self {
        Self {
            alpha,
            window: SlidingWindow::new(window_config),
            pid: PIDController::new(pid_config),
            start_time: Instant::now(),
        }
    }

    /// Update with a new observation
    ///
    /// # Arguments
    ///
    /// * `x` - Feature vector (unused in current implementation, for future extensions)
    /// * `y_true` - True value
    /// * `y_pred` - Predicted value (point estimate)
    ///
    /// # Performance
    ///
    /// O(1) amortized complexity
    pub fn update(&mut self, _x: &[f64], y_true: f64, y_pred: f64) {
        // Compute nonconformity score (absolute residual)
        let score = (y_true - y_pred).abs();

        // Calculate weight using current decay rate
        let elapsed = self.start_time.elapsed().as_secs_f64();
        let decay = self.pid.decay_rate();
        let weight = (-decay * elapsed).exp();

        // Add to window
        self.window.push(score, weight);
    }

    /// Update and record coverage
    ///
    /// This variant also checks if the true value was covered by the
    /// prediction interval, feeding this information to the PID controller.
    ///
    /// # Arguments
    ///
    /// * `x` - Feature vector
    /// * `y_true` - True value
    /// * `y_pred` - Predicted value
    /// * `prev_interval` - Previously predicted interval to check coverage
    pub fn update_with_coverage(
        &mut self,
        x: &[f64],
        y_true: f64,
        y_pred: f64,
        prev_interval: Option<(f64, f64)>,
    ) {
        // Update window
        self.update(x, y_true, y_pred);

        // Check coverage if we have a previous interval
        if let Some((lower, upper)) = prev_interval {
            let covered = y_true >= lower && y_true <= upper;
            self.pid.record_coverage(covered);
        }

        // Periodically update decay rate via PID
        // (every 10 updates to avoid excessive computation)
        if self.window.len() % 10 == 0 {
            self.pid.update();
        }
    }

    /// Predict interval for a residual
    ///
    /// # Arguments
    ///
    /// * `residual` - Predicted residual (typically 0 for regression)
    ///
    /// # Returns
    ///
    /// (lower_bound, upper_bound) with target coverage
    ///
    /// # Errors
    ///
    /// Returns error if insufficient calibration data
    pub fn predict_interval(&self, residual: f64) -> Result<(f64, f64)> {
        if self.window.is_empty() {
            return Err(Error::PredictionError(
                "No calibration data available".to_string()
            ));
        }

        // Get weighted quantile
        let quantile = self.window.weighted_quantile(1.0 - self.alpha)
            .ok_or_else(|| Error::PredictionError(
                "Failed to compute weighted quantile".to_string()
            ))?;

        Ok((residual - quantile, residual + quantile))
    }

    /// Predict interval for a point estimate
    ///
    /// Convenience method that uses the point estimate directly.
    ///
    /// # Arguments
    ///
    /// * `y_pred` - Point prediction from underlying model
    ///
    /// # Returns
    ///
    /// (lower_bound, upper_bound)
    pub fn predict_interval_direct(&self, y_pred: f64) -> Result<(f64, f64)> {
        let (lower_offset, upper_offset) = self.predict_interval(0.0)?;
        Ok((y_pred + lower_offset, y_pred + upper_offset))
    }

    /// Get empirical coverage from PID controller
    pub fn empirical_coverage(&self) -> Option<f64> {
        self.pid.empirical_coverage()
    }

    /// Get current decay rate
    pub fn decay_rate(&self) -> f64 {
        self.pid.decay_rate()
    }

    /// Get significance level
    pub fn alpha(&self) -> f64 {
        self.alpha
    }

    /// Get number of calibration samples
    pub fn n_samples(&self) -> usize {
        self.window.len()
    }

    /// Get target coverage
    pub fn target_coverage(&self) -> f64 {
        self.pid.target_coverage()
    }

    /// Reset the predictor
    pub fn reset(&mut self) {
        self.window.clear();
        self.pid.reset();
        self.start_time = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_creation() {
        let predictor = StreamingConformalPredictor::new(0.1, 0.01);
        assert_eq!(predictor.alpha(), 0.1);
        assert_eq!(predictor.n_samples(), 0);
    }

    #[test]
    fn test_update() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Add some samples
        predictor.update(&[1.0, 2.0], 5.0, 4.8);
        predictor.update(&[1.5, 2.5], 6.0, 5.9);

        assert_eq!(predictor.n_samples(), 2);
    }

    #[test]
    fn test_predict_interval() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Need data first
        let result = predictor.predict_interval(0.0);
        assert!(result.is_err());

        // Add calibration data
        for i in 0..100 {
            let y_true = i as f64;
            let y_pred = y_true + (i % 5) as f64; // Add some noise
            predictor.update(&[0.0], y_true, y_pred);
        }

        // Now prediction should work
        let (lower, upper) = predictor.predict_interval(0.0).unwrap();
        assert!(lower < 0.0);
        assert!(upper > 0.0);
        assert!(lower < upper);
    }

    #[test]
    fn test_predict_interval_direct() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Calibrate
        for i in 0..50 {
            predictor.update(&[0.0], i as f64, i as f64 - 0.5);
        }

        let (lower, upper) = predictor.predict_interval_direct(10.0).unwrap();

        // Interval should be centered around prediction
        assert!(lower < 10.0);
        assert!(upper > 10.0);
        assert!(lower < upper);
    }

    #[test]
    fn test_update_with_coverage() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // First update without interval
        predictor.update_with_coverage(&[0.0], 5.0, 4.8, None);

        // Subsequent updates with intervals
        for i in 0..20 {
            let y_true = i as f64;
            let y_pred = y_true - 0.2;
            let interval = Some((y_pred - 1.0, y_pred + 1.0));
            predictor.update_with_coverage(&[0.0], y_true, y_pred, interval);
        }

        assert!(predictor.n_samples() > 0);
    }

    #[test]
    fn test_coverage_tracking() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Add samples that are well-covered
        for i in 0..100 {
            let y_true = i as f64;
            let y_pred = y_true;
            let interval = Some((y_pred - 2.0, y_pred + 2.0));
            predictor.update_with_coverage(&[0.0], y_true, y_pred, interval);
        }

        // Should have high coverage
        if let Some(coverage) = predictor.empirical_coverage() {
            assert!(coverage > 0.8);
        }
    }

    #[test]
    fn test_reset() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Add data
        for i in 0..10 {
            predictor.update(&[0.0], i as f64, i as f64);
        }

        assert_eq!(predictor.n_samples(), 10);

        // Reset
        predictor.reset();

        assert_eq!(predictor.n_samples(), 0);
        assert!(predictor.empirical_coverage().is_none());
    }

    #[test]
    fn test_concept_drift_simulation() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.05);

        // Phase 1: Low noise
        for i in 0..50 {
            let y_true = i as f64;
            let y_pred = y_true + 0.1;
            predictor.update(&[0.0], y_true, y_pred);
        }

        let interval_phase1 = predictor.predict_interval(0.0).unwrap();
        let width_phase1 = interval_phase1.1 - interval_phase1.0;

        // Phase 2: High noise (concept drift)
        for i in 50..100 {
            let y_true = i as f64;
            let y_pred = y_true + (i % 10) as f64; // More noise
            predictor.update(&[0.0], y_true, y_pred);
        }

        let interval_phase2 = predictor.predict_interval(0.0).unwrap();
        let width_phase2 = interval_phase2.1 - interval_phase2.0;

        // Interval should widen to accommodate drift
        assert!(width_phase2 > width_phase1);
    }

    #[test]
    fn test_exponential_weighting() {
        // Test that weighted quantile is correctly computed
        // by verifying interval width responds to error distribution
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Phase 1: Add samples with consistent small errors
        for i in 0..50 {
            let y_true = i as f64;
            let y_pred = y_true + 0.5; // Small constant error
            predictor.update(&[0.0], y_true, y_pred);
        }

        let (lower1, upper1) = predictor.predict_interval(0.0).unwrap();
        let width1 = upper1 - lower1;

        // Phase 2: Add samples with larger errors
        for i in 50..100 {
            let y_true = i as f64;
            let y_pred = y_true + 5.0; // Larger error
            predictor.update(&[0.0], y_true, y_pred);
        }

        let (lower2, upper2) = predictor.predict_interval(0.0).unwrap();
        let width2 = upper2 - lower2;

        // Interval should widen to accommodate larger recent errors
        assert!(width2 > width1, "Width increased from {} to {}", width1, width2);

        // Second interval should include the larger error magnitude
        assert!(width2 > 8.0, "Width {} should be > 8.0 to cover errors ~5.0", width2);
    }

    #[test]
    fn test_adaptive_decay() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        let initial_decay = predictor.decay_rate();

        // Simulate poor coverage
        for i in 0..100 {
            let y_true = i as f64;
            let y_pred = y_true + 5.0; // Large systematic error
            let interval = Some((y_pred - 1.0, y_pred + 1.0)); // Narrow interval
            predictor.update_with_coverage(&[0.0], y_true, y_pred, interval);
        }

        // Decay rate should adapt
        let final_decay = predictor.decay_rate();

        // Allow some variation but should be different
        assert_ne!(initial_decay, final_decay);
    }

    #[test]
    fn test_performance_large_window() {
        use std::time::Instant;

        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Add 1000 samples
        for i in 0..1000 {
            predictor.update(&[0.0], i as f64, i as f64 + 0.5);
        }

        // Measure update time
        let start = Instant::now();
        for i in 0..100 {
            predictor.update(&[0.0], i as f64, i as f64 + 0.5);
        }
        let elapsed = start.elapsed();

        // Should be fast (<0.5ms per update)
        let avg_time_ms = elapsed.as_micros() as f64 / 100.0 / 1000.0;
        assert!(avg_time_ms < 0.5, "Average update time: {:.3}ms", avg_time_ms);
    }

    #[test]
    fn test_stationary_coverage() {
        let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);

        // Generate stationary data
        let mut covered_count = 0;
        let n_tests = 100;

        // Calibrate
        for i in 0..50 {
            predictor.update(&[0.0], i as f64, i as f64);
        }

        // Test coverage
        for i in 0..n_tests {
            let y_true = 50.0 + i as f64;
            let y_pred = y_true;

            let (lower, upper) = predictor.predict_interval_direct(y_pred).unwrap();

            if y_true >= lower && y_true <= upper {
                covered_count += 1;
            }

            // Update predictor
            predictor.update(&[0.0], y_true, y_pred);
        }

        let coverage = covered_count as f64 / n_tests as f64;

        // Should be close to target (90%)
        assert!(coverage > 0.8, "Coverage: {:.2}", coverage);
    }
}

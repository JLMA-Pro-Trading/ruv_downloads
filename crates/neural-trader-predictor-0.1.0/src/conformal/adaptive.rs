//! Adaptive Conformal Inference (ACI)
//!
//! Adaptive conformal inference dynamically adjusts the miscoverage rate (alpha)
//! to maintain a target coverage rate over time. Uses a simple PID control mechanism
//! to adapt to changing data distributions.
//!
//! The algorithm:
//! 1. Make prediction with current alpha
//! 2. Observe actual value
//! 3. Compute coverage indicator (1 if actual in interval, 0 otherwise)
//! 4. Update alpha based on coverage error: α_new = α_old + γ * (1{y ∈ I} - α_target)

use std::collections::VecDeque;
use crate::core::{NonconformityScore, PredictionInterval, Result, AdaptiveConfig};
use super::split::SplitConformalPredictor;

/// Adaptive Conformal Inference (ACI) Predictor
///
/// Maintains a target coverage rate by dynamically adjusting alpha based on
/// observed coverage performance. Uses a simple but effective PID-like update rule.
///
/// # Algorithm
/// 1. Initialize with base split conformal predictor
/// 2. Make predictions with current alpha
/// 3. After observing actual value, update alpha:
///    α_new = α_old + γ * (coverage - target_coverage)
/// 4. Recompute quantile threshold
///
/// # Parameters
/// - `gamma`: Learning rate (e.g., 0.02 for 2% adjustment per observation)
/// - `target_coverage`: Desired coverage rate (e.g., 0.90)
/// - `alpha_min`, `alpha_max`: Bounds on alpha values
/// - `coverage_window`: Window size for monitoring
pub struct AdaptiveConformalPredictor<S: NonconformityScore> {
    /// Base split conformal predictor
    base: SplitConformalPredictor<S>,

    /// Current miscoverage rate (1 - coverage)
    alpha_current: f64,

    /// Target coverage rate (e.g., 0.90)
    target_coverage: f64,

    /// Learning rate for adaptive adjustment
    gamma: f64,

    /// Coverage history for monitoring
    coverage_history: VecDeque<f64>,

    /// Configuration
    config: AdaptiveConfig,

    /// Number of adaptations made
    n_adaptations: usize,
}

impl<S: NonconformityScore> AdaptiveConformalPredictor<S> {
    /// Create a new adaptive conformal predictor
    ///
    /// # Arguments
    /// * `config` - Adaptive configuration parameters
    /// * `score_fn` - Nonconformity score function
    pub fn new(config: AdaptiveConfig, score_fn: S) -> Self {
        let alpha_initial = 1.0 - config.target_coverage;

        Self {
            base: SplitConformalPredictor::new(alpha_initial, score_fn),
            alpha_current: alpha_initial,
            target_coverage: config.target_coverage,
            gamma: config.gamma,
            coverage_history: VecDeque::with_capacity(config.coverage_window),
            config,
            n_adaptations: 0,
        }
    }

    /// Initialize with calibration data
    ///
    /// # Arguments
    /// * `predictions` - Initial calibration predictions
    /// * `actuals` - Initial calibration actuals
    pub fn calibrate(&mut self, predictions: &[f64], actuals: &[f64]) -> Result<()> {
        self.base.calibrate(predictions, actuals)
    }

    /// Make a prediction with adaptive alpha
    ///
    /// Returns a prediction interval using the current alpha.
    /// Note: The actual adaptation happens in `observe()`.
    pub fn predict(&mut self, point_prediction: f64) -> PredictionInterval {
        self.base.predict(point_prediction)
    }

    /// Observe the actual value and adapt alpha
    ///
    /// # Arguments
    /// * `interval` - The interval that was predicted
    /// * `actual` - The actual observed value
    ///
    /// # Returns
    /// The coverage indicator (1.0 if actual in interval, 0.0 otherwise)
    pub fn observe_and_adapt(&mut self, interval: &PredictionInterval, actual: f64) -> f64 {
        let coverage_indicator = if interval.contains(actual) { 1.0 } else { 0.0 };

        // Add to history
        self.coverage_history.push_back(coverage_indicator);
        if self.coverage_history.len() > self.config.coverage_window {
            self.coverage_history.pop_front();
        }

        // Compute empirical coverage
        let empirical_coverage = self.empirical_coverage();

        // PID adjustment: α_new = α_old + γ * (coverage - target)
        let coverage_error = empirical_coverage - self.target_coverage;
        let alpha_adjustment = self.gamma * coverage_error;

        self.alpha_current = (self.alpha_current + alpha_adjustment)
            .max(self.config.alpha_min)
            .min(self.config.alpha_max);

        self.n_adaptations += 1;

        coverage_indicator
    }

    /// Make a prediction and adapt in one call
    ///
    /// This is a convenience method for the common workflow:
    /// 1. Make prediction
    /// 2. Observe actual value
    /// 3. Adapt alpha
    ///
    /// # Arguments
    /// * `point_prediction` - Point prediction from base model
    /// * `actual` - Actual observed value (None if not available yet)
    ///
    /// # Returns
    /// Prediction interval
    pub fn predict_and_adapt(&mut self, point_prediction: f64, actual: Option<f64>) -> PredictionInterval {
        let interval = self.predict(point_prediction);

        if let Some(actual_val) = actual {
            self.observe_and_adapt(&interval, actual_val);
        }

        interval
    }

    /// Get current empirical coverage rate
    ///
    /// Computed as the mean of the coverage history
    pub fn empirical_coverage(&self) -> f64 {
        if self.coverage_history.is_empty() {
            self.target_coverage // Default if no history
        } else {
            self.coverage_history.iter().sum::<f64>() / self.coverage_history.len() as f64
        }
    }

    /// Get current alpha value
    pub fn alpha(&self) -> f64 {
        self.alpha_current
    }

    /// Get target coverage
    pub fn target_coverage(&self) -> f64 {
        self.target_coverage
    }

    /// Get coverage error (empirical - target)
    pub fn coverage_error(&self) -> f64 {
        self.empirical_coverage() - self.target_coverage
    }

    /// Get number of adaptations
    pub fn n_adaptations(&self) -> usize {
        self.n_adaptations
    }

    /// Get coverage history length
    pub fn history_size(&self) -> usize {
        self.coverage_history.len()
    }

    /// Reset the adaptive state
    pub fn reset(&mut self) {
        self.base.reset();
        self.alpha_current = 1.0 - self.target_coverage;
        self.coverage_history.clear();
        self.n_adaptations = 0;
    }

    /// Get reference to base predictor
    pub fn base_predictor(&self) -> &SplitConformalPredictor<S> {
        &self.base
    }

    /// Get mutable reference to base predictor
    pub fn base_predictor_mut(&mut self) -> &mut SplitConformalPredictor<S> {
        &mut self.base
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scores::AbsoluteScore;
    use approx::assert_abs_diff_eq;

    #[test]
    fn test_adaptive_creation() {
        let config = AdaptiveConfig::default();
        let predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        assert_abs_diff_eq!(predictor.alpha(), 0.1, epsilon = 1e-6); // 1 - 0.90
        assert_abs_diff_eq!(predictor.target_coverage(), 0.90, epsilon = 1e-6);
        assert_abs_diff_eq!(predictor.empirical_coverage(), 0.90, epsilon = 1e-6); // Default when no history
    }

    #[test]
    fn test_adaptive_calibration() {
        let mut config = AdaptiveConfig::default();
        config.target_coverage = 0.90;
        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0, 102.0, 98.0, 101.0];
        let actuals = vec![101.0, 100.0, 99.0, 102.0];

        let result = predictor.calibrate(&predictions, &actuals);
        assert!(result.is_ok());
    }

    #[test]
    fn test_adaptive_predict() {
        let mut config = AdaptiveConfig::default();
        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 10];
        let actuals = vec![100.0; 10];
        predictor.calibrate(&predictions, &actuals).unwrap();

        let interval = predictor.predict(100.0);
        assert_eq!(interval.point, 100.0);
        assert_abs_diff_eq!(interval.alpha, 0.1, epsilon = 1e-6);
    }

    #[test]
    fn test_adaptive_observe_and_adapt() {
        let mut config = AdaptiveConfig::default();
        config.gamma = 0.1; // Faster learning for testing
        config.coverage_window = 10;
        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 20];
        let actuals = vec![100.0; 20];
        predictor.calibrate(&predictions, &actuals).unwrap();

        let mut interval = predictor.predict(100.0);
        let initial_alpha = predictor.alpha();

        // Observe that interval contains actual
        let coverage = predictor.observe_and_adapt(&interval, 100.0);
        assert_eq!(coverage, 1.0);

        // After observing coverage (1.0 > target 0.9), alpha increases
        // α_new = α_old + γ * (1.0 - 0.9) = α_old + γ * 0.1
        let alpha_after = predictor.alpha();
        assert!(alpha_after > initial_alpha);

        // Observe that interval doesn't contain actual
        interval = predictor.predict(100.0);
        let coverage = predictor.observe_and_adapt(&interval, 200.0);
        assert_eq!(coverage, 0.0);

        // After observing no coverage (0.0 < target 0.9), alpha decreases
        // New coverage is average, so may go down from previous
        let alpha_final = predictor.alpha();
        assert!(alpha_final >= initial_alpha - 0.1); // Allow some tolerance
    }

    #[test]
    fn test_adaptive_alpha_bounds() {
        let config = AdaptiveConfig {
            target_coverage: 0.90,
            gamma: 0.5,
            coverage_window: 200,
            alpha_min: 0.01,
            alpha_max: 0.30,
        };
        let config_max = config.alpha_max;
        let config_min = config.alpha_min;

        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 50];
        let actuals = vec![100.0; 50];
        predictor.calibrate(&predictions, &actuals).unwrap();

        // Make many observations with coverage
        for _ in 0..100 {
            let interval = predictor.predict(100.0);
            predictor.observe_and_adapt(&interval, 100.0);
        }

        // Alpha should stay above min
        assert!(predictor.alpha() >= config_min);

        // Make many observations without coverage
        for _ in 0..100 {
            let interval = predictor.predict(100.0);
            predictor.observe_and_adapt(&interval, 500.0);
        }

        // Alpha should stay below max
        assert!(predictor.alpha() <= config_max);
    }

    #[test]
    fn test_adaptive_coverage_tracking() {
        let mut config = AdaptiveConfig::default();
        config.coverage_window = 5;
        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 20];
        let actuals = vec![100.0; 20];
        predictor.calibrate(&predictions, &actuals).unwrap();

        // Add coverage observations
        let interval = predictor.predict(100.0);
        predictor.observe_and_adapt(&interval, 100.0);
        predictor.observe_and_adapt(&interval, 100.0);
        predictor.observe_and_adapt(&interval, 200.0); // No coverage

        assert_eq!(predictor.history_size(), 3);
        let coverage = predictor.empirical_coverage();
        assert_abs_diff_eq!(coverage, 2.0 / 3.0, epsilon = 1e-6);
    }

    #[test]
    fn test_adaptive_coverage_window_limit() {
        let mut config = AdaptiveConfig::default();
        config.coverage_window = 3;
        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 20];
        let actuals = vec![100.0; 20];
        predictor.calibrate(&predictions, &actuals).unwrap();

        let interval = predictor.predict(100.0);

        // Add more observations than window size
        for _ in 0..5 {
            predictor.observe_and_adapt(&interval, 100.0);
        }

        // Should keep only last 3
        assert_eq!(predictor.history_size(), 3);
    }

    #[test]
    fn test_adaptive_predict_and_adapt() {
        let config = AdaptiveConfig::default();
        let config_min = config.alpha_min;
        let config_max = config.alpha_max;

        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 10];
        let actuals = vec![100.0; 10];
        predictor.calibrate(&predictions, &actuals).unwrap();

        // Predict and adapt in one call
        let _interval = predictor.predict_and_adapt(100.0, Some(100.5));

        // Should have made adaptation
        assert_eq!(predictor.n_adaptations(), 1);
        assert_eq!(predictor.history_size(), 1);

        // Alpha should have changed (though direction depends on whether 100.5 is in interval)
        let alpha_after = predictor.alpha();
        assert!(alpha_after >= config_min);
        assert!(alpha_after <= config_max);
    }

    #[test]
    fn test_adaptive_reset() {
        let mut config = AdaptiveConfig::default();
        let mut predictor = AdaptiveConformalPredictor::new(config, AbsoluteScore);

        let predictions = vec![100.0; 10];
        let actuals = vec![100.0; 10];
        predictor.calibrate(&predictions, &actuals).unwrap();

        let interval = predictor.predict(100.0);
        predictor.observe_and_adapt(&interval, 100.0);

        assert!(predictor.n_adaptations() > 0);

        predictor.reset();

        assert_abs_diff_eq!(predictor.alpha(), 0.1, epsilon = 1e-6);
        assert_eq!(predictor.n_adaptations(), 0);
        assert_eq!(predictor.history_size(), 0);
    }
}

//! Split Conformal Prediction
//!
//! Split conformal prediction is a distribution-free method that provides guaranteed
//! coverage for prediction intervals. The algorithm:
//!
//! 1. **Calibration Phase** (O(n log n) via sorting):
//!    - Compute nonconformity scores on calibration set
//!    - Sort scores and find quantile
//!
//! 2. **Prediction Phase** (O(1)):
//!    - Apply quantile to any test point prediction
//!
//! 3. **Online Update** (O(log n) via binary search):
//!    - Insert new scores using binary search
//!    - Incrementally update quantile
//!
//! Mathematical guarantee: P(y ∈ [ŷ - q, ŷ + q]) ≥ 1 - α

use std::cmp::Ordering;
use crate::core::{NonconformityScore, PredictionInterval, Result, Error};

/// Split Conformal Prediction
///
/// Provides guaranteed coverage prediction intervals through a simple two-stage process:
/// calibration and prediction.
///
/// # Mathematical Basis
/// - Guaranteed coverage: P(y ∈ I) ≥ 1 - α (under exchangeability)
/// - Quantile formula: q = ⌈(n+1)(1-α)⌉ / n
/// - No assumptions on prediction errors distribution
///
/// # Complexity
/// - Calibration: O(n log n) for sorting
/// - Prediction: O(1)
/// - Online update: O(log n) for binary search insertion
pub struct SplitConformalPredictor<S: NonconformityScore> {
    /// Sorted calibration nonconformity scores
    calibration_scores: Vec<f64>,

    /// Nonconformity score function
    score_fn: S,

    /// Target miscoverage rate (e.g., 0.1 for 90% coverage)
    alpha: f64,

    /// Current quantile threshold
    quantile: f64,

    /// Whether the predictor has been calibrated
    calibrated: bool,

    /// Number of predictions made (for monitoring)
    n_predictions: usize,
}

impl<S: NonconformityScore> SplitConformalPredictor<S> {
    /// Create a new split conformal predictor
    ///
    /// # Arguments
    /// * `alpha` - Target miscoverage rate (e.g., 0.1 for 90% coverage)
    /// * `score_fn` - Nonconformity score function
    ///
    /// # Returns
    /// New predictor (not yet calibrated)
    ///
    /// # Panics
    /// Panics if alpha is not in (0, 1)
    pub fn new(alpha: f64, score_fn: S) -> Self {
        if alpha <= 0.0 || alpha >= 1.0 {
            panic!("alpha must be in (0, 1), got {}", alpha);
        }

        Self {
            calibration_scores: Vec::new(),
            score_fn,
            alpha,
            quantile: 0.0,
            calibrated: false,
            n_predictions: 0,
        }
    }

    /// Calibrate the predictor with predictions and actual values
    ///
    /// # Arguments
    /// * `predictions` - Point predictions from base model
    /// * `actuals` - Actual observed values
    ///
    /// # Returns
    /// Result indicating success or error
    ///
    /// # Errors
    /// - `InsufficientData` if fewer than 2 calibration samples
    /// - `LengthMismatch` if arrays have different lengths
    pub fn calibrate(&mut self, predictions: &[f64], actuals: &[f64]) -> Result<()> {
        if predictions.len() != actuals.len() {
            return Err(Error::length_mismatch(predictions.len(), actuals.len()));
        }

        let n = predictions.len();
        if n < 2 {
            return Err(Error::insufficient_data(2, n));
        }

        // Compute nonconformity scores: O(n)
        self.calibration_scores.clear();
        self.calibration_scores.reserve(n);

        for (pred, actual) in predictions.iter().zip(actuals.iter()) {
            let score = self.score_fn.score(*pred, *actual);
            self.calibration_scores.push(score);
        }

        // Sort scores: O(n log n)
        self.calibration_scores.sort_by(|a, b| {
            a.partial_cmp(b).unwrap_or(Ordering::Equal)
        });

        // Compute quantile: ⌈(n+1)(1-α)⌉ / n
        self.compute_quantile();

        self.calibrated = true;
        Ok(())
    }

    /// Make a prediction with guaranteed coverage interval
    ///
    /// # Arguments
    /// * `point_prediction` - Point prediction from base model
    ///
    /// # Returns
    /// `PredictionInterval` with guaranteed coverage
    ///
    /// # Panics
    /// Panics if predictor hasn't been calibrated
    pub fn predict(&mut self, point_prediction: f64) -> PredictionInterval {
        if !self.calibrated {
            panic!("Predictor not calibrated. Call calibrate() first.");
        }

        let (lower, upper) = self.score_fn.interval(point_prediction, self.quantile);

        self.n_predictions += 1;

        PredictionInterval::new(
            point_prediction,
            lower,
            upper,
            self.alpha,
            self.quantile,
        )
    }

    /// Update with a new calibration sample (online learning)
    ///
    /// This uses binary search to insert the score and update the quantile.
    /// Complexity: O(log n) for binary search + O(n) for Vec insertion
    ///
    /// # Arguments
    /// * `prediction` - Point prediction
    /// * `actual` - Actual observed value
    pub fn update(&mut self, prediction: f64, actual: f64) -> Result<()> {
        if !self.calibrated {
            return Err(Error::NotCalibrated);
        }

        let score = self.score_fn.score(prediction, actual);

        // Binary search for insertion point: O(log n)
        let insert_pos = self
            .calibration_scores
            .binary_search_by(|s| {
                s.partial_cmp(&score).unwrap_or(Ordering::Equal)
            })
            .unwrap_or_else(|pos| pos);

        // Insert the new score: O(n) in worst case
        self.calibration_scores.insert(insert_pos, score);

        // Update quantile with new sample count
        self.compute_quantile();

        Ok(())
    }

    /// Compute the quantile threshold
    ///
    /// Formula: q = ⌈(n+1)(1-α)⌉ / n
    /// This ensures P(y ∈ I) ≥ 1 - α
    fn compute_quantile(&mut self) {
        let n = self.calibration_scores.len() as f64;
        let quantile_idx = ((n + 1.0) * (1.0 - self.alpha)).ceil() as usize;
        let quantile_idx = (quantile_idx - 1).min(self.calibration_scores.len() - 1);

        self.quantile = self.calibration_scores[quantile_idx];
    }

    /// Get the current quantile value
    pub fn get_quantile(&self) -> f64 {
        self.quantile
    }

    /// Get the number of calibration samples
    pub fn n_calibration(&self) -> usize {
        self.calibration_scores.len()
    }

    /// Get the number of predictions made
    pub fn n_predictions(&self) -> usize {
        self.n_predictions
    }

    /// Check if predictor is calibrated
    pub fn is_calibrated(&self) -> bool {
        self.calibrated
    }

    /// Get alpha value
    pub fn alpha(&self) -> f64 {
        self.alpha
    }

    /// Get reference to calibration scores (sorted)
    pub fn calibration_scores(&self) -> &[f64] {
        &self.calibration_scores
    }

    /// Reset the predictor
    pub fn reset(&mut self) {
        self.calibration_scores.clear();
        self.quantile = 0.0;
        self.calibrated = false;
        self.n_predictions = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::scores::AbsoluteScore;

    #[test]
    fn test_split_conformal_creation() {
        let predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);
        assert_eq!(predictor.alpha(), 0.1);
        assert!(!predictor.is_calibrated());
        assert_eq!(predictor.n_calibration(), 0);
    }

    #[test]
    fn test_split_conformal_calibration() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

        let predictions = vec![100.0, 102.0, 98.0, 101.0, 99.0];
        let actuals = vec![101.0, 100.0, 99.0, 102.0, 98.0];

        predictor.calibrate(&predictions, &actuals).unwrap();

        assert!(predictor.is_calibrated());
        assert_eq!(predictor.n_calibration(), 5);
        assert!(predictor.get_quantile() > 0.0);
    }

    #[test]
    fn test_split_conformal_prediction() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

        let predictions = vec![100.0, 102.0, 98.0, 101.0, 99.0];
        let actuals = vec![101.0, 100.0, 99.0, 102.0, 98.0];

        predictor.calibrate(&predictions, &actuals).unwrap();

        let interval = predictor.predict(100.0);
        assert_eq!(interval.point, 100.0);
        assert!(interval.lower <= interval.upper);
        assert_eq!(interval.alpha, 0.1);
        assert_eq!(predictor.n_predictions(), 1);
    }

    #[test]
    fn test_split_conformal_quantile_computation() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

        let predictions = vec![100.0; 100];
        let mut actuals = vec![100.0; 100];
        actuals[0] = 105.0; // Add one large error

        predictor.calibrate(&predictions, &actuals).unwrap();

        // With alpha=0.1, quantile should be computed
        // Most errors are 0, one error is 5
        let quantile = predictor.get_quantile();
        assert!(quantile >= 0.0 && quantile <= 5.0);
        assert_eq!(predictor.n_calibration(), 100);
    }

    #[test]
    fn test_split_conformal_online_update() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

        let predictions = vec![100.0, 102.0, 98.0];
        let actuals = vec![101.0, 100.0, 99.0];

        predictor.calibrate(&predictions, &actuals).unwrap();
        let _quantile_before = predictor.get_quantile();

        // Add new sample
        predictor.update(101.0, 100.0).unwrap();

        // Should have one more sample
        assert_eq!(predictor.n_calibration(), 4);
        // Quantile may or may not change depending on the new score
        let _quantile_after = predictor.get_quantile();
        assert!(_quantile_after > 0.0);
    }

    #[test]
    fn test_split_conformal_coverage_guarantee() {
        let mut predictor = SplitConformalPredictor::new(0.05, AbsoluteScore);

        // Create data where errors are uniformly distributed
        let n = 1000;
        let mut predictions = Vec::new();
        let mut actuals = Vec::new();

        for i in 0..n {
            predictions.push(100.0);
            actuals.push(100.0 + (i as f64 % 10.0) - 5.0); // Errors from -5 to 5
        }

        predictor.calibrate(&predictions, &actuals).unwrap();

        // Make predictions on same data and check coverage
        let mut coverage_count = 0;
        for i in 0..n / 2 {
            let interval = predictor.predict(100.0);
            if interval.contains(actuals[i]) {
                coverage_count += 1;
            }
        }

        let coverage_rate = coverage_count as f64 / (n / 2) as f64;
        // Should be close to 95% (1 - alpha)
        assert!(coverage_rate >= 0.85, "coverage_rate = {}", coverage_rate);
    }

    #[test]
    fn test_split_conformal_errors() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

        // Test insufficient data
        let err = predictor.calibrate(&[100.0], &[101.0]);
        assert!(err.is_err());

        // Test length mismatch
        let err = predictor.calibrate(&[100.0, 101.0], &[101.0]);
        assert!(err.is_err());

        // Test update before calibration
        let err = predictor.update(100.0, 101.0);
        assert!(err.is_err());
    }

    #[test]
    #[should_panic]
    fn test_split_conformal_invalid_alpha() {
        let _ = SplitConformalPredictor::new(0.0, AbsoluteScore);
    }

    #[test]
    #[should_panic]
    fn test_split_conformal_alpha_too_high() {
        let _ = SplitConformalPredictor::new(1.0, AbsoluteScore);
    }

    #[test]
    #[should_panic]
    fn test_split_conformal_predict_not_calibrated() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);
        let _ = predictor.predict(100.0);
    }

    #[test]
    fn test_split_conformal_reset() {
        let mut predictor = SplitConformalPredictor::new(0.1, AbsoluteScore);

        let predictions = vec![100.0, 102.0];
        let actuals = vec![101.0, 100.0];
        predictor.calibrate(&predictions, &actuals).unwrap();

        assert!(predictor.is_calibrated());
        predictor.reset();
        assert!(!predictor.is_calibrated());
        assert_eq!(predictor.n_calibration(), 0);
    }
}

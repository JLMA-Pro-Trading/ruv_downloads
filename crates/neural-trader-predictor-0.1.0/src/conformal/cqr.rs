//! Conformalized Quantile Regression (CQR)
//!
//! CQR is a distribution-free method that combines quantile regression with
//! conformal prediction to produce prediction intervals with finite-sample coverage guarantees.
//!
//! Algorithm:
//! 1. Train quantile regressor to predict lower and upper quantiles
//! 2. Calibrate conformal correction on hold-out set
//! 3. Apply conformalized interval: [ŷ_lower - q, ŷ_upper + q]
//!
//! Key advantage: Automatically adapts interval width to local prediction difficulty.

use crate::core::{NonconformityScore, PredictionInterval, Result, Error, QuantilePredictor};
use crate::scores::QuantileScore;
use std::cmp::Ordering;

/// Conformalized Quantile Regression (CQR)
///
/// Combines quantile regression with conformal prediction for adaptive prediction intervals.
/// The quantile regressor learns to predict lower and upper quantiles that capture
/// the conditional distribution of y given x, and conformal calibration ensures coverage.
///
/// # Algorithm
/// 1. Train base quantile predictor on training data
/// 2. Compute nonconformity scores on calibration set
/// 3. Find quantile of scores
/// 4. Apply conformal correction: I = [ŷ_lower - q, ŷ_upper + q]
///
/// # Complexity
/// - Calibration: O(n log n) for quantile computation
/// - Prediction: O(1)
///
/// # Mathematical Guarantee
/// P(y ∈ I) ≥ 1 - α (under exchangeability)
pub struct CQRPredictor<Q: QuantilePredictor> {
    /// Base quantile predictor
    base_predictor: Q,

    /// Sorted calibration nonconformity scores
    calibration_scores: Vec<f64>,

    /// Target miscoverage rate
    alpha: f64,

    /// Quantile threshold
    quantile: f64,

    /// Whether predictor is calibrated
    calibrated: bool,

    /// Number of predictions made
    n_predictions: usize,

    /// Quantiles to predict (e.g., 0.05 and 0.95 for 90% interval)
    quantile_levels: (f64, f64),
}

impl<Q: QuantilePredictor> CQRPredictor<Q> {
    /// Create a new CQR predictor
    ///
    /// # Arguments
    /// * `base_predictor` - Trained quantile regressor
    /// * `alpha` - Target miscoverage rate
    /// * `quantile_levels` - (lower_quantile, upper_quantile) to predict (e.g., (0.05, 0.95))
    pub fn new(base_predictor: Q, alpha: f64, quantile_levels: (f64, f64)) -> Self {
        if alpha <= 0.0 || alpha >= 1.0 {
            panic!("alpha must be in (0, 1), got {}", alpha);
        }
        if quantile_levels.0 < 0.0 || quantile_levels.0 > 1.0 {
            panic!("lower quantile must be in [0, 1], got {}", quantile_levels.0);
        }
        if quantile_levels.1 < 0.0 || quantile_levels.1 > 1.0 {
            panic!("upper quantile must be in [0, 1], got {}", quantile_levels.1);
        }
        if quantile_levels.0 >= quantile_levels.1 {
            panic!(
                "lower quantile must be < upper quantile, got ({}, {})",
                quantile_levels.0, quantile_levels.1
            );
        }

        Self {
            base_predictor,
            calibration_scores: Vec::new(),
            alpha,
            quantile: 0.0,
            calibrated: false,
            n_predictions: 0,
            quantile_levels,
        }
    }

    /// Calibrate the CQR predictor
    ///
    /// # Arguments
    /// * `features` - Batch of features for calibration
    /// * `actuals` - Actual values for calibration
    ///
    /// # Returns
    /// Result indicating success or error
    pub fn calibrate(&mut self, features: &[Vec<f64>], actuals: &[f64]) -> Result<()> {
        if features.len() != actuals.len() {
            return Err(Error::length_mismatch(features.len(), actuals.len()));
        }

        let n = features.len();
        if n < 2 {
            return Err(Error::insufficient_data(2, n));
        }

        // Compute nonconformity scores: O(n)
        self.calibration_scores.clear();
        self.calibration_scores.reserve(n);

        for (feature, actual) in features.iter().zip(actuals.iter()) {
            // Predict quantiles
            let (lower, upper) = self
                .base_predictor
                .predict_quantiles(feature, self.quantile_levels.0, self.quantile_levels.1)?;

            // Compute nonconformity score
            let score = QuantileScore::new(lower, upper).score(0.0, *actual);
            self.calibration_scores.push(score);
        }

        // Sort scores: O(n log n)
        self.calibration_scores.sort_by(|a, b| {
            a.partial_cmp(b).unwrap_or(Ordering::Equal)
        });

        // Compute quantile threshold
        self.compute_quantile();

        self.calibrated = true;
        Ok(())
    }

    /// Make a conformal quantile regression prediction
    ///
    /// # Arguments
    /// * `features` - Features for prediction
    ///
    /// # Returns
    /// Prediction interval with coverage guarantee
    pub fn predict(&mut self, features: &[f64]) -> Result<PredictionInterval> {
        if !self.calibrated {
            return Err(Error::NotCalibrated);
        }

        // Get point prediction from quantiles (midpoint)
        let (pred_lower, pred_upper) = self
            .base_predictor
            .predict_quantiles(features, self.quantile_levels.0, self.quantile_levels.1)?;

        let point_prediction = (pred_lower + pred_upper) / 2.0;

        // Apply conformal correction
        let lower = pred_lower - self.quantile;
        let upper = pred_upper + self.quantile;

        self.n_predictions += 1;

        Ok(PredictionInterval::new(
            point_prediction,
            lower,
            upper,
            self.alpha,
            self.quantile,
        ))
    }

    /// Compute the conformal quantile threshold
    ///
    /// Formula: q = ⌈(n+1)(1-α)⌉ / n
    fn compute_quantile(&mut self) {
        let n = self.calibration_scores.len() as f64;
        let quantile_idx = ((n + 1.0) * (1.0 - self.alpha)).ceil() as usize;
        let quantile_idx = (quantile_idx - 1).min(self.calibration_scores.len() - 1);

        self.quantile = self.calibration_scores[quantile_idx];
    }

    /// Get the current quantile threshold
    pub fn get_quantile(&self) -> f64 {
        self.quantile
    }

    /// Get number of calibration samples
    pub fn n_calibration(&self) -> usize {
        self.calibration_scores.len()
    }

    /// Get number of predictions
    pub fn n_predictions(&self) -> usize {
        self.n_predictions
    }

    /// Check if calibrated
    pub fn is_calibrated(&self) -> bool {
        self.calibrated
    }

    /// Get alpha value
    pub fn alpha(&self) -> f64 {
        self.alpha
    }

    /// Get quantile levels
    pub fn quantile_levels(&self) -> (f64, f64) {
        self.quantile_levels
    }

    /// Get reference to calibration scores
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

    // Mock quantile predictor for testing
    struct MockQuantilePredictor {
        lower_bias: f64,
        upper_bias: f64,
    }

    impl MockQuantilePredictor {
        fn new() -> Self {
            Self {
                lower_bias: -5.0,
                upper_bias: 5.0,
            }
        }
    }

    impl QuantilePredictor for MockQuantilePredictor {
        fn predict_quantiles(&self, features: &[f64], _alpha_low: f64, _alpha_high: f64) -> Result<(f64, f64)> {
            let center = features.iter().sum::<f64>() / features.len() as f64;
            Ok((center + self.lower_bias, center + self.upper_bias))
        }
    }

    #[test]
    fn test_cqr_creation() {
        let predictor = MockQuantilePredictor::new();
        let cqr = CQRPredictor::new(predictor, 0.1, (0.05, 0.95));

        assert_eq!(cqr.alpha(), 0.1);
        assert!(!cqr.is_calibrated());
    }

    #[test]
    fn test_cqr_calibration() {
        let predictor = MockQuantilePredictor::new();
        let mut cqr = CQRPredictor::new(predictor, 0.1, (0.05, 0.95));

        let features = vec![
            vec![100.0],
            vec![102.0],
            vec![98.0],
            vec![101.0],
            vec![99.0],
        ];
        let actuals = vec![101.0, 100.0, 99.0, 102.0, 98.0];

        let result = cqr.calibrate(&features, &actuals);
        assert!(result.is_ok());
        assert!(cqr.is_calibrated());
        assert_eq!(cqr.n_calibration(), 5);
    }

    #[test]
    fn test_cqr_prediction() {
        let predictor = MockQuantilePredictor::new();
        let mut cqr = CQRPredictor::new(predictor, 0.1, (0.05, 0.95));

        let features = vec![vec![100.0]; 10];
        let actuals = vec![100.0; 10];

        cqr.calibrate(&features, &actuals).unwrap();

        let features_test = vec![100.0];
        let interval = cqr.predict(&features_test).unwrap();

        assert_eq!(interval.alpha, 0.1);
        assert!(interval.lower <= interval.upper);
        assert_eq!(cqr.n_predictions(), 1);
    }

    #[test]
    fn test_cqr_errors() {
        let predictor = MockQuantilePredictor::new();
        let mut cqr = CQRPredictor::new(predictor, 0.1, (0.05, 0.95));

        // Test predict before calibration
        let err = cqr.predict(&[100.0]);
        assert!(err.is_err());

        // Test length mismatch
        let err = cqr.calibrate(&[vec![100.0], vec![101.0]], &[100.0]);
        assert!(err.is_err());

        // Test insufficient data
        let err = cqr.calibrate(&[vec![100.0]], &[100.0]);
        assert!(err.is_err());
    }

    #[test]
    #[should_panic]
    fn test_cqr_invalid_alpha() {
        let predictor = MockQuantilePredictor::new();
        let _ = CQRPredictor::new(predictor, 1.5, (0.05, 0.95));
    }

    #[test]
    #[should_panic]
    fn test_cqr_invalid_quantiles() {
        let predictor = MockQuantilePredictor::new();
        let _ = CQRPredictor::new(predictor, 0.1, (0.95, 0.05));
    }

    #[test]
    fn test_cqr_reset() {
        let predictor = MockQuantilePredictor::new();
        let mut cqr = CQRPredictor::new(predictor, 0.1, (0.05, 0.95));

        let features = vec![vec![100.0]; 10];
        let actuals = vec![100.0; 10];

        cqr.calibrate(&features, &actuals).unwrap();
        assert!(cqr.is_calibrated());

        cqr.reset();
        assert!(!cqr.is_calibrated());
        assert_eq!(cqr.n_calibration(), 0);
    }

    #[test]
    fn test_cqr_quantile_levels() {
        let predictor = MockQuantilePredictor::new();
        let cqr = CQRPredictor::new(predictor, 0.1, (0.05, 0.95));

        assert_eq!(cqr.quantile_levels(), (0.05, 0.95));
    }
}

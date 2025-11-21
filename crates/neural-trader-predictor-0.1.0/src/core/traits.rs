//! Traits for conformal prediction components

use crate::core::Result;

/// Nonconformity score function
///
/// A nonconformity score measures how different a prediction is from the actual value.
/// Lower scores indicate better conformity.
pub trait NonconformityScore: Send + Sync {
    /// Compute nonconformity score for a prediction-actual pair
    ///
    /// # Arguments
    /// * `prediction` - Model's point prediction
    /// * `actual` - Actual observed value
    ///
    /// # Returns
    /// Nonconformity score (higher = less conforming)
    fn score(&self, prediction: f64, actual: f64) -> f64;

    /// Compute prediction interval given a quantile threshold
    ///
    /// # Arguments
    /// * `prediction` - Model's point prediction
    /// * `quantile` - Quantile threshold from calibration
    ///
    /// # Returns
    /// Tuple of (lower_bound, upper_bound)
    fn interval(&self, prediction: f64, quantile: f64) -> (f64, f64) {
        // Default implementation: symmetric interval
        (prediction - quantile, prediction + quantile)
    }

    /// Clone the score function
    fn clone_box(&self) -> Box<dyn NonconformityScore>;
}

impl Clone for Box<dyn NonconformityScore> {
    fn clone(&self) -> Self {
        self.clone_box()
    }
}

/// Base model for making point predictions
///
/// This trait allows wrapping any model (neural network, XGBoost, etc.)
/// for use with conformal prediction.
pub trait BaseModel: Send + Sync {
    /// Make a point prediction for given features
    ///
    /// # Arguments
    /// * `features` - Input features
    ///
    /// # Returns
    /// Point prediction
    fn predict(&self, features: &[f64]) -> Result<f64>;

    /// Make batch predictions (optional optimization)
    ///
    /// # Arguments
    /// * `features` - Batch of input features
    ///
    /// # Returns
    /// Vector of predictions
    fn predict_batch(&self, features: &[Vec<f64>]) -> Result<Vec<f64>> {
        // Default implementation: loop over single predictions
        features.iter()
            .map(|f| self.predict(f))
            .collect()
    }
}

/// Quantile predictor for CQR (Conformalized Quantile Regression)
pub trait QuantilePredictor: Send + Sync {
    /// Predict lower and upper quantiles
    ///
    /// # Arguments
    /// * `features` - Input features
    /// * `alpha_low` - Lower quantile (e.g., 0.05)
    /// * `alpha_high` - Upper quantile (e.g., 0.95)
    ///
    /// # Returns
    /// Tuple of (lower_quantile, upper_quantile)
    fn predict_quantiles(&self, features: &[f64], alpha_low: f64, alpha_high: f64) -> Result<(f64, f64)>;
}

#[cfg(test)]
mod tests {
    use super::*;

    // Simple test score function
    struct TestScore;

    impl NonconformityScore for TestScore {
        fn score(&self, prediction: f64, actual: f64) -> f64 {
            (prediction - actual).abs()
        }

        fn clone_box(&self) -> Box<dyn NonconformityScore> {
            Box::new(TestScore)
        }
    }

    // Simple test model
    struct TestModel;

    impl BaseModel for TestModel {
        fn predict(&self, features: &[f64]) -> Result<f64> {
            Ok(features.iter().sum())
        }
    }

    #[test]
    fn test_score_trait() {
        let score = TestScore;
        assert_eq!(score.score(100.0, 105.0), 5.0);
        assert_eq!(score.score(105.0, 100.0), 5.0);
    }

    #[test]
    fn test_model_trait() {
        let model = TestModel;
        let features = vec![1.0, 2.0, 3.0];
        assert_eq!(model.predict(&features).unwrap(), 6.0);
    }

    #[test]
    fn test_interval_default() {
        let score = TestScore;
        let (lower, upper) = score.interval(100.0, 5.0);
        assert_eq!(lower, 95.0);
        assert_eq!(upper, 105.0);
    }
}

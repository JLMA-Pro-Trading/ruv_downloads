//! Normalized nonconformity score
//!
//! The normalized nonconformity score is defined as:
//! ρ(ŷ, y) = |ŷ - y| / (σ + ε)
//!
//! This divides the absolute residual by an estimate of the prediction uncertainty,
//! making it scale-adaptive and useful when predictions have heteroscedastic errors.

use crate::core::traits::NonconformityScore;

/// Normalized nonconformity score
///
/// Computes the normalized absolute residual by dividing by standard deviation.
/// Useful when predictions have different uncertainty levels (heteroscedastic errors).
///
/// # Formula
/// ρ(ŷ, y) = |ŷ - y| / (σ + ε)
///
/// where σ is the predicted standard deviation and ε is a small epsilon for numerical stability.
#[derive(Debug, Clone, Copy)]
pub struct NormalizedScore {
    /// Predicted standard deviation for the test point
    /// In practice, this would come from the base model or uncertainty estimation
    pub sigma: f64,

    /// Small constant for numerical stability (default: 1e-8)
    pub epsilon: f64,
}

impl NormalizedScore {
    /// Create a new normalized score with the given sigma
    ///
    /// # Arguments
    /// * `sigma` - Standard deviation estimate for the prediction
    ///
    /// # Panics
    /// Panics if sigma is negative (should be positive or zero)
    pub fn new(sigma: f64) -> Self {
        if sigma < 0.0 {
            panic!("sigma must be non-negative, got {}", sigma);
        }
        Self {
            sigma,
            epsilon: 1e-8,
        }
    }

    /// Create a new normalized score with custom epsilon
    pub fn with_epsilon(sigma: f64, epsilon: f64) -> Self {
        if sigma < 0.0 {
            panic!("sigma must be non-negative, got {}", sigma);
        }
        if epsilon < 0.0 {
            panic!("epsilon must be non-negative, got {}", epsilon);
        }
        Self { sigma, epsilon }
    }

    /// Update the sigma value
    pub fn set_sigma(&mut self, sigma: f64) {
        if sigma < 0.0 {
            panic!("sigma must be non-negative, got {}", sigma);
        }
        self.sigma = sigma;
    }
}

impl Default for NormalizedScore {
    fn default() -> Self {
        Self::new(1.0)
    }
}

impl NonconformityScore for NormalizedScore {
    fn score(&self, prediction: f64, actual: f64) -> f64 {
        let residual = (prediction - actual).abs();
        let denominator = self.sigma + self.epsilon;
        residual / denominator
    }

    fn interval(&self, prediction: f64, quantile: f64) -> (f64, f64) {
        // Scale-adaptive interval
        let half_width = quantile * (self.sigma + self.epsilon);
        (prediction - half_width, prediction + half_width)
    }

    fn clone_box(&self) -> Box<dyn NonconformityScore> {
        Box::new(*self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_abs_diff_eq;

    #[test]
    fn test_normalized_score_creation() {
        let score = NormalizedScore::new(1.5);
        assert_eq!(score.sigma, 1.5);
        assert_eq!(score.epsilon, 1e-8);

        let score = NormalizedScore::with_epsilon(2.0, 1e-6);
        assert_eq!(score.sigma, 2.0);
        assert_eq!(score.epsilon, 1e-6);
    }

    #[test]
    fn test_normalized_score_computation() {
        let score = NormalizedScore::new(2.0);

        // residual = 4, sigma = 2, result should be 2.0
        assert_abs_diff_eq!(score.score(100.0, 96.0), 2.0, epsilon = 1e-6);

        // residual = 2, sigma = 2, result should be 1.0
        assert_abs_diff_eq!(score.score(100.0, 98.0), 1.0, epsilon = 1e-6);

        // With very small sigma (close to epsilon)
        let score = NormalizedScore::with_epsilon(0.0, 1e-8);
        assert_abs_diff_eq!(score.score(100.0, 101.0), 1.0 / 1e-8, epsilon = 1e0);
    }

    #[test]
    fn test_normalized_score_interval() {
        let score = NormalizedScore::new(2.0);

        let (lower, upper) = score.interval(100.0, 0.5);
        assert_abs_diff_eq!(lower, 100.0 - 0.5 * 2.0, epsilon = 1e-6);
        assert_abs_diff_eq!(upper, 100.0 + 0.5 * 2.0, epsilon = 1e-6);

        // With larger sigma, interval should be wider
        let score_large = NormalizedScore::new(4.0);
        let (lower_lg, upper_lg) = score_large.interval(100.0, 0.5);
        assert!(upper_lg - lower_lg > upper - lower);
    }

    #[test]
    fn test_normalized_score_default() {
        let score = NormalizedScore::default();
        assert_eq!(score.sigma, 1.0);

        // With sigma=1, normalized score = absolute residual
        assert_abs_diff_eq!(score.score(100.0, 105.0), 5.0, epsilon = 1e-6);
    }

    #[test]
    fn test_normalized_score_set_sigma() {
        let mut score = NormalizedScore::new(1.0);
        score.set_sigma(2.0);
        assert_eq!(score.sigma, 2.0);

        // Score should change after update
        assert_abs_diff_eq!(score.score(100.0, 104.0), 2.0, epsilon = 1e-6);
    }

    #[test]
    fn test_normalized_score_clone() {
        let score = NormalizedScore::new(1.5);
        let boxed = score.clone_box();
        assert_abs_diff_eq!(boxed.score(100.0, 105.0), 5.0 / 1.5, epsilon = 1e-6);
    }

    #[test]
    #[should_panic]
    fn test_normalized_score_negative_sigma() {
        let _ = NormalizedScore::new(-1.0);
    }

    #[test]
    #[should_panic]
    fn test_normalized_score_set_negative_sigma() {
        let mut score = NormalizedScore::new(1.0);
        score.set_sigma(-0.5);
    }

    #[test]
    fn test_normalized_score_numerical_stability() {
        // Test with very small sigma
        let score = NormalizedScore::with_epsilon(1e-10, 1e-8);
        let result = score.score(100.0, 101.0);
        assert!(!result.is_nan());
        assert!(!result.is_infinite());

        // Test with very large values
        let score = NormalizedScore::new(1e6);
        let result = score.score(1e9, 1e9 + 1e6);
        assert!(!result.is_nan());
        assert_abs_diff_eq!(result, 1.0, epsilon = 1e-6);
    }
}

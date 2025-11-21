//! Absolute residual nonconformity score
//!
//! The absolute residual nonconformity score is defined as:
//! ρ(ŷ, y) = |ŷ - y|
//!
//! This is the simplest and most commonly used nonconformity score.
//! It measures the absolute difference between the prediction and the actual value.

use crate::core::traits::NonconformityScore;

/// Absolute residual nonconformity score
///
/// Computes the absolute difference between predicted and actual values.
/// This is the most basic and widely-used nonconformity measure.
///
/// # Formula
/// ρ(ŷ, y) = |ŷ - y|
///
/// # Examples
/// ```
/// use neural_trader_predictor::scores::AbsoluteScore;
/// use neural_trader_predictor::core::NonconformityScore;
///
/// let score = AbsoluteScore;
/// assert_eq!(score.score(100.0, 105.0), 5.0);
/// assert_eq!(score.score(105.0, 100.0), 5.0);
/// ```
#[derive(Debug, Clone, Copy)]
pub struct AbsoluteScore;

impl NonconformityScore for AbsoluteScore {
    fn score(&self, prediction: f64, actual: f64) -> f64 {
        (prediction - actual).abs()
    }

    fn interval(&self, prediction: f64, quantile: f64) -> (f64, f64) {
        // Symmetric interval around prediction
        (prediction - quantile, prediction + quantile)
    }

    fn clone_box(&self) -> Box<dyn NonconformityScore> {
        Box::new(*self)
    }
}

impl Default for AbsoluteScore {
    fn default() -> Self {
        Self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_absolute_score_basic() {
        let score = AbsoluteScore;

        // Test with prediction > actual
        assert_eq!(score.score(105.0, 100.0), 5.0);

        // Test with prediction < actual
        assert_eq!(score.score(95.0, 100.0), 5.0);

        // Test with exact match
        assert_eq!(score.score(100.0, 100.0), 0.0);

        // Test with negative values
        assert_eq!(score.score(-5.0, -10.0), 5.0);
        assert_eq!(score.score(-10.0, -5.0), 5.0);
    }

    #[test]
    fn test_absolute_score_interval() {
        let score = AbsoluteScore;

        let (lower, upper) = score.interval(100.0, 5.0);
        assert_eq!(lower, 95.0);
        assert_eq!(upper, 105.0);

        let (lower, upper) = score.interval(0.0, 2.5);
        assert_eq!(lower, -2.5);
        assert_eq!(upper, 2.5);

        // Test with zero quantile
        let (lower, upper) = score.interval(100.0, 0.0);
        assert_eq!(lower, 100.0);
        assert_eq!(upper, 100.0);
    }

    #[test]
    fn test_absolute_score_clone() {
        let score = AbsoluteScore;
        let boxed = score.clone_box();
        assert_eq!(boxed.score(100.0, 105.0), 5.0);
    }

    #[test]
    fn test_absolute_score_with_large_values() {
        let score = AbsoluteScore;

        assert_eq!(score.score(1e6, 1e6 + 1e3), 1e3);
        assert_eq!(score.score(1e-6, 2e-6), 1e-6);
    }

    #[test]
    fn test_absolute_score_with_inf_nan() {
        let score = AbsoluteScore;

        // Test with infinity
        let inf_score = score.score(f64::INFINITY, 100.0);
        assert!(inf_score.is_infinite());

        // Test with NaN - note that NaN != NaN
        let nan_score = score.score(f64::NAN, 100.0);
        assert!(nan_score.is_nan());
    }
}

//! Quantile-based nonconformity score for Conformalized Quantile Regression (CQR)
//!
//! The quantile-based nonconformity score is defined as:
//! ρ(ŷ_lower, ŷ_upper, y) = max(ŷ_lower - y, y - ŷ_upper, 0)
//!
//! This measures how much the actual value falls outside the predicted quantile interval.
//! It's specifically designed for Conformalized Quantile Regression.

use crate::core::traits::NonconformityScore;

/// Quantile-based nonconformity score for CQR
///
/// Measures how much the actual value violates the quantile-predicted interval.
/// Used in Conformalized Quantile Regression (CQR) to ensure coverage guarantees.
///
/// # Formula
/// ρ(ŷ_lower, ŷ_upper, y) = max(ŷ_lower - y, y - ŷ_upper, 0)
///
/// This is 0 if y is within [ŷ_lower, ŷ_upper], and positive otherwise.
#[derive(Debug, Clone, Copy)]
pub struct QuantileScore {
    /// Lower quantile prediction
    pub lower: f64,

    /// Upper quantile prediction
    pub upper: f64,
}

impl QuantileScore {
    /// Create a new quantile score from lower and upper quantile predictions
    ///
    /// # Arguments
    /// * `lower` - Lower quantile prediction (e.g., 0.05 quantile)
    /// * `upper` - Upper quantile prediction (e.g., 0.95 quantile)
    ///
    /// # Panics
    /// Panics if lower > upper
    pub fn new(lower: f64, upper: f64) -> Self {
        if lower > upper {
            panic!(
                "lower quantile must be <= upper quantile, got lower={}, upper={}",
                lower, upper
            );
        }
        Self { lower, upper }
    }

    /// Create from a quantile interval
    pub fn from_interval(interval: (f64, f64)) -> Self {
        Self::new(interval.0, interval.1)
    }

    /// Get the interval as a tuple
    pub fn interval(&self) -> (f64, f64) {
        (self.lower, self.upper)
    }

    /// Width of the quantile interval
    pub fn width(&self) -> f64 {
        self.upper - self.lower
    }

    /// Update the quantile predictions
    pub fn set_quantiles(&mut self, lower: f64, upper: f64) {
        if lower > upper {
            panic!(
                "lower quantile must be <= upper quantile, got lower={}, upper={}",
                lower, upper
            );
        }
        self.lower = lower;
        self.upper = upper;
    }
}

impl Default for QuantileScore {
    fn default() -> Self {
        // Default to reasonable 90% interval
        Self::new(5.0, 95.0)
    }
}

impl NonconformityScore for QuantileScore {
    /// Compute how much the actual value violates the quantile interval
    fn score(&self, _prediction: f64, actual: f64) -> f64 {
        // Note: _prediction is ignored for quantile score
        // We use lower and upper instead
        let below = self.lower - actual;
        let above = actual - self.upper;
        below.max(above).max(0.0)
    }

    /// For quantile score, the interval is just [lower, upper]
    fn interval(&self, _prediction: f64, _quantile: f64) -> (f64, f64) {
        // Ignore point prediction and quantile threshold
        // Use the quantile predictions directly
        (self.lower, self.upper)
    }

    fn clone_box(&self) -> Box<dyn NonconformityScore> {
        Box::new(*self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_quantile_score_creation() {
        let score = QuantileScore::new(10.0, 20.0);
        assert_eq!(score.lower, 10.0);
        assert_eq!(score.upper, 20.0);

        let score = QuantileScore::from_interval((10.0, 20.0));
        assert_eq!(score.lower, 10.0);
        assert_eq!(score.upper, 20.0);

        let score = QuantileScore::default();
        assert_eq!(score.lower, 5.0);
        assert_eq!(score.upper, 95.0);
    }

    #[test]
    fn test_quantile_score_width() {
        let score = QuantileScore::new(10.0, 20.0);
        assert_eq!(score.width(), 10.0);

        let score = QuantileScore::new(5.0, 95.0);
        assert_eq!(score.width(), 90.0);
    }

    #[test]
    fn test_quantile_score_computation() {
        let score = QuantileScore::new(10.0, 20.0);

        // Value inside interval - score should be 0
        assert_eq!(score.score(15.0, 15.0), 0.0);
        assert_eq!(score.score(15.0, 10.0), 0.0);
        assert_eq!(score.score(15.0, 20.0), 0.0);

        // Value below interval
        assert_eq!(score.score(15.0, 5.0), 5.0); // 10 - 5 = 5
        assert_eq!(score.score(15.0, 0.0), 10.0); // 10 - 0 = 10

        // Value above interval
        assert_eq!(score.score(15.0, 25.0), 5.0); // 25 - 20 = 5
        assert_eq!(score.score(15.0, 100.0), 80.0); // 100 - 20 = 80
    }

    #[test]
    fn test_quantile_score_interval() {
        let score = QuantileScore::new(10.0, 20.0);

        // interval() should return the quantile interval
        let (lower, upper) = score.interval();
        assert_eq!(lower, 10.0);
        assert_eq!(upper, 20.0);
    }

    #[test]
    fn test_quantile_score_set_quantiles() {
        let mut score = QuantileScore::new(10.0, 20.0);
        score.set_quantiles(5.0, 15.0);
        assert_eq!(score.lower, 5.0);
        assert_eq!(score.upper, 15.0);

        // Score should change after update
        assert_eq!(score.score(15.0, 25.0), 10.0); // 25 - 15 = 10
    }

    #[test]
    fn test_quantile_score_clone() {
        let score = QuantileScore::new(10.0, 20.0);
        let boxed = score.clone_box();
        assert_eq!(boxed.score(15.0, 5.0), 5.0);
        assert_eq!(boxed.score(15.0, 25.0), 5.0);
    }

    #[test]
    fn test_quantile_score_edge_cases() {
        let score = QuantileScore::new(0.0, 0.0);
        // When lower == upper, any deviation has a score
        assert_eq!(score.score(0.0, 0.0), 0.0);
        assert_eq!(score.score(0.0, 1.0), 1.0);
        assert_eq!(score.score(0.0, -1.0), 1.0);
    }

    #[test]
    fn test_quantile_score_negative_values() {
        let score = QuantileScore::new(-20.0, -10.0);

        // Inside interval
        assert_eq!(score.score(0.0, -15.0), 0.0);

        // Below interval
        assert_eq!(score.score(0.0, -25.0), 5.0); // -20 - (-25) = 5

        // Above interval
        assert_eq!(score.score(0.0, -5.0), 5.0); // -5 - (-10) = 5
    }

    #[test]
    #[should_panic]
    fn test_quantile_score_invalid_order() {
        let _ = QuantileScore::new(20.0, 10.0);
    }

    #[test]
    #[should_panic]
    fn test_quantile_score_set_invalid_order() {
        let mut score = QuantileScore::new(10.0, 20.0);
        score.set_quantiles(30.0, 20.0);
    }

    #[test]
    fn test_quantile_score_with_large_values() {
        let score = QuantileScore::new(1e6, 2e6);

        // Inside
        assert_eq!(score.score(1.5e6, 1.5e6), 0.0);

        // Below
        assert_eq!(score.score(1.5e6, 0.5e6), 0.5e6);

        // Above
        assert_eq!(score.score(1.5e6, 2.5e6), 0.5e6);
    }
}

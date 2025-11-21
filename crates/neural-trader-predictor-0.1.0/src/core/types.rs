//! Core types for conformal prediction

use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

/// Prediction interval with guaranteed coverage
///
/// Mathematical guarantee: P(y ∈ [lower, upper]) ≥ 1 - α
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionInterval {
    /// Point prediction from base model
    pub point: f64,

    /// Lower bound of prediction interval
    pub lower: f64,

    /// Upper bound of prediction interval
    pub upper: f64,

    /// Miscoverage rate (1 - coverage)
    pub alpha: f64,

    /// Computed quantile threshold
    pub quantile: f64,

    /// Timestamp of prediction
    #[serde(with = "chrono::serde::ts_seconds")]
    pub timestamp: DateTime<Utc>,
}

impl PredictionInterval {
    /// Create a new prediction interval
    pub fn new(point: f64, lower: f64, upper: f64, alpha: f64, quantile: f64) -> Self {
        Self {
            point,
            lower,
            upper,
            alpha,
            quantile,
            timestamp: Utc::now(),
        }
    }

    /// Width of the prediction interval
    #[inline]
    pub fn width(&self) -> f64 {
        self.upper - self.lower
    }

    /// Check if a value is contained in the interval
    #[inline]
    pub fn contains(&self, value: f64) -> bool {
        value >= self.lower && value <= self.upper
    }

    /// Relative width as percentage of point prediction
    #[inline]
    pub fn relative_width(&self) -> f64 {
        if self.point.abs() < f64::EPSILON {
            f64::INFINITY
        } else {
            self.width() / self.point.abs() * 100.0
        }
    }

    /// Expected coverage (1 - alpha)
    #[inline]
    pub fn coverage(&self) -> f64 {
        1.0 - self.alpha
    }
}

/// Configuration for conformal predictor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictorConfig {
    /// Miscoverage rate (e.g., 0.1 for 90% coverage)
    pub alpha: f64,

    /// Maximum calibration set size
    pub calibration_size: usize,

    /// Maximum interval width as percentage
    pub max_interval_width_pct: f64,

    /// Recalibration frequency (number of predictions)
    pub recalibration_freq: usize,
}

impl Default for PredictorConfig {
    fn default() -> Self {
        Self {
            alpha: 0.1,
            calibration_size: 2000,
            max_interval_width_pct: 5.0,
            recalibration_freq: 100,
        }
    }
}

/// Configuration for adaptive conformal inference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdaptiveConfig {
    /// Target coverage (e.g., 0.90 for 90%)
    pub target_coverage: f64,

    /// Learning rate for PID control
    pub gamma: f64,

    /// Window size for coverage tracking
    pub coverage_window: usize,

    /// Minimum alpha value
    pub alpha_min: f64,

    /// Maximum alpha value
    pub alpha_max: f64,
}

impl Default for AdaptiveConfig {
    fn default() -> Self {
        Self {
            target_coverage: 0.90,
            gamma: 0.02,
            coverage_window: 200,
            alpha_min: 0.01,
            alpha_max: 0.30,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prediction_interval() {
        let interval = PredictionInterval::new(100.0, 95.0, 105.0, 0.1, 5.0);

        assert_eq!(interval.width(), 10.0);
        assert_eq!(interval.coverage(), 0.9);
        assert_eq!(interval.relative_width(), 10.0);

        assert!(interval.contains(100.0));
        assert!(interval.contains(95.0));
        assert!(interval.contains(105.0));
        assert!(!interval.contains(94.9));
        assert!(!interval.contains(105.1));
    }

    #[test]
    fn test_config_defaults() {
        let config = PredictorConfig::default();
        assert_eq!(config.alpha, 0.1);
        assert_eq!(config.calibration_size, 2000);

        let adaptive = AdaptiveConfig::default();
        assert_eq!(adaptive.target_coverage, 0.90);
        assert_eq!(adaptive.gamma, 0.02);
    }
}

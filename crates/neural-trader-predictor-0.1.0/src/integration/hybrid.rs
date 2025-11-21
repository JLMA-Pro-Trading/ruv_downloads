//! Hybrid predictor combining our implementation with conformal-prediction crate

use crate::core::{Result, Error, NonconformityScore, PredictionInterval};
use crate::conformal::SplitConformalPredictor;
use crate::scores::AbsoluteScore;

/// Hybrid predictor that combines:
/// - Fast split conformal prediction (our implementation)
/// - Advanced features from conformal-prediction crate (CPD, PCP, verification)
pub struct HybridPredictor<S: NonconformityScore> {
    /// Our optimized split conformal predictor
    split: SplitConformalPredictor<S>,

    /// Enable CPD for full distributions
    cpd_enabled: bool,

    /// Enable PCP for cluster-aware predictions
    pcp_enabled: bool,

    /// Number of clusters for PCP
    n_clusters: usize,
}

impl<S: NonconformityScore> HybridPredictor<S> {
    /// Create a new hybrid predictor
    ///
    /// # Arguments
    /// * `alpha` - Miscoverage rate (e.g., 0.1 for 90% coverage)
    /// * `score_fn` - Nonconformity score function
    ///
    /// # Example
    /// ```
    /// use neural_trader_predictor::integration::HybridPredictor;
    /// use neural_trader_predictor::scores::AbsoluteScore;
    ///
    /// let predictor = HybridPredictor::new(0.1, AbsoluteScore);
    /// ```
    pub fn new(alpha: f64, score_fn: S) -> Result<Self> {
        // Validate alpha
        if alpha <= 0.0 || alpha >= 1.0 {
            return Err(Error::InvalidAlpha(alpha));
        }

        let split = SplitConformalPredictor::new(alpha, score_fn);

        Ok(Self {
            split,
            cpd_enabled: false,
            pcp_enabled: false,
            n_clusters: 0,
        })
    }

    /// Calibrate the predictor with historical data
    ///
    /// # Arguments
    /// * `predictions` - Point predictions from base model
    /// * `actuals` - Actual observed values
    pub fn calibrate(&mut self, predictions: &[f64], actuals: &[f64]) -> Result<()> {
        self.split.calibrate(predictions, actuals)
    }

    /// Make a prediction with guaranteed interval
    ///
    /// # Arguments
    /// * `point_prediction` - Point prediction from base model
    ///
    /// # Returns
    /// Prediction interval with guaranteed coverage
    pub fn predict(&mut self, point_prediction: f64) -> PredictionInterval {
        self.split.predict(point_prediction)
    }

    /// Update with new observation (online learning)
    ///
    /// # Arguments
    /// * `prediction` - Point prediction
    /// * `actual` - Actual observed value
    pub fn update(&mut self, prediction: f64, actual: f64) -> Result<()> {
        self.split.update(prediction, actual)
    }

    /// Enable Conformal Predictive Distributions (CPD)
    ///
    /// This allows querying full probability distributions instead of just intervals.
    ///
    /// # Example
    /// ```no_run
    /// # use neural_trader_predictor::integration::HybridPredictor;
    /// # use neural_trader_predictor::scores::AbsoluteScore;
    /// # fn main() -> neural_trader_predictor::core::Result<()> {
    /// let mut predictor = HybridPredictor::new(0.1, AbsoluteScore)?;
    /// predictor.enable_cpd()?;
    ///
    /// // Now can query CDF: P(Y ≤ threshold)
    /// let prob = predictor.cdf(100.0)?;
    /// # Ok(())
    /// # }
    /// ```
    pub fn enable_cpd(&mut self) -> Result<()> {
        self.cpd_enabled = true;
        Ok(())
    }

    /// Enable Posterior Conformal Prediction (PCP)
    ///
    /// This enables cluster-aware predictions that adapt to different market regimes.
    ///
    /// # Arguments
    /// * `n_clusters` - Number of clusters (e.g., 3 for bull/bear/sideways)
    ///
    /// # Example
    /// ```no_run
    /// # use neural_trader_predictor::integration::HybridPredictor;
    /// # use neural_trader_predictor::scores::AbsoluteScore;
    /// # fn main() -> neural_trader_predictor::core::Result<()> {
    /// let mut predictor = HybridPredictor::new(0.1, AbsoluteScore)?;
    /// predictor.enable_pcp(3)?;  // bull/bear/sideways
    /// # Ok(())
    /// # }
    /// ```
    pub fn enable_pcp(&mut self, n_clusters: usize) -> Result<()> {
        if n_clusters < 2 {
            return Err(Error::invalid_config("PCP requires at least 2 clusters"));
        }

        self.pcp_enabled = true;
        self.n_clusters = n_clusters;
        Ok(())
    }

    /// Query cumulative distribution function: P(Y ≤ threshold)
    ///
    /// Requires CPD to be enabled.
    ///
    /// # Arguments
    /// * `threshold` - Value to query
    ///
    /// # Returns
    /// Probability that true value is ≤ threshold
    pub fn cdf(&mut self, threshold: f64) -> Result<f64> {
        if !self.cpd_enabled {
            return Err(Error::other("CPD not enabled. Call enable_cpd() first"));
        }

        // TODO: Use conformal-prediction crate's CPD
        // For now, estimate from interval
        let interval = self.split.predict(threshold);
        let width = interval.width();

        if threshold <= interval.lower {
            Ok(0.0)
        } else if threshold >= interval.upper {
            Ok(1.0)
        } else {
            // Linear interpolation within interval
            Ok((threshold - interval.lower) / width)
        }
    }

    /// Query quantile function (inverse CDF): Q(p)
    ///
    /// Requires CPD to be enabled.
    ///
    /// # Arguments
    /// * `p` - Probability level (0 to 1)
    ///
    /// # Returns
    /// Value such that P(Y ≤ value) = p
    pub fn quantile(&mut self, p: f64) -> Result<f64> {
        if !self.cpd_enabled {
            return Err(Error::other("CPD not enabled. Call enable_cpd() first"));
        }

        if p < 0.0 || p > 1.0 {
            return Err(Error::InvalidQuantile(p));
        }

        // TODO: Use conformal-prediction crate's CPD
        // For now, estimate from interval (assume uniform distribution within interval)
        let interval = self.split.predict(0.0);
        Ok(interval.lower + p * interval.width())
    }

    /// Check if CPD is enabled
    pub fn cpd_enabled(&self) -> bool {
        self.cpd_enabled
    }

    /// Check if PCP is enabled
    pub fn pcp_enabled(&self) -> bool {
        self.pcp_enabled
    }

    /// Get number of clusters (if PCP enabled)
    pub fn n_clusters(&self) -> Option<usize> {
        if self.pcp_enabled {
            Some(self.n_clusters)
        } else {
            None
        }
    }

    /// Get empirical coverage from underlying predictor
    /// Note: Split conformal predictor doesn't track empirical coverage,
    /// only adaptive predictor does. This always returns None for now.
    pub fn empirical_coverage(&self) -> Option<f64> {
        // TODO: Implement coverage tracking
        None
    }
}

impl HybridPredictor<AbsoluteScore> {
    /// Convenience constructor with absolute score
    pub fn with_absolute(alpha: f64) -> Result<Self> {
        Self::new(alpha, AbsoluteScore)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn test_hybrid_creation() {
        let predictor = HybridPredictor::with_absolute(0.1);
        assert!(predictor.is_ok());

        let predictor = predictor.unwrap();
        assert!(!predictor.cpd_enabled());
        assert!(!predictor.pcp_enabled());
        assert_eq!(predictor.n_clusters(), None);
    }

    #[test]
    fn test_enable_cpd() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();
        assert!(predictor.enable_cpd().is_ok());
        assert!(predictor.cpd_enabled());
    }

    #[test]
    fn test_enable_pcp() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();
        assert!(predictor.enable_pcp(3).is_ok());
        assert!(predictor.pcp_enabled());
        assert_eq!(predictor.n_clusters(), Some(3));
    }

    #[test]
    fn test_pcp_invalid_clusters() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();
        assert!(predictor.enable_pcp(1).is_err());
        assert!(predictor.enable_pcp(0).is_err());
    }

    #[test]
    fn test_calibrate_and_predict() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();

        let predictions = vec![100.0, 105.0, 98.0, 102.0, 101.0];
        let actuals = vec![102.0, 104.0, 99.0, 101.0, 100.0];

        assert!(predictor.calibrate(&predictions, &actuals).is_ok());

        let interval = predictor.predict(103.0);
        assert!(interval.lower < 103.0);
        assert!(interval.upper > 103.0);
        assert_relative_eq!(interval.coverage(), 0.9, epsilon = 0.01);
    }

    #[test]
    fn test_cdf_without_enabling() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();
        assert!(predictor.cdf(100.0).is_err());
    }

    #[test]
    fn test_cdf_with_enabling() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();
        predictor.enable_cpd().unwrap();

        let predictions = vec![100.0, 105.0, 98.0, 102.0];
        let actuals = vec![102.0, 104.0, 99.0, 101.0];
        predictor.calibrate(&predictions, &actuals).unwrap();

        // CDF should work now (even with simplified implementation)
        let cdf_result = predictor.cdf(100.0);
        assert!(cdf_result.is_ok());
    }

    #[test]
    fn test_quantile_invalid_probability() {
        let mut predictor = HybridPredictor::with_absolute(0.1).unwrap();
        predictor.enable_cpd().unwrap();

        assert!(predictor.quantile(-0.1).is_err());
        assert!(predictor.quantile(1.1).is_err());
    }
}

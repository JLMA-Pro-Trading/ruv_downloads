//! Wrapper for Posterior Conformal Prediction (PCP)

use crate::core::Result;

/// Market regime detection
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MarketRegime {
    /// Bull market (uptrend)
    Bull,
    /// Bear market (downtrend)
    Bear,
    /// Sideways market (range-bound)
    Sideways,
}

/// Wrapper for PCP functionality from conformal-prediction crate
///
/// Provides cluster-aware predictions that adapt to market regimes.
pub struct PCPWrapper {
    /// Number of clusters
    n_clusters: usize,

    /// Whether PCP is initialized
    initialized: bool,

    /// Current detected regime (if n_clusters == 3)
    current_regime: Option<MarketRegime>,
}

impl PCPWrapper {
    /// Create a new PCP wrapper
    ///
    /// # Arguments
    /// * `n_clusters` - Number of clusters (e.g., 3 for bull/bear/sideways)
    pub fn new(n_clusters: usize) -> Result<Self> {
        if n_clusters < 2 {
            return Err(crate::core::Error::invalid_config(
                "PCP requires at least 2 clusters",
            ));
        }

        Ok(Self {
            n_clusters,
            initialized: false,
            current_regime: None,
        })
    }

    /// Initialize PCP with calibration data
    ///
    /// # Arguments
    /// * `features` - Feature vectors for clustering
    /// * `predictions` - Point predictions
    /// * `actuals` - Actual values
    pub fn calibrate(
        &mut self,
        _features: &[Vec<f64>],
        _predictions: &[f64],
        _actuals: &[f64],
    ) -> Result<()> {
        // TODO: Use conformal_prediction::pcp::PosteriorConformalPredictor
        self.initialized = true;
        Ok(())
    }

    /// Make cluster-aware prediction
    ///
    /// # Arguments
    /// * `features` - Feature vector for clustering
    /// * `point_prediction` - Point prediction from base model
    ///
    /// # Returns
    /// Prediction interval adapted to detected cluster/regime
    pub fn predict(&self, _features: &[f64], _point_prediction: f64) -> Result<(f64, f64)> {
        if !self.initialized {
            return Err(crate::core::Error::NotCalibrated);
        }

        // TODO: Use PCP to get cluster-specific interval
        Ok((0.0, 0.0))
    }

    /// Get current market regime (if n_clusters == 3)
    pub fn current_regime(&self) -> Option<MarketRegime> {
        self.current_regime
    }

    /// Get number of clusters
    pub fn n_clusters(&self) -> usize {
        self.n_clusters
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pcp_creation() {
        let pcp = PCPWrapper::new(3);
        assert!(pcp.is_ok());

        let pcp = pcp.unwrap();
        assert_eq!(pcp.n_clusters(), 3);
        assert!(!pcp.initialized);
    }

    #[test]
    fn test_pcp_invalid_clusters() {
        assert!(PCPWrapper::new(0).is_err());
        assert!(PCPWrapper::new(1).is_err());
    }

    #[test]
    fn test_pcp_not_calibrated() {
        let pcp = PCPWrapper::new(3).unwrap();
        assert!(pcp.predict(&[1.0, 2.0], 100.0).is_err());
    }
}

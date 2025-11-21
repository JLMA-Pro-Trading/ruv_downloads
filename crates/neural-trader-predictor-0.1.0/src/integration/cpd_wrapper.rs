//! Wrapper for Conformal Predictive Distributions (CPD)

use crate::core::Result;

/// Wrapper for CPD functionality from conformal-prediction crate
///
/// Provides full probability distributions instead of just intervals.
pub struct CPDWrapper {
    /// Whether CPD is initialized
    initialized: bool,
}

impl CPDWrapper {
    /// Create a new CPD wrapper
    pub fn new() -> Self {
        Self {
            initialized: false,
        }
    }

    /// Initialize CPD with calibration data
    ///
    /// # Arguments
    /// * `predictions` - Point predictions
    /// * `actuals` - Actual values
    pub fn calibrate(&mut self, _predictions: &[f64], _actuals: &[f64]) -> Result<()> {
        // TODO: Use conformal_prediction::cpd::calibrate_cpd
        self.initialized = true;
        Ok(())
    }

    /// Query CDF: P(Y ≤ threshold)
    pub fn cdf(&self, _threshold: f64) -> Result<f64> {
        if !self.initialized {
            return Err(crate::core::Error::NotCalibrated);
        }

        // TODO: Use conformal_prediction CDF
        Ok(0.5)
    }

    /// Query quantile: inverse CDF
    pub fn quantile(&self, _p: f64) -> Result<f64> {
        if !self.initialized {
            return Err(crate::core::Error::NotCalibrated);
        }

        // TODO: Use conformal_prediction quantile
        Ok(0.0)
    }

    /// Get mean of the distribution
    pub fn mean(&self) -> Result<f64> {
        if !self.initialized {
            return Err(crate::core::Error::NotCalibrated);
        }

        // TODO: Compute from CPD
        Ok(0.0)
    }

    /// Get variance of the distribution
    pub fn variance(&self) -> Result<f64> {
        if !self.initialized {
            return Err(crate::core::Error::NotCalibrated);
        }

        // TODO: Compute from CPD
        Ok(1.0)
    }
}

impl Default for CPDWrapper {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpd_creation() {
        let cpd = CPDWrapper::new();
        assert!(!cpd.initialized);
    }

    #[test]
    fn test_cpd_not_calibrated() {
        let cpd = CPDWrapper::new();
        assert!(cpd.cdf(0.0).is_err());
        assert!(cpd.quantile(0.5).is_err());
    }
}

// Feature normalization for neural network inputs
//
// Supports: Min-Max, Z-Score, Robust scaling

use crate::{FeatureError, Result};

#[derive(Debug, Clone, Copy)]
pub enum NormalizationMethod {
    MinMax,
    ZScore,
    Robust,
}

pub struct FeatureNormalizer {
    method: NormalizationMethod,
    min: Option<f64>,
    max: Option<f64>,
    mean: Option<f64>,
    std_dev: Option<f64>,
    median: Option<f64>,
    q25: Option<f64>,
    q75: Option<f64>,
}

impl FeatureNormalizer {
    pub fn new(method: NormalizationMethod) -> Self {
        Self {
            method,
            min: None,
            max: None,
            mean: None,
            std_dev: None,
            median: None,
            q25: None,
            q75: None,
        }
    }

    /// Fit normalizer to data
    pub fn fit(&mut self, data: &[f64]) -> Result<()> {
        if data.is_empty() {
            return Err(FeatureError::InsufficientData(1));
        }

        match self.method {
            NormalizationMethod::MinMax => {
                self.min = Some(data.iter().copied().fold(f64::INFINITY, f64::min));
                self.max = Some(data.iter().copied().fold(f64::NEG_INFINITY, f64::max));
            }
            NormalizationMethod::ZScore => {
                let mean = data.iter().sum::<f64>() / data.len() as f64;
                let variance =
                    data.iter().map(|&x| (x - mean).powi(2)).sum::<f64>() / data.len() as f64;
                let std_dev = variance.sqrt();

                self.mean = Some(mean);
                self.std_dev = Some(std_dev);
            }
            NormalizationMethod::Robust => {
                let mut sorted = data.to_vec();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

                let q25_idx = sorted.len() / 4;
                let median_idx = sorted.len() / 2;
                let q75_idx = (sorted.len() * 3) / 4;

                self.q25 = Some(sorted[q25_idx]);
                self.median = Some(sorted[median_idx]);
                self.q75 = Some(sorted[q75_idx]);
            }
        }

        Ok(())
    }

    /// Transform single value
    pub fn transform(&self, value: f64) -> Result<f64> {
        match self.method {
            NormalizationMethod::MinMax => {
                let min = self.min.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let max = self.max.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;

                if (max - min).abs() < 1e-10 {
                    return Ok(0.0);
                }

                Ok((value - min) / (max - min))
            }
            NormalizationMethod::ZScore => {
                let mean = self.mean.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let std_dev = self.std_dev.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;

                if std_dev.abs() < 1e-10 {
                    return Ok(0.0);
                }

                Ok((value - mean) / std_dev)
            }
            NormalizationMethod::Robust => {
                let median = self.median.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let q25 = self.q25.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let q75 = self.q75.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;

                let iqr = q75 - q25;
                if iqr.abs() < 1e-10 {
                    return Ok(0.0);
                }

                Ok((value - median) / iqr)
            }
        }
    }

    /// Transform batch of values
    pub fn transform_batch(&self, values: &[f64]) -> Result<Vec<f64>> {
        values.iter().map(|&v| self.transform(v)).collect()
    }

    /// Inverse transform (denormalize)
    pub fn inverse_transform(&self, normalized: f64) -> Result<f64> {
        match self.method {
            NormalizationMethod::MinMax => {
                let min = self.min.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let max = self.max.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;

                Ok(normalized * (max - min) + min)
            }
            NormalizationMethod::ZScore => {
                let mean = self.mean.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let std_dev = self.std_dev.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;

                Ok(normalized * std_dev + mean)
            }
            NormalizationMethod::Robust => {
                let median = self.median.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let q25 = self.q25.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;
                let q75 = self.q75.ok_or_else(|| {
                    FeatureError::InvalidParameter("Normalizer not fitted".to_string())
                })?;

                let iqr = q75 - q25;
                Ok(normalized * iqr + median)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;

    #[test]
    fn test_minmax_normalization() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let mut normalizer = FeatureNormalizer::new(NormalizationMethod::MinMax);

        normalizer.fit(&data).unwrap();

        assert_relative_eq!(normalizer.transform(1.0).unwrap(), 0.0, epsilon = 1e-6);
        assert_relative_eq!(normalizer.transform(5.0).unwrap(), 1.0, epsilon = 1e-6);
        assert_relative_eq!(normalizer.transform(3.0).unwrap(), 0.5, epsilon = 1e-6);
    }

    #[test]
    fn test_zscore_normalization() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let mut normalizer = FeatureNormalizer::new(NormalizationMethod::ZScore);

        normalizer.fit(&data).unwrap();

        let mean = normalizer.transform(3.0).unwrap();
        assert_relative_eq!(mean, 0.0, epsilon = 1e-6);
    }

    #[test]
    fn test_robust_normalization() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 100.0]; // With outlier
        let mut normalizer = FeatureNormalizer::new(NormalizationMethod::Robust);

        normalizer.fit(&data).unwrap();

        // Median should be normalized to 0
        let median_normalized = normalizer.transform(3.0).unwrap();
        assert_relative_eq!(median_normalized, 0.0, epsilon = 1e-6);
    }

    #[test]
    fn test_inverse_transform() {
        let data = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        let mut normalizer = FeatureNormalizer::new(NormalizationMethod::MinMax);

        normalizer.fit(&data).unwrap();

        let normalized = normalizer.transform(30.0).unwrap();
        let original = normalizer.inverse_transform(normalized).unwrap();

        assert_relative_eq!(original, 30.0, epsilon = 1e-6);
    }

    #[test]
    fn test_batch_transform() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let mut normalizer = FeatureNormalizer::new(NormalizationMethod::MinMax);

        normalizer.fit(&data).unwrap();

        let test_data = vec![1.0, 3.0, 5.0];
        let normalized = normalizer.transform_batch(&test_data).unwrap();

        assert_relative_eq!(normalized[0], 0.0, epsilon = 1e-6);
        assert_relative_eq!(normalized[1], 0.5, epsilon = 1e-6);
        assert_relative_eq!(normalized[2], 1.0, epsilon = 1e-6);
    }

    #[test]
    fn test_unfitted_normalizer() {
        let normalizer = FeatureNormalizer::new(NormalizationMethod::MinMax);
        let result = normalizer.transform(5.0);
        assert!(result.is_err());
    }
}

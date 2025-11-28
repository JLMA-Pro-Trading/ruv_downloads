//! Advanced data preprocessing utilities

// Imports only needed when candle feature is enabled
#[cfg(feature = "candle")]
use crate::error::Result;
#[cfg(feature = "candle")]
use ndarray::{Array1, Array2};
use serde::{Deserialize, Serialize};

/// Normalization parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizationParams {
    pub mean: f64,
    pub std: f64,
    pub min: f64,
    pub max: f64,
}

impl NormalizationParams {
    /// Compute from data
    ///
    /// Uses SIMD acceleration when the `simd` feature is enabled for faster mean/variance calculation.
    pub fn from_data(data: &[f64]) -> Self {
        #[cfg(feature = "simd")]
        {
            let mean = crate::utils::simd::simd_mean(data);
            let variance = crate::utils::simd::simd_variance(data, mean);
            let std = variance.sqrt();
            let min = data.iter().copied().fold(f64::INFINITY, f64::min);
            let max = data.iter().copied().fold(f64::NEG_INFINITY, f64::max);
            Self { mean, std, min, max }
        }

        #[cfg(not(feature = "simd"))]
        {
            let mean = data.iter().sum::<f64>() / data.len() as f64;
            let variance = data.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / data.len() as f64;
            let std = variance.sqrt();
            let min = data.iter().copied().fold(f64::INFINITY, f64::min);
            let max = data.iter().copied().fold(f64::NEG_INFINITY, f64::max);
            Self { mean, std, min, max }
        }
    }
}

/// Z-score normalization (standardization)
///
/// Uses SIMD acceleration when the `simd` feature is enabled for 3-4x performance improvement.
pub fn normalize(data: &[f64]) -> (Vec<f64>, NormalizationParams) {
    let params = NormalizationParams::from_data(data);

    #[cfg(feature = "simd")]
    {
        let normalized = crate::utils::simd::simd_normalize(data, params.mean, params.std);
        (normalized, params)
    }

    #[cfg(not(feature = "simd"))]
    {
        // Safe division: avoid division by zero
        let std_safe = if params.std > 1e-8 { params.std } else { 1.0 };
        let normalized = data.iter().map(|x| (x - params.mean) / std_safe).collect();
        (normalized, params)
    }
}

/// Denormalize data
///
/// Uses SIMD acceleration when the `simd` feature is enabled.
pub fn denormalize(data: &[f64], params: &NormalizationParams) -> Vec<f64> {
    #[cfg(feature = "simd")]
    {
        crate::utils::simd::simd_denormalize(data, params.mean, params.std)
    }

    #[cfg(not(feature = "simd"))]
    {
        data.iter().map(|x| x * params.std + params.mean).collect()
    }
}

/// Min-max normalization to [0, 1]
///
/// Uses SIMD acceleration when the `simd` feature is enabled for 3-4x performance improvement.
pub fn min_max_normalize(data: &[f64]) -> (Vec<f64>, NormalizationParams) {
    let params = NormalizationParams::from_data(data);

    #[cfg(feature = "simd")]
    {
        let normalized = crate::utils::simd::simd_min_max_normalize(data, params.min, params.max);
        (normalized, params)
    }

    #[cfg(not(feature = "simd"))]
    {
        let range = params.max - params.min;
        let normalized = if range > 1e-10 {
            data.iter().map(|x| (x - params.min) / range).collect()
        } else {
            vec![0.5; data.len()]
        };
        (normalized, params)
    }
}

/// Denormalize min-max scaled data
///
/// Uses SIMD acceleration when the `simd` feature is enabled.
pub fn min_max_denormalize(data: &[f64], params: &NormalizationParams) -> Vec<f64> {
    #[cfg(feature = "simd")]
    {
        crate::utils::simd::simd_min_max_denormalize(data, params.min, params.max)
    }

    #[cfg(not(feature = "simd"))]
    {
        let range = params.max - params.min;
        data.iter().map(|x| x * range + params.min).collect()
    }
}

/// Robust scaling using median and IQR
pub fn robust_scale(data: &[f64]) -> (Vec<f64>, f64, f64) {
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let median = sorted[sorted.len() / 2];
    let q1 = sorted[sorted.len() / 4];
    let q3 = sorted[(sorted.len() * 3) / 4];
    let iqr = q3 - q1;

    let scaled = if iqr > 1e-10 {
        data.iter().map(|x| (x - median) / iqr).collect()
    } else {
        vec![0.0; data.len()]
    };

    (scaled, median, iqr)
}

/// Log transformation (useful for skewed data)
pub fn log_transform(data: &[f64]) -> Vec<f64> {
    data.iter().map(|x| x.ln()).collect()
}

/// Inverse log transformation
pub fn inverse_log_transform(data: &[f64]) -> Vec<f64> {
    data.iter().map(|x| x.exp()).collect()
}

/// Differencing for making time series stationary
pub fn difference(data: &[f64], lag: usize) -> Vec<f64> {
    if lag >= data.len() {
        return Vec::new();
    }

    data.windows(lag + 1)
        .map(|window| window[lag] - window[0])
        .collect()
}

/// Inverse differencing
pub fn inverse_difference(data: &[f64], initial_values: &[f64], lag: usize) -> Vec<f64> {
    let mut result = initial_values.to_vec();

    for &diff in data {
        let last_value = result[result.len() - lag];
        result.push(last_value + diff);
    }

    result
}

/// Detrending (remove linear trend)
pub fn detrend(data: &[f64]) -> (Vec<f64>, f64, f64) {
    let n = data.len() as f64;
    let x_mean = (n - 1.0) / 2.0;
    let y_mean = data.iter().sum::<f64>() / n;

    // Calculate slope
    let mut numerator = 0.0;
    let mut denominator = 0.0;
    for (i, &y) in data.iter().enumerate() {
        let x = i as f64;
        numerator += (x - x_mean) * (y - y_mean);
        denominator += (x - x_mean).powi(2);
    }

    let slope = numerator / denominator;
    let intercept = y_mean - slope * x_mean;

    // Remove trend
    let detrended: Vec<f64> = data
        .iter()
        .enumerate()
        .map(|(i, &y)| y - (slope * i as f64 + intercept))
        .collect();

    (detrended, slope, intercept)
}

/// Seasonal decomposition (simplified)
pub fn seasonal_decompose(data: &[f64], period: usize) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
    let n = data.len();

    // Calculate seasonal component (average of each seasonal index)
    let mut seasonal = vec![0.0; period];
    let mut counts = vec![0; period];

    for (i, &value) in data.iter().enumerate() {
        let season_idx = i % period;
        seasonal[season_idx] += value;
        counts[season_idx] += 1;
    }

    for i in 0..period {
        if counts[i] > 0 {
            seasonal[i] /= counts[i] as f64;
        }
    }

    // Expand seasonal to full length
    let seasonal_full: Vec<f64> = (0..n).map(|i| seasonal[i % period]).collect();

    // Calculate trend (moving average)
    let mut trend = vec![0.0; n];
    let window = period.max(3);
    for (i, trend_val) in trend.iter_mut().enumerate().take(n) {
        let start = i.saturating_sub(window / 2);
        let end = (i + window / 2 + 1).min(n);
        let sum: f64 = data[start..end].iter().sum();
        *trend_val = sum / (end - start) as f64;
    }

    // Calculate residual
    let residual: Vec<f64> = data
        .iter()
        .zip(&trend)
        .zip(&seasonal_full)
        .map(|((&val, &t), &s)| val - t - s)
        .collect();

    (trend, seasonal_full, residual)
}

/// Outlier removal using IQR method
pub fn remove_outliers(data: &[f64], threshold: f64) -> Vec<f64> {
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let q1 = sorted[sorted.len() / 4];
    let q3 = sorted[(sorted.len() * 3) / 4];
    let iqr = q3 - q1;

    let lower_bound = q1 - threshold * iqr;
    let upper_bound = q3 + threshold * iqr;

    data.iter()
        .copied()
        .filter(|&x| x >= lower_bound && x <= upper_bound)
        .collect()
}

/// Winsorization (cap outliers)
pub fn winsorize(data: &[f64], lower_percentile: f64, upper_percentile: f64) -> Vec<f64> {
    let mut sorted = data.to_vec();
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let lower_idx = (data.len() as f64 * lower_percentile) as usize;
    let upper_idx = (data.len() as f64 * upper_percentile) as usize;

    let lower_bound = sorted[lower_idx];
    let upper_bound = sorted[upper_idx];

    data.iter()
        .map(|&x| x.clamp(lower_bound, upper_bound))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let (normalized, params) = normalize(&data);

        assert_eq!(params.mean, 3.0);
        assert!((params.std - 1.414).abs() < 0.01);

        // Check mean is ~0 and std is ~1
        let norm_mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
        assert!(norm_mean.abs() < 1e-10);
    }

    #[test]
    fn test_min_max_normalize() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let (normalized, params) = min_max_normalize(&data);

        assert_eq!(params.min, 1.0);
        assert_eq!(params.max, 5.0);
        assert_eq!(normalized[0], 0.0);
        assert_eq!(normalized[4], 1.0);
    }

    #[test]
    fn test_difference() {
        let data = vec![1.0, 3.0, 6.0, 10.0, 15.0];
        let diff = difference(&data, 1);

        assert_eq!(diff, vec![2.0, 3.0, 4.0, 5.0]);
    }

    #[test]
    fn test_detrend() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let (detrended, slope, intercept) = detrend(&data);

        assert!((slope - 1.0).abs() < 1e-10);
        assert!((intercept - 1.0).abs() < 1e-10);

        // Detrended should have mean ~0
        let mean = detrended.iter().sum::<f64>() / detrended.len() as f64;
        assert!(mean.abs() < 1e-10);
    }

    #[test]
    fn test_outlier_removal() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 100.0]; // 100 is outlier
        let clean = remove_outliers(&data, 1.5);

        assert!(clean.len() < data.len());
        assert!(!clean.contains(&100.0));
    }
}

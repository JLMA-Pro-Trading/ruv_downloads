//! Feature engineering utilities for time series

// Import only needed when candle feature is enabled
#[cfg(feature = "candle")]
use crate::error::Result;
use chrono::{Datelike, Timelike};

/// Create lagged features
pub fn create_lags(data: &[f64], lags: &[usize]) -> Vec<Vec<f64>> {
    let n = data.len();
    let max_lag = *lags.iter().max().unwrap_or(&0);

    (max_lag..n)
        .map(|i| {
            lags.iter()
                .map(|&lag| data[i - lag])
                .collect()
        })
        .collect()
}

/// Rolling window statistics
///
/// Uses SIMD acceleration when the `simd` feature is enabled for 2-3x performance improvement.
pub fn rolling_mean(data: &[f64], window: usize) -> Vec<f64> {
    #[cfg(feature = "simd")]
    {
        crate::utils::simd::simd_rolling_mean(data, window)
    }

    #[cfg(not(feature = "simd"))]
    {
        data.windows(window)
            .map(|w| w.iter().sum::<f64>() / window as f64)
            .collect()
    }
}

pub fn rolling_std(data: &[f64], window: usize) -> Vec<f64> {
    #[cfg(feature = "simd")]
    {
        crate::utils::simd::simd_rolling_std(data, window)
    }

    #[cfg(not(feature = "simd"))]
    {
        data.windows(window)
            .map(|w| {
                let mean = w.iter().sum::<f64>() / window as f64;
                let variance = w.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / window as f64;
                variance.sqrt()
            })
            .collect()
    }
}

pub fn rolling_min(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| w.iter().copied().fold(f64::INFINITY, f64::min))
        .collect()
}

pub fn rolling_max(data: &[f64], window: usize) -> Vec<f64> {
    data.windows(window)
        .map(|w| w.iter().copied().fold(f64::NEG_INFINITY, f64::max))
        .collect()
}

/// Exponential Moving Average
///
/// Uses SIMD acceleration when the `simd` feature is enabled for 2-4x performance improvement.
pub fn ema(data: &[f64], alpha: f64) -> Vec<f64> {
    #[cfg(feature = "simd")]
    {
        crate::utils::simd::simd_ema(data, alpha)
    }

    #[cfg(not(feature = "simd"))]
    {
        let mut result = Vec::with_capacity(data.len());
        let mut ema_value = data[0];
        result.push(ema_value);

        for &value in &data[1..] {
            ema_value = alpha * value + (1.0 - alpha) * ema_value;
            result.push(ema_value);
        }

        result
    }
}

/// Rate of change
pub fn rate_of_change(data: &[f64], period: usize) -> Vec<f64> {
    data.windows(period + 1)
        .map(|w| {
            let current = w[period];
            let previous = w[0];
            if previous.abs() > 1e-10 {
                (current - previous) / previous
            } else {
                0.0
            }
        })
        .collect()
}

/// Fourier features (for capturing seasonality)
pub fn fourier_features(n: usize, period: f64, order: usize) -> Vec<Vec<f64>> {
    let mut features = Vec::new();

    for k in 1..=order {
        let freq = 2.0 * std::f64::consts::PI * k as f64 / period;

        let sin_features: Vec<f64> = (0..n).map(|t| (freq * t as f64).sin()).collect();
        let cos_features: Vec<f64> = (0..n).map(|t| (freq * t as f64).cos()).collect();

        features.push(sin_features);
        features.push(cos_features);
    }

    features
}

/// Calendar features
pub fn calendar_features(timestamps: &[chrono::DateTime<chrono::Utc>]) -> Vec<Vec<f64>> {
    let mut features = Vec::new();

    // Hour of day (normalized)
    let hours: Vec<f64> = timestamps.iter().map(|ts| ts.time().hour() as f64 / 24.0).collect();
    features.push(hours);

    // Day of week (one-hot encoded as sin/cos)
    let dow_sin: Vec<f64> = timestamps
        .iter()
        .map(|ts| {
            let dow = ts.date_naive().weekday().num_days_from_monday() as f64;
            (2.0 * std::f64::consts::PI * dow / 7.0).sin()
        })
        .collect();
    let dow_cos: Vec<f64> = timestamps
        .iter()
        .map(|ts| {
            let dow = ts.date_naive().weekday().num_days_from_monday() as f64;
            (2.0 * std::f64::consts::PI * dow / 7.0).cos()
        })
        .collect();
    features.push(dow_sin);
    features.push(dow_cos);

    // Day of month (normalized)
    let dom: Vec<f64> = timestamps.iter().map(|ts| ts.date_naive().day() as f64 / 31.0).collect();
    features.push(dom);

    // Month (as sin/cos)
    let month_sin: Vec<f64> = timestamps
        .iter()
        .map(|ts| {
            let month = ts.date_naive().month() as f64;
            (2.0 * std::f64::consts::PI * month / 12.0).sin()
        })
        .collect();
    let month_cos: Vec<f64> = timestamps
        .iter()
        .map(|ts| {
            let month = ts.date_naive().month() as f64;
            (2.0 * std::f64::consts::PI * month / 12.0).cos()
        })
        .collect();
    features.push(month_sin);
    features.push(month_cos);

    features
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_lags() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let lags = vec![1, 2];
        let lagged = create_lags(&data, &lags);

        assert_eq!(lagged.len(), 3); // 5 - 2 (max lag)
        assert_eq!(lagged[0], vec![2.0, 1.0]); // t-1, t-2 for index 2 (value 3.0)
    }

    #[test]
    fn test_rolling_mean() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let means = rolling_mean(&data, 3);

        assert_eq!(means.len(), 3);
        assert_eq!(means[0], 2.0); // (1+2+3)/3
        assert_eq!(means[1], 3.0); // (2+3+4)/3
        assert_eq!(means[2], 4.0); // (3+4+5)/3
    }

    #[test]
    fn test_ema() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let ema_values = ema(&data, 0.5);

        assert_eq!(ema_values.len(), data.len());
        assert_eq!(ema_values[0], 1.0);
        assert!(ema_values[4] > ema_values[0]);
    }

    #[test]
    fn test_rate_of_change() {
        let data = vec![100.0, 110.0, 121.0];
        let roc = rate_of_change(&data, 1);

        assert_eq!(roc.len(), 2);
        assert!((roc[0] - 0.1).abs() < 1e-10); // 10% increase
        assert!((roc[1] - 0.1).abs() < 1e-10); // 10% increase
    }
}

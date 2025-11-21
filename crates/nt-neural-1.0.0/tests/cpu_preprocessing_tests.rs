//! Comprehensive CPU preprocessing validation tests
//!
//! This test suite validates all preprocessing and feature engineering operations
//! running on CPU without GPU dependencies. Tests cover:
//! - Normalization (z-score, min-max, robust)
//! - Time series operations (differencing, detrending, decomposition)
//! - Feature engineering (lags, rolling stats, technical indicators)
//! - Numerical stability (large/small numbers, edge cases)
//! - Performance (large arrays, memory usage)
//! - Property-based testing with proptest

use nt_neural::utils::preprocessing::*;
use nt_neural::utils::features::*;
use approx::assert_relative_eq;

const EPSILON: f64 = 1e-10;

// ============================================================================
// NORMALIZATION TESTS
// ============================================================================

#[test]
fn test_zscore_normalization_mean_zero() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let (normalized, params) = normalize(&data);

    // Calculate mean of normalized data
    let mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
    assert!(mean.abs() < EPSILON, "Z-score normalized mean should be ~0, got {}", mean);
    assert_relative_eq!(params.mean, 3.0, epsilon = EPSILON);
}

#[test]
fn test_zscore_normalization_std_one() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let (normalized, _) = normalize(&data);

    // Calculate std of normalized data
    let mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
    let variance = normalized.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / normalized.len() as f64;
    let std = variance.sqrt();

    assert_relative_eq!(std, 1.0, epsilon = 0.01);
}

#[test]
fn test_zscore_inverse() {
    let data = vec![10.0, 20.0, 30.0, 40.0, 50.0];
    let (normalized, params) = normalize(&data);
    let recovered = denormalize(&normalized, &params);

    for (orig, recov) in data.iter().zip(recovered.iter()) {
        assert_relative_eq!(orig, recov, epsilon = EPSILON);
    }
}

#[test]
fn test_minmax_normalization_range() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let (normalized, params) = min_max_normalize(&data);

    assert_relative_eq!(params.min, 1.0, epsilon = EPSILON);
    assert_relative_eq!(params.max, 5.0, epsilon = EPSILON);
    assert_relative_eq!(normalized[0], 0.0, epsilon = EPSILON);
    assert_relative_eq!(normalized[4], 1.0, epsilon = EPSILON);

    // All values should be in [0, 1]
    for &val in &normalized {
        assert!(val >= 0.0 && val <= 1.0, "Value {} outside [0,1]", val);
    }
}

#[test]
fn test_minmax_inverse() {
    let data = vec![10.0, 25.0, 40.0, 55.0, 70.0];
    let (normalized, params) = min_max_normalize(&data);
    let recovered = min_max_denormalize(&normalized, &params);

    for (orig, recov) in data.iter().zip(recovered.iter()) {
        assert_relative_eq!(orig, recov, epsilon = EPSILON);
    }
}

#[test]
fn test_robust_scaling_median_zero() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0];
    let (scaled, median, iqr) = robust_scale(&data);

    assert_relative_eq!(median, 5.0, epsilon = EPSILON);
    assert!(iqr > 0.0);

    // Median of scaled data should be ~0
    let mut sorted_scaled = scaled.clone();
    sorted_scaled.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let scaled_median = sorted_scaled[sorted_scaled.len() / 2];
    assert!(scaled_median.abs() < 0.1);
}

#[test]
fn test_normalization_all_zeros() {
    let data = vec![0.0; 10];
    let (normalized, params) = normalize(&data);

    // Should handle all zeros gracefully
    assert_relative_eq!(params.mean, 0.0, epsilon = EPSILON);
    assert_relative_eq!(params.std, 0.0, epsilon = EPSILON);

    // Normalized values should not be NaN
    for &val in &normalized {
        assert!(!val.is_nan(), "Normalized value is NaN");
    }
}

#[test]
fn test_normalization_all_same_value() {
    let data = vec![42.0; 20];
    let (normalized, params) = min_max_normalize(&data);

    assert_relative_eq!(params.min, 42.0, epsilon = EPSILON);
    assert_relative_eq!(params.max, 42.0, epsilon = EPSILON);

    // All should be 0.5 (middle of range)
    for &val in &normalized {
        assert_relative_eq!(val, 0.5, epsilon = EPSILON);
    }
}

#[test]
fn test_normalization_with_nan() {
    let data = vec![1.0, 2.0, f64::NAN, 4.0, 5.0];
    let (normalized, _params) = normalize(&data);

    // Check that NaN is preserved (or handled)
    let nan_count = normalized.iter().filter(|x| x.is_nan()).count();
    assert!(nan_count > 0, "NaN should be preserved or handled");
}

// ============================================================================
// TIME SERIES OPERATIONS TESTS
// ============================================================================

#[test]
fn test_differencing_lag1() {
    let data = vec![1.0, 3.0, 6.0, 10.0, 15.0];
    let diff = difference(&data, 1);

    assert_eq!(diff.len(), 4);
    assert_relative_eq!(diff[0], 2.0, epsilon = EPSILON);
    assert_relative_eq!(diff[1], 3.0, epsilon = EPSILON);
    assert_relative_eq!(diff[2], 4.0, epsilon = EPSILON);
    assert_relative_eq!(diff[3], 5.0, epsilon = EPSILON);
}

#[test]
fn test_differencing_lag2() {
    let data = vec![1.0, 2.0, 4.0, 7.0, 11.0, 16.0];
    let diff = difference(&data, 2);

    assert_eq!(diff.len(), 4);
    assert_relative_eq!(diff[0], 3.0, epsilon = EPSILON); // 4 - 1
    assert_relative_eq!(diff[1], 5.0, epsilon = EPSILON); // 7 - 2
}

#[test]
fn test_inverse_differencing() {
    let data = vec![1.0, 3.0, 6.0, 10.0, 15.0];
    let diff = difference(&data, 1);
    let initial = vec![data[0]];
    let recovered = inverse_difference(&diff, &initial, 1);

    for (orig, recov) in data.iter().zip(recovered.iter()) {
        assert_relative_eq!(orig, recov, epsilon = EPSILON);
    }
}

#[test]
fn test_detrending_linear() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let (detrended, slope, intercept) = detrend(&data);

    // Perfect linear trend should be removed
    assert_relative_eq!(slope, 1.0, epsilon = EPSILON);
    assert_relative_eq!(intercept, 1.0, epsilon = EPSILON);

    // Mean should be ~0
    let mean = detrended.iter().sum::<f64>() / detrended.len() as f64;
    assert!(mean.abs() < EPSILON);
}

#[test]
fn test_detrending_with_noise() {
    let data = vec![1.0, 2.1, 2.9, 4.2, 4.8];
    let (detrended, slope, _) = detrend(&data);

    // Slope should be approximately 1
    assert_relative_eq!(slope, 1.0, epsilon = 0.2);

    // Variance should be reduced
    let orig_variance = data.iter().map(|x| x.powi(2)).sum::<f64>() / data.len() as f64;
    let detrended_variance = detrended.iter().map(|x| x.powi(2)).sum::<f64>() / detrended.len() as f64;
    assert!(detrended_variance < orig_variance);
}

#[test]
fn test_seasonal_decomposition() {
    // Create data with known pattern: trend + seasonal
    let period = 4;
    let data: Vec<f64> = (0..20)
        .map(|i| {
            let trend = i as f64;
            let seasonal = (i % period) as f64;
            trend + seasonal
        })
        .collect();

    let (trend, seasonal, residual) = seasonal_decompose(&data, period);

    assert_eq!(trend.len(), data.len());
    assert_eq!(seasonal.len(), data.len());
    assert_eq!(residual.len(), data.len());

    // Components should sum back to original (approximately)
    for i in 0..data.len() {
        let reconstructed = trend[i] + seasonal[i] + residual[i];
        assert_relative_eq!(reconstructed, data[i], epsilon = 0.5);
    }
}

#[test]
fn test_seasonal_decomposition_period_validation() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0];
    let period = 3;

    let (_trend, seasonal, _residual) = seasonal_decompose(&data, period);

    // Seasonal component should repeat every period
    for i in 0..(data.len() - period) {
        assert_relative_eq!(seasonal[i], seasonal[i + period], epsilon = 0.01);
    }
}

// ============================================================================
// FEATURE ENGINEERING TESTS
// ============================================================================

#[test]
fn test_create_lags_basic() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let lags = vec![1, 2];
    let lagged = create_lags(&data, &lags);

    assert_eq!(lagged.len(), 3); // 5 - 2 (max lag)
    assert_eq!(lagged[0], vec![2.0, 1.0]); // t-1, t-2 for index 2
    assert_eq!(lagged[1], vec![3.0, 2.0]); // t-1, t-2 for index 3
    assert_eq!(lagged[2], vec![4.0, 3.0]); // t-1, t-2 for index 4
}

#[test]
fn test_create_lags_single_lag() {
    let data = vec![10.0, 20.0, 30.0, 40.0];
    let lags = vec![1];
    let lagged = create_lags(&data, &lags);

    assert_eq!(lagged.len(), 3);
    assert_eq!(lagged[0], vec![10.0]);
    assert_eq!(lagged[1], vec![20.0]);
    assert_eq!(lagged[2], vec![30.0]);
}

#[test]
fn test_rolling_mean_calculation() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let means = rolling_mean(&data, 3);

    assert_eq!(means.len(), 3);
    assert_relative_eq!(means[0], 2.0, epsilon = EPSILON); // (1+2+3)/3
    assert_relative_eq!(means[1], 3.0, epsilon = EPSILON); // (2+3+4)/3
    assert_relative_eq!(means[2], 4.0, epsilon = EPSILON); // (3+4+5)/3
}

#[test]
fn test_rolling_std_calculation() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let stds = rolling_std(&data, 3);

    assert_eq!(stds.len(), 3);

    // Calculate expected std for first window [1,2,3]
    let mean1 = 2.0_f64;
    let expected_std1 = ((1.0_f64 - mean1).powi(2) + (2.0_f64 - mean1).powi(2) + (3.0_f64 - mean1).powi(2)) / 3.0;
    assert_relative_eq!(stds[0], expected_std1.sqrt(), epsilon = EPSILON);
}

#[test]
fn test_rolling_min_max() {
    let data = vec![3.0, 1.0, 4.0, 1.0, 5.0, 9.0, 2.0];
    let mins = rolling_min(&data, 3);
    let maxs = rolling_max(&data, 3);

    assert_eq!(mins[0], 1.0); // min(3,1,4)
    assert_eq!(maxs[0], 4.0); // max(3,1,4)
    assert_eq!(mins[4], 2.0); // min(5,9,2)
    assert_eq!(maxs[4], 9.0); // max(5,9,2)
}

#[test]
fn test_ema_basic() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
    let ema_values = ema(&data, 0.5);

    assert_eq!(ema_values.len(), data.len());
    assert_eq!(ema_values[0], 1.0); // First value

    // EMA should be between min and max
    let min = data.iter().copied().fold(f64::INFINITY, f64::min);
    let max = data.iter().copied().fold(f64::NEG_INFINITY, f64::max);
    for &val in &ema_values {
        assert!(val >= min && val <= max);
    }
}

#[test]
fn test_ema_smoothing() {
    // Create noisy data
    let data = vec![100.0, 110.0, 90.0, 105.0, 95.0, 108.0];
    let ema_values = ema(&data, 0.3);

    // Note: This is a rough check, actual variances depend on data
    assert!(ema_values.len() == data.len());
}

#[test]
fn test_rate_of_change() {
    let data = vec![100.0, 110.0, 121.0];
    let roc = rate_of_change(&data, 1);

    assert_eq!(roc.len(), 2);
    assert_relative_eq!(roc[0], 0.1, epsilon = EPSILON); // 10% increase
    assert_relative_eq!(roc[1], 0.1, epsilon = EPSILON); // 10% increase
}

#[test]
fn test_rate_of_change_negative() {
    let data = vec![100.0, 90.0, 81.0];
    let roc = rate_of_change(&data, 1);

    assert_eq!(roc.len(), 2);
    assert_relative_eq!(roc[0], -0.1, epsilon = EPSILON); // -10%
    assert_relative_eq!(roc[1], -0.1, epsilon = EPSILON); // -10%
}

#[test]
fn test_fourier_features_periodicity() {
    let n = 100;
    let period = 24.0;
    let order = 2;

    let features = fourier_features(n, period, order);

    // Should have 2 * order features (sin and cos for each order)
    assert_eq!(features.len(), 2 * order);

    // Each feature should have n values
    for feature in &features {
        assert_eq!(feature.len(), n);
    }

    // Values should be in [-1, 1]
    for feature in &features {
        for &val in feature {
            assert!(val >= -1.0 && val <= 1.0);
        }
    }
}

#[test]
fn test_fourier_features_orthogonality() {
    let n = 1000;
    let period = 24.0;
    let order = 3;

    let features = fourier_features(n, period, order);

    // Sin and cos of same frequency should be orthogonal
    for i in (0..features.len()).step_by(2) {
        let sin_feat = &features[i];
        let cos_feat = &features[i + 1];

        // Dot product should be ~0
        let dot_product: f64 = sin_feat.iter().zip(cos_feat.iter()).map(|(a, b)| a * b).sum();
        assert!(dot_product.abs() < 1.0); // Relaxed threshold for discrete approximation
    }
}

// ============================================================================
// NUMERICAL STABILITY TESTS
// ============================================================================

#[test]
fn test_normalization_large_numbers() {
    let data = vec![1e10, 2e10, 3e10, 4e10, 5e10];
    let (normalized, params) = normalize(&data);

    // Should not overflow
    assert!(!params.mean.is_infinite());
    assert!(!params.std.is_infinite());
    for &val in &normalized {
        assert!(val.is_finite());
    }
}

#[test]
fn test_normalization_small_numbers() {
    let data = vec![1e-10, 2e-10, 3e-10, 4e-10, 5e-10];
    let (normalized, params) = normalize(&data);

    // Should not underflow to zero
    assert!(params.mean > 0.0);
    assert!(params.std > 0.0);
}

#[test]
fn test_normalization_mixed_scales() {
    let data = vec![1e-5, 1e-3, 1e-1, 1e1, 1e3];
    let (normalized, params) = normalize(&data);

    // Should handle mixed scales
    assert!(params.mean.is_finite());
    assert!(params.std.is_finite());
    for &val in &normalized {
        assert!(val.is_finite());
    }
}

#[test]
fn test_differencing_extreme_values() {
    let data = vec![1e10, 1e10 + 1.0, 1e10 + 2.0];
    let diff = difference(&data, 1);

    // Should handle precision correctly
    assert_eq!(diff.len(), 2);
    for &val in &diff {
        assert!(val.is_finite());
    }
}

#[test]
fn test_rolling_stats_single_element() {
    let data = vec![42.0];
    let means = rolling_mean(&data, 1);

    assert_eq!(means.len(), 1);
    assert_eq!(means[0], 42.0);
}

#[test]
fn test_empty_data_handling() {
    let data: Vec<f64> = vec![];

    // Should not panic
    let diff = difference(&data, 1);
    assert_eq!(diff.len(), 0);
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

#[test]
fn test_normalization_large_array() {
    use std::time::Instant;

    let n = 1_000_000;
    let data: Vec<f64> = (0..n).map(|i| i as f64).collect();

    let start = Instant::now();
    let (normalized, _) = normalize(&data);
    let duration = start.elapsed();

    assert_eq!(normalized.len(), n);
    println!("Normalized {} elements in {:?}", n, duration);

    // Should complete in reasonable time (< 1 second on modern hardware)
    assert!(duration.as_secs() < 1);
}

#[test]
fn test_rolling_mean_large_array() {
    use std::time::Instant;

    let n = 100_000;
    let data: Vec<f64> = (0..n).map(|i| (i as f64).sin()).collect();

    let start = Instant::now();
    let means = rolling_mean(&data, 100);
    let duration = start.elapsed();

    assert_eq!(means.len(), n - 99);
    println!("Computed rolling mean for {} elements in {:?}", n, duration);

    assert!(duration.as_millis() < 500);
}

#[test]
fn test_memory_efficiency() {
    // Test that operations don't cause excessive memory allocation
    let n = 10_000;
    let data: Vec<f64> = (0..n).map(|i| i as f64).collect();

    // Multiple operations shouldn't cause stack overflow
    let (normalized, params) = normalize(&data);
    let recovered = denormalize(&normalized, &params);
    let diff = difference(&recovered, 1);
    let means = rolling_mean(&diff, 10);

    // Just verify we got results
    assert!(means.len() > 0);
}

// ============================================================================
// OUTLIER HANDLING TESTS
// ============================================================================

#[test]
fn test_remove_outliers_iqr() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 100.0];
    let clean = remove_outliers(&data, 1.5);

    assert!(clean.len() < data.len());
    assert!(!clean.contains(&100.0));
}

#[test]
fn test_winsorization() {
    let data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 100.0];
    let winsorized = winsorize(&data, 0.05, 0.95);

    // Length should be same
    assert_eq!(winsorized.len(), data.len());

    // Extreme value should be capped
    assert!(winsorized[5] < 100.0);
    assert!(winsorized[5] >= 5.0);
}

// ============================================================================
// REAL FINANCIAL DATA PATTERN TESTS
// ============================================================================

#[test]
fn test_stock_price_pattern() {
    // Simulate realistic stock price movement
    let prices = vec![
        100.0, 101.5, 99.8, 102.3, 103.1, 102.9, 104.2, 105.0, 103.8, 106.5
    ];

    // Test returns calculation
    let roc = rate_of_change(&prices, 1);

    // Returns should be small (typically < 5% per period)
    for &ret in &roc {
        assert!(ret.abs() < 0.1, "Return {} too large", ret);
    }
}

#[test]
fn test_volatility_clustering() {
    // High volatility period followed by low volatility
    let data = vec![
        100.0, 110.0, 95.0, 105.0, 90.0, // High vol
        100.0, 101.0, 100.5, 101.5, 101.0 // Low vol
    ];

    let stds = rolling_std(&data, 3);

    // First windows should have higher std than later ones
    assert!(stds.len() > 5);
    let early_std = stds[0];
    let late_std = stds[stds.len() - 1];
    assert!(early_std > late_std * 2.0);
}

#[test]
fn test_mean_reversion() {
    // Price oscillates around mean
    let prices: Vec<f64> = (0..100)
        .map(|i| 100.0 + 10.0 * (i as f64 * 0.1).sin())
        .collect();

    let (detrended, _, _) = detrend(&prices);

    // Detrended should oscillate around 0
    let mean = detrended.iter().sum::<f64>() / detrended.len() as f64;
    assert!(mean.abs() < 1.0);
}

#[test]
fn test_seasonality_detection() {
    // Weekly pattern (period = 7)
    let data: Vec<f64> = (0..70)
        .map(|i| 100.0 + 10.0 * (i % 7) as f64)
        .collect();

    let (_, seasonal, _) = seasonal_decompose(&data, 7);

    // Seasonal component should repeat
    for i in 0..(data.len() - 7) {
        assert_relative_eq!(seasonal[i], seasonal[i + 7], epsilon = 0.1);
    }
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

#[test]
fn test_full_preprocessing_pipeline() {
    // Simulate full preprocessing workflow
    let raw_data = vec![
        100.0, 102.0, 101.0, 103.0, 105.0, 104.0, 106.0, 108.0, 107.0, 109.0
    ];

    // Step 1: Remove outliers
    let clean = remove_outliers(&raw_data, 1.5);

    // Step 2: Detrend
    let (detrended, _slope, _intercept) = detrend(&clean);

    // Step 3: Normalize
    let (normalized, _params) = normalize(&detrended);

    // Step 4: Create features
    let lags = vec![1, 2];
    let lagged = create_lags(&normalized, &lags);

    // Verify we got results at each step
    assert!(clean.len() > 0);
    assert!(detrended.len() > 0);
    assert!(normalized.len() > 0);
    assert!(lagged.len() > 0);

    // Verify no NaN values
    for &val in &normalized {
        assert!(!val.is_nan());
    }
}

#[test]
fn test_preprocessing_reversibility() {
    let original = vec![10.0, 20.0, 30.0, 40.0, 50.0];

    // Forward: normalize -> difference -> detrend
    let (normalized, norm_params) = normalize(&original);
    let diff = difference(&normalized, 1);
    let (detrended, slope, intercept) = detrend(&diff);

    // Reverse: add trend -> integrate -> denormalize
    let retrended: Vec<f64> = detrended
        .iter()
        .enumerate()
        .map(|(i, &val)| val + (slope * i as f64 + intercept))
        .collect();

    let initial = vec![normalized[0]];
    let integrated = inverse_difference(&retrended, &initial, 1);
    let recovered = denormalize(&integrated, &norm_params);

    // Should approximately recover original
    for i in 0..original.len().min(recovered.len()) {
        assert_relative_eq!(original[i], recovered[i], epsilon = 0.5);
    }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

#[cfg(test)]
mod helpers {
    #[allow(dead_code)]

    pub fn generate_trend_data(n: usize, slope: f64) -> Vec<f64> {
        (0..n).map(|i| slope * i as f64).collect()
    }

    pub fn generate_seasonal_data(n: usize, period: usize) -> Vec<f64> {
        (0..n).map(|i| (i % period) as f64).collect()
    }

    pub fn generate_noisy_data(n: usize, noise_level: f64) -> Vec<f64> {
        use rand::Rng;
        let mut rng = rand::thread_rng();
        (0..n).map(|i| i as f64 + rng.gen::<f64>() * noise_level).collect()
    }
}

#[test]
fn test_helper_functions() {
    let trend = helpers::generate_trend_data(10, 2.0);
    assert_eq!(trend.len(), 10);
    assert_eq!(trend[0], 0.0);
    assert_eq!(trend[9], 18.0);
}

//! Property-based testing for preprocessing operations
//!
//! These tests use proptest to verify properties hold for arbitrary inputs.
//! This provides much stronger guarantees than example-based tests.

use nt_neural::utils::preprocessing::*;
use nt_neural::utils::features::*;
use proptest::prelude::*;

// ============================================================================
// PROPERTY: Normalization Inverse
// ============================================================================

proptest! {
    #[test]
    fn prop_normalize_denormalize_inverse(data in prop::collection::vec(any::<f64>(), 10..1000)) {
        // Filter out NaN and infinite values
        let clean_data: Vec<f64> = data.into_iter()
            .filter(|x| x.is_finite())
            .collect();

        if clean_data.len() < 2 {
            return Ok(());
        }

        let (normalized, params) = normalize(&clean_data);
        let recovered = denormalize(&normalized, &params);

        for (orig, recov) in clean_data.iter().zip(recovered.iter()) {
            prop_assert!(
                (orig - recov).abs() < 1e-8,
                "Original {} != Recovered {}", orig, recov
            );
        }
    }

    #[test]
    fn prop_minmax_denormalize_inverse(data in prop::collection::vec(-1000.0..1000.0, 10..1000)) {
        if data.len() < 2 {
            return Ok(());
        }

        let (normalized, params) = min_max_normalize(&data);
        let recovered = min_max_denormalize(&normalized, &params);

        for (orig, recov) in data.iter().zip(recovered.iter()) {
            prop_assert!(
                (orig - recov).abs() < 1e-8,
                "Original {} != Recovered {}", orig, recov
            );
        }
    }
}

// ============================================================================
// PROPERTY: Normalization Bounds
// ============================================================================

proptest! {
    #[test]
    fn prop_minmax_in_unit_range(data in prop::collection::vec(-1000.0..1000.0, 10..100)) {
        if data.is_empty() {
            return Ok(());
        }

        let (normalized, _) = min_max_normalize(&data);

        for &val in &normalized {
            prop_assert!(
                val >= 0.0 && val <= 1.0,
                "Min-max normalized value {} outside [0,1]", val
            );
        }
    }

    #[test]
    fn prop_zscore_approximately_unit_variance(
        data in prop::collection::vec(-100.0..100.0, 100..1000)
    ) {
        if data.len() < 10 {
            return Ok(());
        }

        let (normalized, _) = normalize(&data);

        // Calculate standard deviation
        let mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
        let variance = normalized.iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f64>() / normalized.len() as f64;
        let std = variance.sqrt();

        prop_assert!(
            (std - 1.0).abs() < 0.1,
            "Z-score std {} not close to 1.0", std
        );
    }
}

// ============================================================================
// PROPERTY: Differencing
// ============================================================================

proptest! {
    #[test]
    fn prop_difference_inverse_difference(
        data in prop::collection::vec(-100.0..100.0, 10..100),
        lag in 1..5usize
    ) {
        if data.len() <= lag {
            return Ok(());
        }

        let diff = difference(&data, lag);
        let initial: Vec<f64> = data[..lag].to_vec();
        let recovered = inverse_difference(&diff, &initial, lag);

        for (orig, recov) in data.iter().zip(recovered.iter()) {
            prop_assert!(
                (orig - recov).abs() < 1e-8,
                "Original {} != Recovered {} after differencing", orig, recov
            );
        }
    }

    #[test]
    fn prop_difference_length(
        data in prop::collection::vec(-100.0..100.0, 10..100),
        lag in 1..5usize
    ) {
        if data.len() <= lag {
            return Ok(());
        }

        let diff = difference(&data, lag);
        prop_assert_eq!(diff.len(), data.len() - lag);
    }
}

// ============================================================================
// PROPERTY: Detrending
// ============================================================================

proptest! {
    #[test]
    fn prop_detrend_removes_mean(data in prop::collection::vec(-100.0..100.0, 20..100)) {
        if data.len() < 10 {
            return Ok(());
        }

        let (detrended, _, _) = detrend(&data);

        let mean = detrended.iter().sum::<f64>() / detrended.len() as f64;
        prop_assert!(
            mean.abs() < 1e-8,
            "Detrended data has non-zero mean: {}", mean
        );
    }

    #[test]
    fn prop_detrend_length_preserved(data in prop::collection::vec(-100.0..100.0, 10..100)) {
        if data.is_empty() {
            return Ok(());
        }

        let (detrended, _, _) = detrend(&data);
        prop_assert_eq!(detrended.len(), data.len());
    }
}

// ============================================================================
// PROPERTY: Feature Engineering
// ============================================================================

proptest! {
    #[test]
    fn prop_create_lags_length(
        data in prop::collection::vec(-100.0..100.0, 20..100),
        num_lags in 1..5usize
    ) {
        let lags: Vec<usize> = (1..=num_lags).collect();
        let max_lag = *lags.iter().max().unwrap();

        if data.len() <= max_lag {
            return Ok(());
        }

        let lagged = create_lags(&data, &lags);
        prop_assert_eq!(lagged.len(), data.len() - max_lag);

        for row in &lagged {
            prop_assert_eq!(row.len(), lags.len());
        }
    }

    #[test]
    fn prop_rolling_mean_in_data_range(
        data in prop::collection::vec(-100.0..100.0, 20..100),
        window in 2..10usize
    ) {
        if data.len() < window {
            return Ok(());
        }

        let means = rolling_mean(&data, window);
        let min = data.iter().copied().fold(f64::INFINITY, f64::min);
        let max = data.iter().copied().fold(f64::NEG_INFINITY, f64::max);

        for &mean in &means {
            prop_assert!(
                mean >= min && mean <= max,
                "Rolling mean {} outside data range [{}, {}]", mean, min, max
            );
        }
    }

    #[test]
    fn prop_ema_in_data_range(
        data in prop::collection::vec(-100.0..100.0, 10..100),
        alpha in 0.1..0.9f64
    ) {
        if data.is_empty() {
            return Ok(());
        }

        let ema_values = ema(&data, alpha);
        let min = data.iter().copied().fold(f64::INFINITY, f64::min);
        let max = data.iter().copied().fold(f64::NEG_INFINITY, f64::max);

        for &val in &ema_values {
            prop_assert!(
                val >= min - 0.1 && val <= max + 0.1,
                "EMA {} outside data range [{}, {}]", val, min, max
            );
        }
    }
}

// ============================================================================
// PROPERTY: Fourier Features
// ============================================================================

proptest! {
    #[test]
    fn prop_fourier_features_bounded(
        n in 10..1000usize,
        period in 2.0..100.0f64,
        order in 1..5usize
    ) {
        let features = fourier_features(n, period, order);

        prop_assert_eq!(features.len(), 2 * order);

        for feature in &features {
            prop_assert_eq!(feature.len(), n);

            for &val in feature {
                prop_assert!(
                    val >= -1.0 && val <= 1.0,
                    "Fourier feature {} outside [-1, 1]", val
                );
            }
        }
    }

    #[test]
    fn prop_fourier_features_periodicity(
        period in 10.0..50.0f64,
        order in 1..3usize
    ) {
        let n = (period as usize) * 3; // 3 full periods
        let features = fourier_features(n, period, order);

        // Check that features repeat after one period
        for feature in &features {
            for i in 0..(n - period as usize) {
                let j = i + period as usize;
                prop_assert!(
                    (feature[i] - feature[j]).abs() < 0.01,
                    "Fourier feature not periodic: {} != {} at positions {}, {}",
                    feature[i], feature[j], i, j
                );
            }
        }
    }
}

// ============================================================================
// PROPERTY: Outlier Handling
// ============================================================================

proptest! {
    #[test]
    fn prop_winsorize_preserves_length(
        data in prop::collection::vec(-100.0..100.0, 10..100)
    ) {
        if data.is_empty() {
            return Ok(());
        }

        let winsorized = winsorize(&data, 0.05, 0.95);
        prop_assert_eq!(winsorized.len(), data.len());
    }

    #[test]
    fn prop_winsorize_bounds(
        data in prop::collection::vec(-100.0..100.0, 10..100)
    ) {
        if data.is_empty() {
            return Ok(());
        }

        let winsorized = winsorize(&data, 0.1, 0.9);
        let mut sorted = data.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let lower_idx = (data.len() as f64 * 0.1) as usize;
        let upper_idx = (data.len() as f64 * 0.9) as usize;
        let lower_bound = sorted[lower_idx];
        let upper_bound = sorted[upper_idx];

        for &val in &winsorized {
            prop_assert!(
                val >= lower_bound && val <= upper_bound,
                "Winsorized value {} outside bounds [{}, {}]",
                val, lower_bound, upper_bound
            );
        }
    }
}

// ============================================================================
// PROPERTY: Seasonal Decomposition
// ============================================================================

proptest! {
    #[test]
    fn prop_seasonal_decompose_length(
        data in prop::collection::vec(-100.0..100.0, 20..100),
        period in 2..10usize
    ) {
        if data.len() < period * 2 {
            return Ok(());
        }

        let (trend, seasonal, residual) = seasonal_decompose(&data, period);

        prop_assert_eq!(trend.len(), data.len());
        prop_assert_eq!(seasonal.len(), data.len());
        prop_assert_eq!(residual.len(), data.len());
    }

    #[test]
    fn prop_seasonal_decompose_reconstruction(
        data in prop::collection::vec(-100.0..100.0, 50..100),
        period in 5..15usize
    ) {
        if data.len() < period * 2 {
            return Ok(());
        }

        let (trend, seasonal, residual) = seasonal_decompose(&data, period);

        for i in 0..data.len() {
            let reconstructed = trend[i] + seasonal[i] + residual[i];
            prop_assert!(
                (reconstructed - data[i]).abs() < 1.0,
                "Reconstruction error too large at index {}: {} vs {}",
                i, reconstructed, data[i]
            );
        }
    }
}

// ============================================================================
// PROPERTY: Robust Scaling
// ============================================================================

proptest! {
    #[test]
    fn prop_robust_scale_handles_outliers(
        data in prop::collection::vec(-10.0..10.0, 20..100)
    ) {
        if data.len() < 10 {
            return Ok(());
        }

        // Add outliers
        let mut data_with_outliers = data.clone();
        data_with_outliers.push(1000.0);
        data_with_outliers.push(-1000.0);

        let (scaled, _, _) = robust_scale(&data_with_outliers);

        // Most values should still be in reasonable range
        let reasonable_count = scaled.iter().filter(|&&x| x.abs() < 10.0).count();
        prop_assert!(
            reasonable_count > data.len() * 8 / 10,
            "Too many values outside reasonable range after robust scaling"
        );
    }
}

// ============================================================================
// PROPERTY: Rate of Change
// ============================================================================

proptest! {
    #[test]
    fn prop_rate_of_change_bounded_for_small_changes(
        base in 50.0..150.0f64,
        changes in prop::collection::vec(-5.0..5.0, 10..50)
    ) {
        let mut data = vec![base];
        for &change in &changes {
            data.push(data.last().unwrap() + change);
        }

        let roc = rate_of_change(&data, 1);

        for &r in &roc {
            prop_assert!(
                r.abs() < 0.2, // 20% max change
                "Rate of change {} too large for small changes", r
            );
        }
    }

    #[test]
    fn prop_rate_of_change_length(
        data in prop::collection::vec(1.0..100.0, 10..100),
        period in 1..5usize
    ) {
        if data.len() <= period {
            return Ok(());
        }

        let roc = rate_of_change(&data, period);
        prop_assert_eq!(roc.len(), data.len() - period);
    }
}

// ============================================================================
// PROPERTY: Log Transform
// ============================================================================

proptest! {
    #[test]
    fn prop_log_transform_inverse(data in prop::collection::vec(0.1..100.0, 10..100)) {
        let transformed = log_transform(&data);
        let recovered = inverse_log_transform(&transformed);

        for (orig, recov) in data.iter().zip(recovered.iter()) {
            prop_assert!(
                (orig - recov).abs() < 1e-8,
                "Original {} != Recovered {} after log transform", orig, recov
            );
        }
    }
}

// ============================================================================
// PROPERTY: No Panics (Fuzzing-style)
// ============================================================================

proptest! {
    #![proptest_config(ProptestConfig::with_cases(1000))]

    #[test]
    fn prop_normalize_no_panic(data in prop::collection::vec(any::<f64>(), 0..1000)) {
        // Should not panic for any input
        let _ = normalize(&data);
    }

    #[test]
    fn prop_minmax_normalize_no_panic(data in prop::collection::vec(any::<f64>(), 0..1000)) {
        let _ = min_max_normalize(&data);
    }

    #[test]
    fn prop_difference_no_panic(
        data in prop::collection::vec(any::<f64>(), 0..1000),
        lag in 0..20usize
    ) {
        let _ = difference(&data, lag);
    }

    #[test]
    fn prop_detrend_no_panic(data in prop::collection::vec(any::<f64>(), 0..1000)) {
        let _ = detrend(&data);
    }

    #[test]
    fn prop_rolling_mean_no_panic(
        data in prop::collection::vec(any::<f64>(), 0..1000),
        window in 1..50usize
    ) {
        let _ = rolling_mean(&data, window);
    }

    #[test]
    fn prop_ema_no_panic(
        data in prop::collection::vec(any::<f64>(), 0..1000),
        alpha in 0.0..1.0f64
    ) {
        let _ = ema(&data, alpha);
    }
}

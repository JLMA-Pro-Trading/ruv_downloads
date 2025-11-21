//! Accuracy tests for SIMD implementations
//!
//! Ensures SIMD operations produce numerically equivalent results to scalar operations.

#[cfg(feature = "simd")]
mod simd_tests {
    use nt_neural::utils::simd::*;
    use nt_neural::utils::preprocessing::{normalize, min_max_normalize};
    use nt_neural::utils::features::{rolling_mean, rolling_std, ema};

    const EPSILON: f64 = 1e-10;

    fn generate_test_data(size: usize) -> Vec<f64> {
        (0..size).map(|i| (i as f64 * 0.1).sin() * 100.0 + 50.0).collect()
    }

    #[test]
    fn test_simd_sum_accuracy() {
        let sizes = [10, 50, 100, 1000, 10000];

        for size in sizes {
            let data = generate_test_data(size);
            let scalar_sum: f64 = data.iter().sum();
            let simd_sum_result = simd_sum(&data);

            let error = (scalar_sum - simd_sum_result).abs();
            assert!(
                error < EPSILON,
                "Sum error {} exceeds threshold for size {}",
                error,
                size
            );
        }
    }

    #[test]
    fn test_simd_mean_accuracy() {
        let sizes = [10, 50, 100, 1000, 10000];

        for size in sizes {
            let data = generate_test_data(size);
            let scalar_mean = data.iter().sum::<f64>() / data.len() as f64;
            let simd_mean_result = simd_mean(&data);

            let error = (scalar_mean - simd_mean_result).abs();
            assert!(
                error < EPSILON,
                "Mean error {} exceeds threshold for size {}",
                error,
                size
            );
        }
    }

    #[test]
    fn test_simd_variance_accuracy() {
        let sizes = [10, 50, 100, 1000, 10000];

        for size in sizes {
            let data = generate_test_data(size);
            let mean = simd_mean(&data);

            let scalar_variance = data.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / data.len() as f64;
            let simd_variance_result = simd_variance(&data, mean);

            let error = (scalar_variance - simd_variance_result).abs();
            assert!(
                error < EPSILON,
                "Variance error {} exceeds threshold for size {}",
                error,
                size
            );
        }
    }

    #[test]
    fn test_simd_normalize_accuracy() {
        let sizes = [10, 50, 100, 1000, 10000];

        for size in sizes {
            let data = generate_test_data(size);
            let (scalar_normalized, params) = normalize(&data);

            // Manually compute with SIMD
            let simd_normalized = simd_normalize(&data, params.mean, params.std);

            assert_eq!(
                scalar_normalized.len(),
                simd_normalized.len(),
                "Length mismatch for size {}",
                size
            );

            for (i, (scalar, simd)) in scalar_normalized.iter().zip(&simd_normalized).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < 1e-8,
                    "Normalization error {} at index {} exceeds threshold for size {}",
                    error,
                    i,
                    size
                );
            }
        }
    }

    #[test]
    fn test_simd_min_max_normalize_accuracy() {
        let sizes = [10, 50, 100, 1000, 10000];

        for size in sizes {
            let data = generate_test_data(size);
            let (scalar_normalized, params) = min_max_normalize(&data);

            // Manually compute with SIMD
            let simd_normalized = simd_min_max_normalize(&data, params.min, params.max);

            assert_eq!(
                scalar_normalized.len(),
                simd_normalized.len(),
                "Length mismatch for size {}",
                size
            );

            for (i, (scalar, simd)) in scalar_normalized.iter().zip(&simd_normalized).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < EPSILON,
                    "Min-max normalization error {} at index {} exceeds threshold for size {}",
                    error,
                    i,
                    size
                );
            }
        }
    }

    #[test]
    fn test_simd_rolling_mean_accuracy() {
        let data = generate_test_data(1000);
        let windows = [3, 5, 10, 20, 50];

        for window in windows {
            let scalar_means = rolling_mean(&data, window);
            let simd_means = simd_rolling_mean(&data, window);

            assert_eq!(
                scalar_means.len(),
                simd_means.len(),
                "Length mismatch for window {}",
                window
            );

            for (i, (scalar, simd)) in scalar_means.iter().zip(&simd_means).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < 1e-8,
                    "Rolling mean error {} at index {} exceeds threshold for window {}",
                    error,
                    i,
                    window
                );
            }
        }
    }

    #[test]
    fn test_simd_rolling_std_accuracy() {
        let data = generate_test_data(1000);
        let windows = [3, 5, 10, 20, 50];

        for window in windows {
            let scalar_stds = rolling_std(&data, window);
            let simd_stds = simd_rolling_std(&data, window);

            assert_eq!(
                scalar_stds.len(),
                simd_stds.len(),
                "Length mismatch for window {}",
                window
            );

            for (i, (scalar, simd)) in scalar_stds.iter().zip(&simd_stds).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < 1e-8,
                    "Rolling std error {} at index {} exceeds threshold for window {}",
                    error,
                    i,
                    window
                );
            }
        }
    }

    #[test]
    fn test_simd_ema_accuracy() {
        let data = generate_test_data(1000);
        let alphas = [0.1, 0.3, 0.5, 0.7, 0.9];

        for alpha in alphas {
            let scalar_ema = ema(&data, alpha);
            let simd_ema_result = simd_ema(&data, alpha);

            assert_eq!(
                scalar_ema.len(),
                simd_ema_result.len(),
                "Length mismatch for alpha {}",
                alpha
            );

            for (i, (scalar, simd)) in scalar_ema.iter().zip(&simd_ema_result).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < 1e-8,
                    "EMA error {} at index {} exceeds threshold for alpha {}",
                    error,
                    i,
                    alpha
                );
            }
        }
    }

    #[test]
    fn test_simd_add_accuracy() {
        let sizes = [10, 50, 100, 1000];

        for size in sizes {
            let data_a = generate_test_data(size);
            let data_b = generate_test_data(size);

            let scalar_add: Vec<f64> = data_a.iter().zip(&data_b).map(|(a, b)| a + b).collect();
            let simd_add_result = simd_add(&data_a, &data_b);

            for (i, (scalar, simd)) in scalar_add.iter().zip(&simd_add_result).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < EPSILON,
                    "Add error {} at index {} exceeds threshold for size {}",
                    error,
                    i,
                    size
                );
            }
        }
    }

    #[test]
    fn test_simd_multiply_accuracy() {
        let sizes = [10, 50, 100, 1000];

        for size in sizes {
            let data_a = generate_test_data(size);
            let data_b = generate_test_data(size);

            let scalar_multiply: Vec<f64> = data_a.iter().zip(&data_b).map(|(a, b)| a * b).collect();
            let simd_multiply_result = simd_multiply(&data_a, &data_b);

            for (i, (scalar, simd)) in scalar_multiply.iter().zip(&simd_multiply_result).enumerate() {
                let error = (scalar - simd).abs();
                assert!(
                    error < EPSILON,
                    "Multiply error {} at index {} exceeds threshold for size {}",
                    error,
                    i,
                    size
                );
            }
        }
    }

    #[test]
    fn test_simd_denormalize_roundtrip() {
        let data = generate_test_data(1000);
        let (normalized, params) = normalize(&data);
        let denormalized = simd_denormalize(&normalized, params.mean, params.std);

        for (i, (original, recovered)) in data.iter().zip(&denormalized).enumerate() {
            let error = (original - recovered).abs();
            assert!(
                error < 1e-8,
                "Denormalization roundtrip error {} at index {} exceeds threshold",
                error,
                i
            );
        }
    }

    #[test]
    fn test_simd_min_max_denormalize_roundtrip() {
        let data = generate_test_data(1000);
        let (normalized, params) = min_max_normalize(&data);
        let denormalized = simd_min_max_denormalize(&normalized, params.min, params.max);

        for (i, (original, recovered)) in data.iter().zip(&denormalized).enumerate() {
            let error = (original - recovered).abs();
            assert!(
                error < EPSILON,
                "Min-max denormalization roundtrip error {} at index {} exceeds threshold",
                error,
                i
            );
        }
    }

    #[test]
    fn test_edge_cases() {
        // Empty data
        assert_eq!(simd_sum(&[]), 0.0);
        assert_eq!(simd_mean(&[]), 0.0);

        // Single element
        assert_eq!(simd_sum(&[5.0]), 5.0);
        assert_eq!(simd_mean(&[5.0]), 5.0);

        // All zeros
        let zeros = vec![0.0; 100];
        assert_eq!(simd_sum(&zeros), 0.0);
        assert_eq!(simd_mean(&zeros), 0.0);

        // All ones
        let ones = vec![1.0; 100];
        assert_eq!(simd_sum(&ones), 100.0);
        assert_eq!(simd_mean(&ones), 1.0);
    }

    #[test]
    fn test_non_multiple_of_four() {
        // Test sizes that are not multiples of 4 to ensure remainder handling
        let sizes = [1, 2, 3, 5, 7, 11, 13, 97, 101];

        for size in sizes {
            let data = generate_test_data(size);

            let scalar_sum: f64 = data.iter().sum();
            let simd_sum_result = simd_sum(&data);

            let error = (scalar_sum - simd_sum_result).abs();
            assert!(
                error < EPSILON,
                "Sum error {} exceeds threshold for non-aligned size {}",
                error,
                size
            );
        }
    }
}

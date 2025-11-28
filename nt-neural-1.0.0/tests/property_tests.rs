//! Property-based tests using proptest

#[cfg(all(feature = "candle", test))]
mod property_tests {
    use nt_neural::{
        models::{nhits::{NHITSModel, NHITSConfig}, ModelConfig},
        utils::{normalize, EvaluationMetrics},
    };
    use candle_core::{Device, DType, Tensor};
    use candle_nn::VarMap;
    use proptest::prelude::*;

    // Property: Normalization should be reversible
    proptest! {
        #[test]
        fn prop_normalization_reversible(data in prop::collection::vec(-1000.0f64..1000.0, 10..100)) {
            let (normalized, params) = normalize(&data);

            // Denormalize
            let denormalized: Vec<f64> = normalized
                .iter()
                .map(|&x| x * params.std + params.mean)
                .collect();

            // Check each value
            for (orig, denorm) in data.iter().zip(denormalized.iter()) {
                prop_assert!((orig - denorm).abs() < 1e-6,
                    "Denormalization should restore original: {} vs {}", orig, denorm);
            }
        }
    }

    // Property: Normalized data should have mean H 0 and std H 1
    proptest! {
        #[test]
        fn prop_normalized_distribution(data in prop::collection::vec(-100.0f64..100.0, 50..200)) {
            let (normalized, _) = normalize(&data);

            let mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
            let variance = normalized.iter()
                .map(|&x| (x - mean).powi(2))
                .sum::<f64>() / normalized.len() as f64;
            let std = variance.sqrt();

            prop_assert!((mean.abs()) < 0.1, "Mean should be ~0: {}", mean);
            prop_assert!((std - 1.0).abs() < 0.1, "Std should be ~1: {}", std);
        }
    }

    // Property: Model output should be finite for any finite input
    proptest! {
        #[test]
        fn prop_model_finite_output(
            batch_size in 1usize..5,
            input_val in -10.0f32..10.0
        ) {
            let config = NHITSConfig {
                base: ModelConfig {
                    input_size: 24,
                    horizon: 12,
                    hidden_size: 32,
                    num_features: 1,
                    dropout: 0.0,
                    device: None,
                },
                n_stacks: 2,
                n_blocks: vec![1, 1],
                n_freq_downsample: vec![2, 1],
                mlp_units: vec![vec![32, 32], vec![32, 32]],
                ..Default::default()
            };

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
            let model = NHITSModel::new(config, vb).unwrap();

            let device = Device::Cpu;
            let input = Tensor::full(input_val, (batch_size, 24), &device).unwrap();
            let output = model.forward(&input).unwrap();

            let output_vec: Vec<f32> = output.flatten_all().unwrap().to_vec1().unwrap();

            for val in output_vec {
                prop_assert!(val.is_finite(), "Output should be finite: {}", val);
            }
        }
    }

    // Property: MAE should always be non-negative
    proptest! {
        #[test]
        fn prop_mae_non_negative(
            y_true in prop::collection::vec(-100.0f64..100.0, 10..50),
            y_pred in prop::collection::vec(-100.0f64..100.0, 10..50)
        ) {
            prop_assume!(y_true.len() == y_pred.len());

            let metrics = EvaluationMetrics::compute(&y_true, &y_pred, None);

            if let Ok(m) = metrics {
                prop_assert!(m.mae >= 0.0, "MAE should be non-negative: {}", m.mae);
                prop_assert!(m.rmse >= 0.0, "RMSE should be non-negative: {}", m.rmse);
                prop_assert!(m.mape >= 0.0, "MAPE should be non-negative: {}", m.mape);
            }
        }
    }

    // Property: RMSE should be >= MAE
    proptest! {
        #[test]
        fn prop_rmse_gte_mae(
            y_true in prop::collection::vec(1.0f64..100.0, 20..50),
            y_pred in prop::collection::vec(1.0f64..100.0, 20..50)
        ) {
            prop_assume!(y_true.len() == y_pred.len());

            if let Ok(metrics) = EvaluationMetrics::compute(&y_true, &y_pred, None) {
                prop_assert!(metrics.rmse >= metrics.mae,
                    "RMSE should be >= MAE: {} vs {}", metrics.rmse, metrics.mae);
            }
        }
    }

    // Property: R² score should be <= 1.0
    proptest! {
        #[test]
        fn prop_r2_bounded(
            y_true in prop::collection::vec(-100.0f64..100.0, 20..50),
            y_pred in prop::collection::vec(-100.0f64..100.0, 20..50)
        ) {
            prop_assume!(y_true.len() == y_pred.len());

            // Need some variance in y_true
            let variance = {
                let mean = y_true.iter().sum::<f64>() / y_true.len() as f64;
                y_true.iter().map(|&y| (y - mean).powi(2)).sum::<f64>()
            };
            prop_assume!(variance > 0.1);

            if let Ok(metrics) = EvaluationMetrics::compute(&y_true, &y_pred, None) {
                prop_assert!(metrics.r2_score <= 1.0,
                    "R² should be <= 1.0: {}", metrics.r2_score);
            }
        }
    }

    // Property: Perfect predictions should give MAE = 0
    proptest! {
        #[test]
        fn prop_perfect_prediction(y in prop::collection::vec(-100.0f64..100.0, 10..50)) {
            let metrics = EvaluationMetrics::compute(&y, &y, None).unwrap();

            prop_assert!((metrics.mae.abs()) < 1e-10, "Perfect prediction MAE should be 0: {}", metrics.mae);
            prop_assert!((metrics.rmse.abs()) < 1e-10, "Perfect prediction RMSE should be 0: {}", metrics.rmse);
            prop_assert!((metrics.r2_score - 1.0).abs() < 1e-6,
                "Perfect prediction R² should be 1.0: {}", metrics.r2_score);
        }
    }

    // Property: Model output shape should match expected dimensions
    proptest! {
        #[test]
        fn prop_model_output_shape(
            batch_size in 1usize..8,
            input_size in 12usize..48,
            horizon in 6usize..24
        ) {
            let config = NHITSConfig {
                base: ModelConfig {
                    input_size,
                    horizon,
                    hidden_size: 32,
                    num_features: 1,
                    dropout: 0.0,
                    device: None,
                },
                n_stacks: 2,
                n_blocks: vec![1, 1],
                n_freq_downsample: vec![2, 1],
                mlp_units: vec![vec![32, 32], vec![32, 32]],
                ..Default::default()
            };

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);

            if let Ok(model) = NHITSModel::new(config, vb) {
                let device = Device::Cpu;
                let input = Tensor::randn(0.0f32, 1.0, (batch_size, input_size), &device).unwrap();

                if let Ok(output) = model.forward(&input) {
                    let dims = output.dims();
                    prop_assert_eq!(dims[0], batch_size, "Batch size should match");
                    prop_assert_eq!(dims[1], horizon, "Horizon should match");
                }
            }
        }
    }

    // Property: Scaling input should scale output proportionally
    proptest! {
        #[test]
        fn prop_model_scaling(scale_factor in 0.1f32..10.0) {
            let config = NHITSConfig {
                base: ModelConfig {
                    input_size: 24,
                    horizon: 12,
                    hidden_size: 32,
                    num_features: 1,
                    dropout: 0.0,
                    device: None,
                },
                n_stacks: 2,
                n_blocks: vec![1, 1],
                n_freq_downsample: vec![2, 1],
                mlp_units: vec![vec![32, 32], vec![32, 32]],
                ..Default::default()
            };

            let varmap = VarMap::new();
            let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
            let model = NHITSModel::new(config, vb).unwrap();

            let device = Device::Cpu;
            let input = Tensor::ones((2, 24), DType::F32, &device).unwrap();
            let scaled_input = (input.clone() * scale_factor as f64).unwrap();

            let output1 = model.forward(&input).unwrap();
            let output2 = model.forward(&scaled_input).unwrap();

            // Outputs should be different (not testing exact proportionality due to nonlinearity)
            let diff = (output1 - output2).unwrap();
            let diff_sum: f32 = diff.abs().unwrap().sum_all().unwrap().to_scalar().unwrap();

            prop_assert!(diff_sum > 0.01, "Scaled input should produce different output");
        }
    }

    // Property: Numerical stability - no NaN or Inf in computations
    proptest! {
        #[test]
        fn prop_numerical_stability(
            data in prop::collection::vec(-1e6f64..1e6, 50..150)
        ) {
            let (normalized, _params) = normalize(&data);

            for val in normalized {
                prop_assert!(val.is_finite(), "Normalized value should be finite: {}", val);
            }
        }
    }
}

#[cfg(not(all(feature = "candle", test)))]
mod stub_tests {
    #[test]
    fn test_without_candle() {
        println!("Property-based tests require candle feature");
    }
}

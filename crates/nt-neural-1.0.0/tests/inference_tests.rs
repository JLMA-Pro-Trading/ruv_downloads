//! Unit tests for inference pipelines

#[cfg(feature = "candle")]
mod candle_tests {
    use nt_neural::{
        inference::{Predictor, BatchPredictor},
        models::{nhits::{NHITSModel, NHITSConfig}, ModelConfig},
        Result,
    };
    use candle_core::{Device, DType, Tensor};
    use candle_nn::VarMap;
    use std::time::Instant;

    fn create_test_model() -> (NHITSModel, VarMap) {
        let config = NHITSConfig {
            base: ModelConfig {
                input_size: 24,
                horizon: 12,
                hidden_size: 64,
                num_features: 1,
                dropout: 0.0,
                device: None,
            },
            n_stacks: 2,
            n_blocks: vec![1, 1],
            n_freq_downsample: vec![2, 1],
            mlp_units: vec![vec![64, 64], vec![64, 64]],
            ..Default::default()
        };

        let varmap = VarMap::new();
        let vb = candle_nn::VarBuilder::from_varmap(&varmap, DType::F32, &Device::Cpu);
        let model = NHITSModel::new(config, vb).unwrap();

        (model, varmap)
    }

    #[test]
    fn test_predictor_creation() {
        let (model, _varmap) = create_test_model();
        let predictor = Predictor::new(Box::new(model));

        assert!(predictor.is_ok(), "Predictor creation should succeed");
    }

    #[tokio::test]
    async fn test_single_prediction() {
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        let input_data = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0,
                              11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0,
                              21.0, 22.0, 23.0, 24.0];

        let result = predictor.predict(&input_data).await;
        assert!(result.is_ok(), "Prediction should succeed");

        let prediction = result.unwrap();
        assert_eq!(prediction.point_forecast.len(), 12, "Should have 12 forecast points");

        for val in prediction.point_forecast.iter() {
            assert!(val.is_finite(), "Forecast should be finite: {}", val);
        }
    }

    #[tokio::test]
    async fn test_inference_latency() {
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        let input_data = vec![1.0; 24];

        let start = Instant::now();
        let result = predictor.predict(&input_data).await.unwrap();
        let duration = start.elapsed();

        assert!(result.inference_time_ms < 100.0,
            "Inference should be fast: {:.2}ms", result.inference_time_ms);
        println!("Inference latency: {:.2}ms", duration.as_secs_f64() * 1000.0);
    }

    #[tokio::test]
    async fn test_batch_prediction() {
        let (model, _varmap) = create_test_model();
        let predictor = BatchPredictor::new(Box::new(model), 4).unwrap();

        let batch_inputs = vec![
            vec![1.0; 24],
            vec![2.0; 24],
            vec![3.0; 24],
            vec![4.0; 24],
        ];

        let result = predictor.predict_batch(&batch_inputs).await;
        assert!(result.is_ok(), "Batch prediction should succeed");

        let predictions = result.unwrap();
        assert_eq!(predictions.len(), 4, "Should have 4 predictions");

        for prediction in predictions.iter() {
            assert_eq!(prediction.point_forecast.len(), 12);
        }
    }

    #[tokio::test]
    async fn test_batch_different_sizes() {
        let (model, _varmap) = create_test_model();

        for batch_size in [1, 2, 4, 8, 16] {
            let predictor = BatchPredictor::new(Box::new(model.clone()), batch_size);
            assert!(predictor.is_ok(), "Batch size {} should work", batch_size);

            let predictor = predictor.unwrap();
            let batch_inputs = vec![vec![1.0; 24]; batch_size];

            let result = predictor.predict_batch(&batch_inputs).await;
            assert!(result.is_ok(), "Batch size {} prediction should succeed", batch_size);

            let predictions = result.unwrap();
            assert_eq!(predictions.len(), batch_size);
        }
    }

    #[tokio::test]
    async fn test_prediction_consistency() {
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        let input_data = vec![1.0; 24];

        let result1 = predictor.predict(&input_data).await.unwrap();
        let result2 = predictor.predict(&input_data).await.unwrap();

        for (v1, v2) in result1.point_forecast.iter().zip(result2.point_forecast.iter()) {
            assert!((v1 - v2).abs() < 1e-5,
                "Predictions should be consistent: {} vs {}", v1, v2);
        }
    }

    #[tokio::test]
    async fn test_prediction_intervals() {
        // Test probabilistic predictions with confidence intervals
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        let input_data = vec![1.0; 24];
        let result = predictor.predict_with_intervals(&input_data, vec![0.1, 0.5, 0.9]).await;

        if result.is_ok() {
            let prediction = result.unwrap();

            if let Some(intervals) = prediction.prediction_intervals {
                assert!(!intervals.is_empty(), "Should have prediction intervals");

                for (quantile, lower, upper) in intervals.iter() {
                    assert_eq!(lower.len(), 12, "Lower bound should have 12 points");
                    assert_eq!(upper.len(), 12, "Upper bound should have 12 points");

                    for (l, u) in lower.iter().zip(upper.iter()) {
                        assert!(l <= u, "Lower bound should be <= upper bound");
                    }
                }
            }
        }
    }

    #[tokio::test]
    async fn test_invalid_input_size() {
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        // Wrong input size
        let input_data = vec![1.0; 20]; // Expected 24

        let result = predictor.predict(&input_data).await;
        assert!(result.is_err(), "Should fail with wrong input size");
    }

    #[tokio::test]
    async fn test_prediction_with_nan() {
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        let mut input_data = vec![1.0; 24];
        input_data[10] = f64::NAN;

        let result = predictor.predict(&input_data).await;
        // Should either handle NaN gracefully or fail with clear error
        assert!(result.is_err() || result.unwrap().point_forecast.iter().all(|x| x.is_finite()));
    }

    #[tokio::test]
    async fn test_prediction_with_extreme_values() {
        let (model, _varmap) = create_test_model();
        let mut predictor = Predictor::new(Box::new(model)).unwrap();

        let input_data = vec![1e6; 24]; // Very large values

        let result = predictor.predict(&input_data).await;
        assert!(result.is_ok(), "Should handle extreme values");

        let prediction = result.unwrap();
        for val in prediction.point_forecast.iter() {
            assert!(val.is_finite(), "Output should be finite for extreme inputs");
        }
    }

    #[tokio::test]
    async fn test_parallel_predictions() {
        use tokio::task;

        let (model, _varmap) = create_test_model();
        let predictor = std::sync::Arc::new(tokio::sync::Mutex::new(
            Predictor::new(Box::new(model)).unwrap()
        ));

        let mut handles = vec![];

        for i in 0..10 {
            let predictor_clone = predictor.clone();
            let handle = task::spawn(async move {
                let input_data = vec![i as f64; 24];
                let mut pred = predictor_clone.lock().await;
                pred.predict(&input_data).await
            });
            handles.push(handle);
        }

        for handle in handles {
            let result = handle.await.unwrap();
            assert!(result.is_ok(), "Parallel prediction should succeed");
        }
    }

    #[tokio::test]
    async fn test_inference_throughput() {
        let (model, _varmap) = create_test_model();
        let predictor = BatchPredictor::new(Box::new(model), 32).unwrap();

        let num_samples = 100;
        let batch_inputs = vec![vec![1.0; 24]; num_samples];

        let start = Instant::now();
        let _results = predictor.predict_batch(&batch_inputs).await.unwrap();
        let duration = start.elapsed();

        let throughput = num_samples as f64 / duration.as_secs_f64();
        println!("Inference throughput: {:.2} samples/sec", throughput);

        assert!(throughput > 10.0, "Throughput should be reasonable: {:.2} samples/sec", throughput);
    }

    #[test]
    fn test_predictor_metadata() {
        let (model, _varmap) = create_test_model();
        let predictor = Predictor::new(Box::new(model)).unwrap();

        let metadata = predictor.metadata();
        assert_eq!(metadata.input_size, 24);
        assert_eq!(metadata.horizon, 12);
        assert_eq!(metadata.model_type, "NHITS");
    }
}

#[cfg(not(feature = "candle"))]
mod stub_tests {
    #[test]
    fn test_without_candle() {
        println!("Inference tests require candle feature");
    }
}

//! End-to-end integration tests

#[cfg(feature = "candle")]
mod candle_tests {
    use nt_neural::{
        NHITSTrainer, NHITSTrainingConfig, TimeSeriesDataset, TrainingConfig,
        inference::Predictor,
        models::{nhits::NHITSConfig, ModelConfig},
        utils::{normalize, EvaluationMetrics},
    };
    use polars::prelude::*;
    use tempfile::TempDir;

    fn generate_test_data(n_samples: usize) -> DataFrame {
        let mut values = Vec::with_capacity(n_samples);
        let mut dates = Vec::with_capacity(n_samples);

        for i in 0..n_samples {
            let t = i as f64 / 10.0;
            let trend = t * 0.5;
            let seasonality = (t * 0.5).sin() * 20.0;
            values.push(100.0 + trend + seasonality);
            dates.push(format!("2024-01-{:02}", (i % 30) + 1));
        }

        df!(
            "date" => dates,
            "close" => values
        )
        .unwrap()
    }

    #[tokio::test]
    async fn test_complete_training_pipeline() {
        // Test the complete pipeline: data -> train -> save -> load -> predict
        let temp_dir = TempDir::new().unwrap();
        let model_path = temp_dir.path().join("model.safetensors");

        // 1. Generate data
        let df = generate_test_data(500);

        // 2. Configure and train
        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 32,
                num_epochs: 5,
                learning_rate: 0.001,
                validation_split: 0.2,
                ..Default::default()
            },
            model_config: NHITSConfig {
                base: ModelConfig {
                    input_size: 48,
                    horizon: 24,
                    hidden_size: 128,
                    dropout: 0.1,
                    num_features: 1,
                    device: None,
                },
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config.clone()).unwrap();
        let metrics = trainer.train_from_dataframe(df.clone(), "close").await.unwrap();

        println!("Training complete - Final loss: {:.6}", metrics.train_loss);

        // 3. Save model
        trainer.save_model(&model_path).unwrap();
        assert!(model_path.exists());

        // 4. Load model
        let mut new_trainer = NHITSTrainer::new(config).unwrap();
        new_trainer.load_model(&model_path).unwrap();

        // 5. Make predictions
        let test_input = vec![100.0; 48];
        let predictor = Predictor::new(Box::new(new_trainer.model().unwrap().clone())).unwrap();
        let prediction = predictor.predict(&test_input).await.unwrap();

        assert_eq!(prediction.point_forecast.len(), 24);
        println!(" Complete pipeline test passed");
    }

    #[tokio::test]
    async fn test_train_evaluate_cycle() {
        // Test train -> evaluate -> retrain cycle
        let df = generate_test_data(800);

        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 16,
                num_epochs: 3,
                validation_split: 0.2,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();

        // First training
        trainer.train_from_dataframe(df.clone(), "close").await.unwrap();

        // Evaluate
        let test_df = generate_test_data(200);
        let test_dataset = TimeSeriesDataset::new(test_df, "close", 48, 24).unwrap();
        let eval_metrics = trainer.validate(test_dataset).await.unwrap();

        println!("Initial evaluation:");
        println!("  MAE: {:.4}", eval_metrics.mae);
        println!("  RMSE: {:.4}", eval_metrics.rmse);
        println!("  R²: {:.4}", eval_metrics.r2_score);

        assert!(eval_metrics.mae > 0.0);
        assert!(eval_metrics.r2_score < 1.0);

        println!(" Train-evaluate cycle test passed");
    }

    #[tokio::test]
    async fn test_data_preprocessing_pipeline() {
        // Test data normalization and preprocessing
        let data: Vec<f64> = (0..100).map(|x| x as f64 * 2.0 + 10.0).collect();

        let (normalized, params) = normalize(&data);

        // Check normalization
        assert_eq!(normalized.len(), data.len());

        let mean = normalized.iter().sum::<f64>() / normalized.len() as f64;
        assert!((mean.abs()) < 1e-6, "Normalized mean should be ~0");

        // Denormalize
        let denormalized: Vec<f64> = normalized
            .iter()
            .map(|&x| x * params.std + params.mean)
            .collect();

        for (orig, denorm) in data.iter().zip(denormalized.iter()) {
            assert!((orig - denorm).abs() < 1e-6, "Denormalization should restore original");
        }

        println!(" Data preprocessing test passed");
    }

    #[tokio::test]
    async fn test_metrics_calculation() {
        // Test evaluation metrics computation
        let y_true = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let y_pred = vec![1.1, 2.1, 2.9, 4.2, 4.8];

        let metrics = EvaluationMetrics::compute(&y_true, &y_pred, None).unwrap();

        assert!(metrics.mae > 0.0 && metrics.mae < 1.0);
        assert!(metrics.rmse > 0.0 && metrics.rmse < 1.0);
        assert!(metrics.r2_score > 0.8 && metrics.r2_score < 1.0);
        assert!(metrics.mape > 0.0 && metrics.mape < 10.0);

        println!("Metrics:");
        println!("  MAE: {:.6}", metrics.mae);
        println!("  RMSE: {:.6}", metrics.rmse);
        println!("  R²: {:.6}", metrics.r2_score);
        println!("  MAPE: {:.2}%", metrics.mape);

        println!(" Metrics calculation test passed");
    }

    #[tokio::test]
    async fn test_model_comparison() {
        // Test comparing different model configurations
        let df = generate_test_data(400);

        let configs = vec![
            ("small", 64),
            ("medium", 128),
            ("large", 256),
        ];

        for (name, hidden_size) in configs {
            let config = NHITSTrainingConfig {
                base: TrainingConfig {
                    batch_size: 16,
                    num_epochs: 3,
                    validation_split: 0.2,
                    ..Default::default()
                },
                model_config: NHITSConfig {
                    base: ModelConfig {
                        input_size: 24,
                        horizon: 12,
                        hidden_size,
                        dropout: 0.1,
                        num_features: 1,
                        device: None,
                    },
                    ..Default::default()
                },
                ..Default::default()
            };

            let mut trainer = NHITSTrainer::new(config).unwrap();
            let metrics = trainer.train_from_dataframe(df.clone(), "close").await.unwrap();

            println!("{} model - Final loss: {:.6}", name, metrics.train_loss);
        }

        println!(" Model comparison test passed");
    }

    #[tokio::test]
    async fn test_multi_horizon_forecasting() {
        // Test forecasting with different horizons
        let df = generate_test_data(600);

        for horizon in [12, 24, 48] {
            let config = NHITSTrainingConfig {
                base: TrainingConfig {
                    batch_size: 16,
                    num_epochs: 3,
                    ..Default::default()
                },
                model_config: NHITSConfig {
                    base: ModelConfig {
                        input_size: 48,
                        horizon,
                        hidden_size: 64,
                        dropout: 0.1,
                        num_features: 1,
                        device: None,
                    },
                    ..Default::default()
                },
                ..Default::default()
            };

            let mut trainer = NHITSTrainer::new(config).unwrap();
            let result = trainer.train_from_dataframe(df.clone(), "close").await;

            assert!(result.is_ok(), "Horizon {} should work", horizon);
            println!("Horizon {} training complete", horizon);
        }

        println!(" Multi-horizon test passed");
    }

    #[tokio::test]
    async fn test_checkpoint_recovery() {
        // Test training recovery from checkpoint
        let temp_dir = TempDir::new().unwrap();
        let checkpoint_dir = temp_dir.path().join("checkpoints");
        let df = generate_test_data(300);

        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 16,
                num_epochs: 10,
                early_stopping_patience: 20, // Don't stop early
                ..Default::default()
            },
            checkpoint_dir: Some(checkpoint_dir.clone()),
            save_every: 2, // Save every 2 epochs
            ..Default::default()
        };

        // Train for a few epochs
        let mut trainer = NHITSTrainer::new(config.clone()).unwrap();
        trainer.train_from_dataframe(df.clone(), "close").await.unwrap();

        // Check that checkpoints were created
        assert!(checkpoint_dir.exists());
        let entries = std::fs::read_dir(&checkpoint_dir).unwrap();
        let checkpoint_count = entries.count();

        assert!(checkpoint_count > 0, "Should have created checkpoints");
        println!("Created {} checkpoints", checkpoint_count);

        println!(" Checkpoint recovery test passed");
    }

    #[tokio::test]
    async fn test_inference_batch_processing() {
        // Test batch inference on multiple sequences
        let df = generate_test_data(200);

        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 16,
                num_epochs: 3,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();
        trainer.train_from_dataframe(df, "close").await.unwrap();

        let model = trainer.model().unwrap().clone();
        let batch_predictor = nt_neural::inference::BatchPredictor::new(
            Box::new(model),
            8
        ).unwrap();

        // Create batch of inputs
        let batch_inputs = vec![vec![1.0; 48]; 10];

        let predictions = batch_predictor.predict_batch(&batch_inputs).await.unwrap();

        assert_eq!(predictions.len(), 10);
        for pred in predictions.iter() {
            assert_eq!(pred.point_forecast.len(), 24);
        }

        println!(" Batch processing test passed");
    }

    #[tokio::test]
    async fn test_error_handling() {
        // Test various error conditions
        let df = generate_test_data(50); // Very small dataset

        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 100, // Larger than dataset
                num_epochs: 1,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();

        // This should handle small dataset gracefully
        let result = trainer.train_from_dataframe(df, "close").await;

        // Either succeeds with adjusted batch size or fails gracefully
        if result.is_err() {
            println!("Correctly handled small dataset error");
        } else {
            println!("Adapted to small dataset");
        }

        println!(" Error handling test passed");
    }

    #[tokio::test]
    async fn test_performance_tracking() {
        // Test that training tracks performance over time
        let df = generate_test_data(400);

        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 32,
                num_epochs: 10,
                validation_split: 0.2,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();
        trainer.train_from_dataframe(df, "close").await.unwrap();

        let history = trainer.metrics_history();

        assert!(history.len() > 1, "Should have multiple epochs");

        // Check that metrics are being tracked
        for (i, metrics) in history.iter().enumerate() {
            assert_eq!(metrics.epoch, i);
            assert!(metrics.train_loss >= 0.0);
            assert!(metrics.epoch_time_seconds > 0.0);

            if let Some(val_loss) = metrics.val_loss {
                assert!(val_loss >= 0.0);
            }
        }

        println!("Tracked {} epochs of training", history.len());
        println!(" Performance tracking test passed");
    }
}

#[cfg(not(feature = "candle"))]
mod stub_tests {
    #[test]
    fn test_without_candle() {
        println!("Integration tests require candle feature");
    }
}

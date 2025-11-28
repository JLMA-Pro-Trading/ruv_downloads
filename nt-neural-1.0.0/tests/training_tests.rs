//! Comprehensive training tests for NHITS model

#[cfg(feature = "candle")]
mod candle_tests {
    use nt_neural::{
        NHITSTrainer, NHITSTrainingConfig, OptimizerConfig, TimeSeriesDataset, TrainingConfig,
    };
    use polars::prelude::*;
    use std::path::PathBuf;
    use tempfile::TempDir;

    /// Generate synthetic time series data for testing
    fn generate_synthetic_data(n_samples: usize, noise: f64) -> DataFrame {
        let mut values = Vec::with_capacity(n_samples);
        let mut dates = Vec::with_capacity(n_samples);

        for i in 0..n_samples {
            let t = i as f64 / 10.0;

            // Synthetic signal: trend + seasonality + noise
            let trend = t * 0.5;
            let seasonality = (t * 0.5).sin() * 20.0 + (t * 2.0).cos() * 10.0;
            let noise_component = (rand::random::<f64>() - 0.5) * noise;

            values.push(100.0 + trend + seasonality + noise_component);
            dates.push(format!("2024-01-{:02}", (i % 30) + 1));
        }

        df!(
            "date" => dates,
            "close" => values.clone(),
            "open" => values.iter().map(|v| v * 0.99).collect::<Vec<_>>(),
            "high" => values.iter().map(|v| v * 1.01).collect::<Vec<_>>(),
            "low" => values.iter().map(|v| v * 0.98).collect::<Vec<_>>(),
            "volume" => vec![1000000.0; n_samples]
        )
        .unwrap()
    }

    #[tokio::test]
    async fn test_overfit_single_batch() {
        // Test that the model can overfit a small dataset (sanity check)
        let mut config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 16,
                num_epochs: 100,
                learning_rate: 0.01,
                weight_decay: 0.0,
                gradient_clip: Some(1.0),
                early_stopping_patience: 50,
                validation_split: 0.0, // No validation for overfitting test
                mixed_precision: false,
            },
            model_config: nt_neural::NHITSConfig {
                base: nt_neural::ModelConfig {
                    input_size: 24,
                    horizon: 12,
                    hidden_size: 128,
                    dropout: 0.0, // No dropout for overfitting
                    num_features: 1,
                    device: None,
                },
                n_stacks: 2,
                n_blocks: vec![1, 1],
                n_freq_downsample: vec![2, 1],
                mlp_units: vec![vec![128, 128], vec![128, 128]],
                interpolation_mode: nt_neural::nhits::InterpolationMode::Linear,
                pooling_mode: nt_neural::nhits::PoolingMode::MaxPool,
                quantiles: vec![0.5],
            },
            optimizer_config: OptimizerConfig::adam(0.01),
            use_quantile_loss: false,
            target_quantiles: vec![0.5],
            checkpoint_dir: None,
            tensorboard_dir: None,
            save_every: 10,
            gpu_device: None,
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();

        // Small dataset for overfitting
        let df = generate_synthetic_data(100, 1.0);

        let result = trainer.train_from_dataframe(df, "close").await;
        assert!(result.is_ok(), "Training should succeed");

        let metrics = result.unwrap();

        // Model should achieve very low loss on small dataset
        assert!(
            metrics.train_loss < 100.0,
            "Model should overfit small dataset: loss = {}",
            metrics.train_loss
        );

        println!("✅ Overfit test passed: Final loss = {:.6}", metrics.train_loss);
    }

    #[tokio::test]
    async fn test_training_convergence() {
        // Test that training loss decreases over epochs
        let _config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 32,
                num_epochs: 20,
                learning_rate: 0.001,
                validation_split: 0.2,
                early_stopping_patience: 10,
                ..Default::default()
            },
            model_config: nt_neural::NHITSConfig {
                base: nt_neural::ModelConfig {
                    input_size: 48,
                    horizon: 24,
                    hidden_size: 256,
                    dropout: 0.1,
                    num_features: 1,
                    device: None,
                },
                ..Default::default()
            },
            optimizer_config: OptimizerConfig::adamw(0.001, 1e-5),
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();

        let df = generate_synthetic_data(1000, 5.0);
        let result = trainer.train_from_dataframe(df, "close").await;

        assert!(result.is_ok(), "Training should succeed");

        let history = trainer.metrics_history();
        assert!(
            history.len() > 1,
            "Should have multiple epochs of metrics"
        );

        // Check that loss generally decreases
        let first_loss = history[0].train_loss;
        let last_loss = history.last().unwrap().train_loss;

        println!(
            "📊 First loss: {:.6}, Last loss: {:.6}",
            first_loss, last_loss
        );

        assert!(
            last_loss < first_loss * 0.9,
            "Loss should decrease by at least 10%: {} -> {}",
            first_loss,
            last_loss
        );

        println!("✅ Convergence test passed");
    }

    #[tokio::test]
    async fn test_checkpoint_save_load() {
        let temp_dir = TempDir::new().unwrap();
        let checkpoint_dir = temp_dir.path().join("checkpoints");
        let model_path = temp_dir.path().join("model.safetensors");

        let _config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 16,
                num_epochs: 5,
                validation_split: 0.2,
                ..Default::default()
            },
            checkpoint_dir: Some(checkpoint_dir.clone()),
            ..Default::default()
        };

        // Train and save
        let mut trainer = NHITSTrainer::new(config.clone()).unwrap();
        let df = generate_synthetic_data(200, 2.0);

        trainer
            .train_from_dataframe(df.clone(), "close")
            .await
            .unwrap();

        trainer.save_model(&model_path).unwrap();

        // Verify files exist
        assert!(model_path.exists(), "Model file should exist");
        assert!(
            model_path.with_extension("config.json").exists(),
            "Config file should exist"
        );
        assert!(
            model_path.with_extension("metrics.json").exists(),
            "Metrics file should exist"
        );

        // Load and verify
        let mut new_trainer = NHITSTrainer::new(config).unwrap();
        new_trainer.load_model(&model_path).unwrap();

        assert!(new_trainer.model().is_some(), "Model should be loaded");

        println!("✅ Checkpoint save/load test passed");
    }

    #[tokio::test]
    async fn test_early_stopping() {
        let _config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 16,
                num_epochs: 100, // Set high to test early stopping
                validation_split: 0.2,
                early_stopping_patience: 5,
                learning_rate: 0.0001, // Low LR to ensure plateau
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();
        let df = generate_synthetic_data(300, 2.0);

        trainer.train_from_dataframe(df, "close").await.unwrap();

        let history = trainer.metrics_history();

        // Should stop before 100 epochs
        assert!(
            history.len() < 100,
            "Should trigger early stopping before 100 epochs: stopped at {}",
            history.len()
        );

        println!(
            "✅ Early stopping test passed: Stopped at epoch {}",
            history.len()
        );
    }

    #[tokio::test]
    async fn test_validation_metrics() {
        let _config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 32,
                num_epochs: 10,
                validation_split: 0.2,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut trainer = NHITSTrainer::new(config).unwrap();
        let df = generate_synthetic_data(500, 3.0);

        trainer.train_from_dataframe(df.clone(), "close").await.unwrap();

        // Create test dataset
        let test_df = generate_synthetic_data(200, 3.0);
        let test_dataset =
            TimeSeriesDataset::new(test_df, "close", 24, 12).unwrap();

        let eval_metrics = trainer.validate(test_dataset).await.unwrap();

        println!("📊 Validation Metrics:");
        println!("  MAE: {:.6}", eval_metrics.mae);
        println!("  RMSE: {:.6}", eval_metrics.rmse);
        println!("  MAPE: {:.2}%", eval_metrics.mape);
        println!("  R²: {:.4}", eval_metrics.r2_score);

        // Basic sanity checks
        assert!(eval_metrics.mae > 0.0, "MAE should be positive");
        assert!(eval_metrics.rmse > 0.0, "RMSE should be positive");
        assert!(
            eval_metrics.mape < 100.0,
            "MAPE should be reasonable: {}%",
            eval_metrics.mape
        );

        println!("✅ Validation metrics test passed");
    }

    #[tokio::test]
    async fn test_different_optimizers() {
        for (name, optimizer_config) in [
            ("Adam", OptimizerConfig::adam(0.001)),
            ("AdamW", OptimizerConfig::adamw(0.001, 1e-5)),
            ("SGD", OptimizerConfig::sgd(0.01, 0.9)),
        ] {
            println!("Testing optimizer: {}", name);

            let _config = NHITSTrainingConfig {
                base: TrainingConfig {
                    batch_size: 16,
                    num_epochs: 5,
                    validation_split: 0.2,
                    ..Default::default()
                },
                optimizer_config,
                ..Default::default()
            };

            let mut trainer = NHITSTrainer::new(config).unwrap();
            let df = generate_synthetic_data(200, 2.0);

            let result = trainer.train_from_dataframe(df, "close").await;
            assert!(result.is_ok(), "{} optimizer should work", name);

            println!("  ✅ {} passed", name);
        }
    }

    #[tokio::test]
    async fn test_gpu_vs_cpu_parity() {
        // This test only runs if GPU is available
        #[cfg(any(feature = "cuda", feature = "metal"))]
        {
            // Test that CPU and GPU produce similar results
            let df = generate_synthetic_data(200, 1.0);

            // Train on CPU
            let config_cpu = NHITSTrainingConfig {
                base: TrainingConfig {
                    num_epochs: 5,
                    batch_size: 16,
                    ..Default::default()
                },
                gpu_device: None,
                ..Default::default()
            };

            let mut trainer_cpu = NHITSTrainer::new(config_cpu).unwrap();
            let metrics_cpu = trainer_cpu
                .train_from_dataframe(df.clone(), "close")
                .await
                .unwrap();

            // Try GPU
            let config_gpu = NHITSTrainingConfig {
                base: TrainingConfig {
                    num_epochs: 5,
                    batch_size: 16,
                    ..Default::default()
                },
                gpu_device: Some(0),
                ..Default::default()
            };

            if let Ok(mut trainer_gpu) = NHITSTrainer::new(config_gpu) {
                let metrics_gpu = trainer_gpu
                    .train_from_dataframe(df, "close")
                    .await
                    .unwrap();

                println!("CPU loss: {:.6}", metrics_cpu.train_loss);
                println!("GPU loss: {:.6}", metrics_gpu.train_loss);

                // Results should be similar (within 10%)
                let diff_pct =
                    (metrics_cpu.train_loss - metrics_gpu.train_loss).abs() / metrics_cpu.train_loss
                        * 100.0;

                assert!(
                    diff_pct < 10.0,
                    "CPU and GPU results should be similar: {:.2}% difference",
                    diff_pct
                );

                println!("✅ GPU vs CPU parity test passed");
            } else {
                println!("⚠️  GPU not available, skipping GPU test");
            }
        }

        #[cfg(not(any(feature = "cuda", feature = "metal")))]
        {
            println!("⚠️  GPU features not compiled, skipping GPU test");
        }
    }
}

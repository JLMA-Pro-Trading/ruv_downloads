//! Complete training and inference example

use nt_neural::{
    models::{nhits::{NHITSModel, NHITSConfig}, ModelConfig},
    training::{
        DataLoader, TimeSeriesDataset, Trainer, TrainingConfig,
        OptimizerConfig, OptimizerType,
    },
    inference::{Predictor, BatchPredictor},
    utils::{normalize, EvaluationMetrics},
    initialize,
};
use polars::prelude::*;
use std::time::Instant;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("=== Neural Trader - Complete Training Example ===\n");

    // 1. Initialize device
    let device = initialize()?;
    println!("Device: {:?}", device);

    // 2. Generate synthetic data
    println!("\n1. Generating synthetic time series data...");
    let (train_df, val_df, test_data) = generate_synthetic_data();
    println!("   Train samples: {}", train_df.height());
    println!("   Val samples: {}", val_df.height());

    // 3. Create datasets
    println!("\n2. Creating datasets...");
    let train_dataset = TimeSeriesDataset::new(train_df, "value", 168, 24)?;
    let val_dataset = TimeSeriesDataset::new(val_df, "value", 168, 24)?;

    println!("   Train dataset size: {}", train_dataset.len());
    println!("   Val dataset size: {}", val_dataset.len());

    // 4. Create data loaders
    println!("\n3. Creating data loaders...");
    let train_loader = DataLoader::new(train_dataset, 32)
        .with_shuffle(true)
        .with_drop_last(false);

    let val_loader = DataLoader::new(val_dataset, 32)
        .with_shuffle(false)
        .with_drop_last(false);

    println!("   Train batches: {}", train_loader.num_batches());
    println!("   Val batches: {}", val_loader.num_batches());

    // 5. Create model
    println!("\n4. Creating NHITS model...");
    let _config = NHITSConfig {
        input_size: 168,
        horizon: 24,
        num_stacks: 3,
        num_blocks: vec![1, 1, 1],
        num_layers: vec![2, 2, 2],
        layer_size: 512,
        pooling_kernel_sizes: Some(vec![vec![2, 2], vec![4, 4], vec![8, 8]]),
        ..Default::default()
    };

    let model_config = ModelConfig {
        input_size: 168,
        horizon: 24,
        hidden_size: 512,
        num_features: 1,
        dropout: 0.1,
        device: Some(device.clone()),
    };

    println!("   Model: NHITS");
    println!("   Input size: {}", config.input_size);
    println!("   Horizon: {}", config.horizon);
    println!("   Stacks: {}", config.num_stacks);

    // 6. Create trainer
    println!("\n5. Setting up trainer...");
    let training_config = TrainingConfig {
        batch_size: 32,
        num_epochs: 50,
        learning_rate: 1e-3,
        weight_decay: 1e-5,
        gradient_clip: Some(1.0),
        early_stopping_patience: 10,
        validation_split: 0.2,
        mixed_precision: false,
    };

    let optimizer_config = OptimizerConfig::adamw(1e-3, 1e-5);

    let mut trainer = Trainer::new(training_config, device.clone())
        .with_checkpointing("checkpoints/nhits");

    // Create model with trainer's varmap
    let model = NHITSModel::new(config, trainer.varmap())?;

    println!("   Optimizer: AdamW");
    println!("   Learning rate: {}", optimizer_config.learning_rate);
    println!("   Early stopping patience: 10");

    // 7. Train model
    println!("\n6. Training model...");
    let train_start = Instant::now();

    let (trained_model, metrics) = trainer
        .train(model, train_loader, Some(val_loader), optimizer_config)
        .await?;

    let train_time = train_start.elapsed();
    println!("\n   Training completed in {:.2}s", train_time.as_secs_f64());
    println!("   Final train loss: {:.6}", metrics.last().unwrap().train_loss);
    println!("   Final val loss: {:.6}", metrics.last().unwrap().val_loss.unwrap());

    // 8. Create predictor
    println!("\n7. Creating predictor...");
    let mut predictor = Predictor::new(trained_model, device.clone());
    predictor.warmup(168)?;
    println!("   Predictor warmed up");

    // 9. Make predictions
    println!("\n8. Making predictions...");
    let inference_start = Instant::now();
    let prediction = predictor.predict(&test_data)?;
    let inference_time = inference_start.elapsed();

    println!("   Inference time: {:.2}ms", prediction.inference_time_ms);
    println!("   Throughput: {:.0} predictions/sec", 1000.0 / prediction.inference_time_ms);
    println!("   Forecast length: {}", prediction.point_forecast.len());

    // 10. Batch prediction benchmark
    println!("\n9. Batch prediction benchmark...");
    let batch_data: Vec<Vec<f64>> = (0..100).map(|_| test_data.clone()).collect();

    let batch_predictor = BatchPredictor::new(*predictor.model(), device, 32);
    let batch_start = Instant::now();
    let batch_results = batch_predictor.predict_batch(batch_data)?;
    let batch_time = batch_start.elapsed();

    println!("   Batch size: 100 samples");
    println!("   Total time: {:.2}s", batch_time.as_secs_f64());
    println!("   Throughput: {:.0} samples/sec", 100.0 / batch_time.as_secs_f64());
    println!("   Avg latency: {:.2}ms", batch_time.as_secs_f64() * 1000.0 / 100.0);

    println!("\n=== Training Complete ===\n");
    println!("Summary:");
    println!("  - Model: NHITS (3 stacks, 512 hidden)");
    println!("  - Training time: {:.2}s", train_time.as_secs_f64());
    println!("  - Inference latency: {:.2}ms", prediction.inference_time_ms);
    println!("  - Batch throughput: {:.0} samples/sec", 100.0 / batch_time.as_secs_f64());

    Ok(())
}

/// Generate synthetic time series data
fn generate_synthetic_data() -> (DataFrame, DataFrame, Vec<f64>) {
    let n = 10000;

    // Generate sine wave with noise
    let values: Vec<f64> = (0..n)
        .map(|i| {
            let t = i as f64 / 24.0; // Hourly data
            let trend = 100.0 + t * 0.1;
            let seasonal = 20.0 * (2.0 * std::f64::consts::PI * t / 168.0).sin(); // Weekly
            let noise = rand::random::<f64>() * 5.0 - 2.5;
            trend + seasonal + noise
        })
        .collect();

    // Split into train/val/test
    let train_size = 7000;
    let val_size = 2000;

    let train_values = &values[..train_size];
    let val_values = &values[train_size..train_size + val_size];
    let test_values = &values[train_size + val_size..train_size + val_size + 168];

    // Create DataFrames
    let train_df = df!(
        "timestamp" => (0..train_size).map(|i| format!("2024-01-01T{:02}:00:00", i % 24)).collect::<Vec<_>>(),
        "value" => train_values
    )
    .unwrap();

    let val_df = df!(
        "timestamp" => (0..val_size).map(|i| format!("2024-01-01T{:02}:00:00", i % 24)).collect::<Vec<_>>(),
        "value" => val_values
    )
    .unwrap();

    (train_df, val_df, test_values.to_vec())
}

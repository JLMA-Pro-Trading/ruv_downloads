//! Basic training example for NHITS model
//!
//! This example demonstrates:
//! - Loading data from CSV
//! - Configuring training parameters
//! - Training a model
//! - Saving the trained model
//!
//! Run with:
//! ```bash
//! cargo run --example basic_training --features candle
//! ```

use nt_neural::{
    NHITSConfig, NHITSTrainer, NHITSTrainingConfig, OptimizerConfig, TrainingConfig,
};
use polars::prelude::*;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing for logging
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .init();

    tracing::info!("Starting basic training example");

    // Create synthetic training data
    let data = create_synthetic_data(1000)?;

    // Save to CSV
    let mut file = std::fs::File::create("train_data.csv")?;
    CsvWriter::new(&mut file).finish(&mut data.clone())?;

    // Configure training
    let config = NHITSTrainingConfig {
        base: TrainingConfig {
            batch_size: 32,
            num_epochs: 50,
            learning_rate: 1e-3,
            weight_decay: 1e-5,
            gradient_clip: Some(1.0),
            early_stopping_patience: 10,
            validation_split: 0.2,
            mixed_precision: false, // Disable for CPU
        },
        model_config: NHITSConfig::default(),
        optimizer_config: OptimizerConfig::adamw(1e-3, 1e-5),
        checkpoint_dir: Some(PathBuf::from("checkpoints")),
        save_every: 10,
        ..Default::default()
    };

    tracing::info!("Training configuration:");
    tracing::info!("  Batch size: {}", config.base.batch_size);
    tracing::info!("  Epochs: {}", config.base.num_epochs);
    tracing::info!("  Learning rate: {}", config.base.learning_rate);

    // Create trainer
    let mut trainer = NHITSTrainer::new(config)?;

    tracing::info!("Starting training...");

    // Train model
    let metrics = trainer.train_from_csv("train_data.csv", "value").await?;

    tracing::info!("Training complete!");
    tracing::info!("Final metrics:");
    tracing::info!("  Train loss: {:.6}", metrics.train_loss);
    tracing::info!(
        "  Validation loss: {:.6}",
        metrics.val_loss.unwrap_or(0.0)
    );
    tracing::info!("  Learning rate: {:.2e}", metrics.learning_rate);
    tracing::info!("  Epoch time: {:.2}s", metrics.epoch_time_seconds);

    // Save trained model
    tracing::info!("Saving model...");
    trainer.save_model("models/nhits_basic.safetensors")?;

    tracing::info!("Model saved successfully!");

    // Clean up temporary files
    std::fs::remove_file("train_data.csv")?;

    Ok(())
}

/// Create synthetic time series data for demonstration
fn create_synthetic_data(n: usize) -> Result<DataFrame, PolarsError> {
    use std::f64::consts::PI;

    let timestamps: Vec<String> = (0..n)
        .map(|i| format!("2024-01-{:02} {:02}:00:00", (i / 24) % 30 + 1, i % 24))
        .collect();

    let values: Vec<f64> = (0..n)
        .map(|i| {
            let t = i as f64 / 10.0;
            // Combine sine waves with trend and noise
            100.0 + 10.0 * (t * 2.0 * PI / 24.0).sin()
                + 5.0 * (t * 2.0 * PI / 168.0).sin()
                + rand::random::<f64>() * 2.0
        })
        .collect();

    let feature1: Vec<f64> = values.iter().map(|v| v * 1.1).collect();
    let feature2: Vec<f64> = values.iter().map(|v| v * 0.9).collect();

    df!(
        "timestamp" => timestamps,
        "value" => values,
        "feature1" => feature1,
        "feature2" => feature2
    )
}

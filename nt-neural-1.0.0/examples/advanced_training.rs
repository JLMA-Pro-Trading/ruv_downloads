//! Advanced training example with GPU acceleration and checkpointing
//!
//! This example demonstrates:
//! - GPU training (CUDA/Metal)
//! - Mixed precision training
//! - Custom optimizer configuration
//! - Learning rate scheduling
//! - Model checkpointing
//! - Training metrics tracking
//!
//! Run with:
//! ```bash
//! cargo run --example advanced_training --features candle,cuda
//! # or for Metal on macOS:
//! cargo run --example advanced_training --features candle,metal
//! ```

use nt_neural::{
    ModelConfig, NHITSConfig, NHITSTrainer, NHITSTrainingConfig, OptimizerConfig,
    OptimizerType, TrainingConfig,
};
use polars::prelude::*;
use std::path::PathBuf;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging with detailed output
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::DEBUG)
        .init();

    tracing::info!("Starting advanced training example with GPU acceleration");

    // Create larger synthetic dataset
    let data = create_synthetic_data(5000)?;

    // Save as Parquet for faster loading
    let mut file = std::fs::File::create("train_data.parquet")?;
    ParquetWriter::new(&mut file).finish(&mut data.clone())?;

    // Advanced training configuration
    let config = NHITSTrainingConfig {
        base: TrainingConfig {
            batch_size: 128, // Larger batch for GPU
            num_epochs: 200,
            learning_rate: 2e-3,
            weight_decay: 1e-4,
            gradient_clip: Some(1.0),
            early_stopping_patience: 20,
            validation_split: 0.2,
            mixed_precision: true, // Enable FP16 training
        },
        model_config: NHITSConfig {
            base: ModelConfig {
                input_size: 168, // 1 week of hourly data
                horizon: 24,     // 24 hour forecast
                hidden_size: 1024, // Larger model
                num_features: 3,
                dropout: 0.1,
                device: None,
            },
            num_stacks: 3,
            num_blocks_per_stack: 4,
            mlp_units: vec![512, 512],
            interpolation_mode: String::from("linear"),
            pooling_kernel_size: 2,
            ..Default::default()
        },
        optimizer_config: OptimizerConfig {
            optimizer_type: OptimizerType::AdamW,
            learning_rate: 2e-3,
            weight_decay: 1e-4,
            betas: (0.9, 0.999),
            eps: 1e-8,
            ..Default::default()
        },
        checkpoint_dir: Some(PathBuf::from("checkpoints/advanced")),
        save_every: 10,
        gpu_device: Some(0), // Use first GPU
        use_quantile_loss: false,
        target_quantiles: vec![0.1, 0.5, 0.9],
        tensorboard_dir: None,
    };

    tracing::info!("Advanced configuration:");
    tracing::info!("  Batch size: {} (optimized for GPU)", config.base.batch_size);
    tracing::info!("  Epochs: {}", config.base.num_epochs);
    tracing::info!("  Learning rate: {}", config.base.learning_rate);
    tracing::info!("  Weight decay: {}", config.base.weight_decay);
    tracing::info!("  Mixed precision: {}", config.base.mixed_precision);
    tracing::info!("  Model hidden size: {}", config.model_config.base.hidden_size);
    tracing::info!("  Optimizer: {:?}", config.optimizer_config.optimizer_type);

    // Create trainer
    let mut trainer = match NHITSTrainer::new(config) {
        Ok(t) => {
            tracing::info!("Trainer created successfully with GPU support");
            t
        }
        Err(e) => {
            tracing::warn!("Failed to create GPU trainer: {}", e);
            tracing::info!("Falling back to CPU training");

            // Fallback to CPU configuration
            let cpu_config = NHITSTrainingConfig {
                base: TrainingConfig {
                    batch_size: 32,
                    mixed_precision: false,
                    ..config.base
                },
                gpu_device: None,
                ..config
            };

            NHITSTrainer::new(cpu_config)?
        }
    };

    tracing::info!("Starting training from Parquet file...");

    let start = std::time::Instant::now();

    // Train model
    let metrics = trainer
        .train_from_parquet("train_data.parquet", "value")
        .await?;

    let training_time = start.elapsed();

    tracing::info!("Training complete in {:.2}s!", training_time.as_secs_f64());
    tracing::info!("Final metrics:");
    tracing::info!("  Train loss: {:.6}", metrics.train_loss);
    tracing::info!(
        "  Validation loss: {:.6}",
        metrics.val_loss.unwrap_or(0.0)
    );
    tracing::info!("  Learning rate: {:.2e}", metrics.learning_rate);
    tracing::info!("  Final epoch time: {:.2}s", metrics.epoch_time_seconds);

    // Get training history
    let history = trainer.metrics_history();
    tracing::info!("Training history ({} epochs):", history.len());

    // Show improvement over training
    if let (Some(first), Some(last)) = (history.first(), history.last()) {
        let train_improvement = (first.train_loss - last.train_loss) / first.train_loss * 100.0;
        tracing::info!("  Train loss improvement: {:.1}%", train_improvement);

        if let (Some(first_val), Some(last_val)) = (first.val_loss, last.val_loss) {
            let val_improvement = (first_val - last_val) / first_val * 100.0;
            tracing::info!("  Validation loss improvement: {:.1}%", val_improvement);
        }
    }

    // Save trained model
    tracing::info!("Saving model...");
    trainer.save_model("models/nhits_advanced.safetensors")?;

    tracing::info!("Model saved successfully!");
    tracing::info!("Checkpoint directory: checkpoints/advanced");
    tracing::info!("Model file: models/nhits_advanced.safetensors");

    // Clean up temporary files
    std::fs::remove_file("train_data.parquet")?;

    Ok(())
}

/// Create synthetic time series data with multiple patterns
fn create_synthetic_data(n: usize) -> Result<DataFrame, PolarsError> {
    use std::f64::consts::PI;

    let timestamps: Vec<String> = (0..n)
        .map(|i| {
            let days = i / 24;
            let hours = i % 24;
            format!("2024-{:02}-{:02} {:02}:00:00",
                (days / 30) % 12 + 1,
                (days % 30) + 1,
                hours
            )
        })
        .collect();

    let values: Vec<f64> = (0..n)
        .map(|i| {
            let t = i as f64;

            // Multiple seasonal components
            let daily = 10.0 * (t * 2.0 * PI / 24.0).sin();
            let weekly = 5.0 * (t * 2.0 * PI / (24.0 * 7.0)).sin();
            let trend = 0.01 * t;
            let noise = rand::random::<f64>() * 2.0 - 1.0;

            100.0 + daily + weekly + trend + noise
        })
        .collect();

    let feature1: Vec<f64> = values
        .iter()
        .map(|v| v * 1.1 + rand::random::<f64>())
        .collect();

    let feature2: Vec<f64> = values
        .iter()
        .map(|v| v * 0.9 + rand::random::<f64>())
        .collect();

    df!(
        "timestamp" => timestamps,
        "value" => values,
        "feature1" => feature1,
        "feature2" => feature2
    )
}

//! NHITS model training example
//!
//! This example demonstrates how to train an NHITS model for time series forecasting.

use anyhow::Result;
use nt_neural::{
    NHITSConfig, NHITSModel, Trainer, TrainingConfig,
    utils::{preprocessing::*, features::*, metrics::EvaluationMetrics},
};

#[cfg(feature = "candle")]
#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    tracing::info!("Starting NHITS training example");

    // 1. Load and preprocess data
    let raw_prices = load_sample_data()?;
    tracing::info!("Loaded {} price points", raw_prices.len());

    // 2. Preprocess
    let clean = remove_outliers(&raw_prices, 3.0);
    let (normalized, norm_params) = normalize(&clean);

    // 3. Create features
    let features = create_lags(&normalized, &[1, 3, 7, 14, 21]);
    tracing::info!("Created {} feature rows", features.len());

    // 4. Split data
    let split_idx = (features.len() as f32 * 0.8) as usize;
    let (train_data, val_data) = (
        &features[..split_idx],
        &features[split_idx..],
    );

    // 5. Configure model
    let model_config = NHITSConfig {
        input_size: 168,
        horizon: 24,
        num_stacks: 3,
        num_blocks_per_stack: vec![1, 1, 1],
        hidden_size: 512,
        pooling_sizes: vec![4, 4, 1],
        dropout: 0.1,
        ..Default::default()
    };

    // 6. Initialize model
    let model = NHITSModel::new(model_config)?;
    tracing::info!("Model initialized with {} parameters", model.num_parameters());

    // 7. Configure training
    let train_config = TrainingConfig {
        batch_size: 32,
        num_epochs: 100,
        learning_rate: 1e-3,
        weight_decay: 1e-5,
        gradient_clip: Some(1.0),
        early_stopping_patience: 10,
        validation_split: 0.2,
        mixed_precision: true,
        ..Default::default()
    };

    // 8. Train model
    let trainer = Trainer::new(train_config);
    tracing::info!("Starting training...");

    let trained_model = trainer.train(
        &model,
        train_data,
        Some(val_data),
    ).await?;

    tracing::info!("Training completed!");

    // 9. Evaluate
    let predictions = trained_model.predict(val_data).await?;
    let actuals = extract_actuals(val_data);

    let metrics = EvaluationMetrics::calculate(&actuals, &predictions, None)?;

    println!("\n=== Evaluation Results ===");
    println!("MAE:   {:.4}", metrics.mae);
    println!("RMSE:  {:.4}", metrics.rmse);
    println!("MAPE:  {:.2}%", metrics.mape);
    println!("R²:    {:.4}", metrics.r2_score);
    println!("sMAPE: {:.2}%", metrics.smape);

    // 10. Save model
    trained_model.save_weights("models/nhits_trained.safetensors")?;
    save_norm_params(&norm_params, "models/norm_params.json")?;

    tracing::info!("Model saved successfully");

    Ok(())
}

#[cfg(not(feature = "candle"))]
fn main() {
    println!("This example requires the 'candle' feature to be enabled.");
    println!("Run with: cargo run --example train_nhits --features candle");
}

// Helper functions

fn load_sample_data() -> Result<Vec<f64>> {
    // In a real application, load from file or database
    // Here we'll generate synthetic data
    let n = 10000;
    let mut data = Vec::with_capacity(n);

    for i in 0..n {
        let t = i as f64 / 100.0;
        // Trend + seasonality + noise
        let value = 100.0
            + 0.5 * t  // Linear trend
            + 10.0 * (2.0 * std::f64::consts::PI * t / 24.0).sin()  // Daily
            + 5.0 * (2.0 * std::f64::consts::PI * t / 168.0).sin()  // Weekly
            + rand::random::<f64>() * 2.0;  // Noise

        data.push(value);
    }

    Ok(data)
}

fn save_norm_params(params: &nt_neural::utils::preprocessing::NormParams, path: &str) -> Result<()> {
    let json = serde_json::to_string_pretty(params)?;
    std::fs::write(path, json)?;
    Ok(())
}

fn extract_actuals(data: &[Vec<f64>]) -> Vec<f64> {
    // Extract target values from features
    data.iter().map(|row| row[0]).collect()
}

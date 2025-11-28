//! LSTM-Attention model training example
//!
//! This example shows how to train an LSTM with attention for sequential forecasting.

use anyhow::Result;
use nt_neural::{
    LSTMAttentionConfig, LSTMAttentionModel, Trainer, TrainingConfig,
    utils::{preprocessing::*, features::*, metrics::EvaluationMetrics},
};

#[cfg(feature = "candle")]
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    tracing::info!("LSTM-Attention Training Example");

    // 1. Load data (cryptocurrency prices, for example)
    let raw_prices = load_crypto_data()?;
    tracing::info!("Loaded {} price points", raw_prices.len());

    // 2. Comprehensive preprocessing
    let preprocessed = preprocess_pipeline(&raw_prices)?;

    // 3. Create sequential features
    let features = create_sequential_features(&preprocessed)?;
    tracing::info!("Created {} sequential samples", features.len());

    // 4. Train/validation split (80/20)
    let split_idx = (features.len() as f32 * 0.8) as usize;
    let (train_data, val_data) = (
        &features[..split_idx],
        &features[split_idx..],
    );

    // 5. Configure LSTM-Attention model
    let model_config = LSTMAttentionConfig {
        input_size: 168,         // 1 week of hourly data
        horizon: 24,             // Predict next 24 hours
        hidden_size: 256,        // LSTM hidden size
        num_layers: 3,           // 3 LSTM layers
        num_attention_heads: 8,  // 8 attention heads
        dropout: 0.2,
        bidirectional: true,     // Use bidirectional LSTM
        ..Default::default()
    };

    let model = LSTMAttentionModel::new(model_config)?;
    tracing::info!("LSTM-Attention model: {} parameters", model.num_parameters());

    // 6. Training configuration with LR scheduling
    let train_config = TrainingConfig {
        batch_size: 32,
        num_epochs: 150,
        learning_rate: 1e-3,
        weight_decay: 1e-5,
        gradient_clip: Some(1.0),  // Important for RNNs!
        early_stopping_patience: 15,
        validation_split: 0.2,
        mixed_precision: true,

        // Use learning rate scheduler
        lr_scheduler: Some(LRScheduler::ReduceLROnPlateau {
            patience: 5,
            factor: 0.5,
            min_lr: 1e-6,
        }),

        ..Default::default()
    };

    // 7. Initialize trainer with callbacks
    let mut trainer = Trainer::new(train_config);

    // Add checkpoint callback
    trainer.add_callback(TrainingCallback::Checkpoint {
        save_dir: "./checkpoints".into(),
        save_best_only: true,
        monitor: "val_loss".to_string(),
    });

    // Add TensorBoard logging
    trainer.add_callback(TrainingCallback::TensorBoard {
        log_dir: "./logs/lstm_training".into(),
        update_freq: 100,
    });

    // 8. Train
    tracing::info!("Starting training...");
    let trained_model = trainer.train(
        &model,
        train_data,
        Some(val_data),
    ).await?;

    // 9. Comprehensive evaluation
    println!("\n=== Final Evaluation ===");
    let predictions = trained_model.predict(val_data).await?;
    let actuals = extract_targets(val_data);

    let metrics = EvaluationMetrics::calculate(&actuals, &predictions, None)?;
    println!("MAE:                    {:.4}", metrics.mae);
    println!("RMSE:                   {:.4}", metrics.rmse);
    println!("MAPE:                   {:.2}%", metrics.mape);
    println!("R²:                     {:.4}", metrics.r2_score);

    let dir_acc = nt_neural::utils::metrics::directional_accuracy(&actuals, &predictions);
    println!("Directional Accuracy:   {:.2}%", dir_acc * 100.0);

    // 10. Save model and preprocessing info
    trained_model.save_weights("models/lstm_attention.safetensors")?;
    save_preprocessing_info("models/lstm_preprocessing.json")?;

    tracing::info!("Training completed successfully!");

    Ok(())
}

#[cfg(not(feature = "candle"))]
fn main() {
    println!("This example requires the 'candle' feature.");
    println!("Run with: cargo run --example train_lstm --features candle");
}

// Helper functions

fn load_crypto_data() -> Result<Vec<f64>> {
    // Simulate loading cryptocurrency price data
    // In production, load from exchange API or database
    let n = 8760; // 1 year of hourly data

    let mut prices = Vec::with_capacity(n);
    let mut price = 50000.0; // Starting price

    for i in 0..n {
        let t = i as f64 / 24.0; // Days

        // Random walk with drift
        let drift = 0.0001;
        let volatility = 0.02;
        let shock = rand::random::<f64>() - 0.5;

        price *= 1.0 + drift + volatility * shock;

        // Add daily seasonality
        price += 500.0 * (2.0 * std::f64::consts::PI * t).sin();

        prices.push(price);
    }

    Ok(prices)
}

fn preprocess_pipeline(data: &[f64]) -> Result<Vec<f64>> {
    // 1. Remove outliers
    let clean = remove_outliers(data, 3.0);

    // 2. Detrend
    let (detrended, _, _) = detrend(&clean);

    // 3. Normalize
    let (normalized, _) = normalize(&detrended);

    Ok(normalized)
}

fn create_sequential_features(data: &[f64]) -> Result<Vec<Vec<f64>>> {
    // Create features with lags and rolling statistics
    let lags = create_lags(data, &[1, 2, 3, 6, 12, 24]);

    let ma_short = rolling_mean(data, 24);
    let ma_long = rolling_mean(data, 168);
    let std_short = rolling_std(data, 24);

    // Combine features
    let mut features = Vec::new();
    for (i, lag_row) in lags.iter().enumerate() {
        let mut row = lag_row.clone();
        row.push(ma_short[i]);
        row.push(ma_long[i]);
        row.push(std_short[i]);
        features.push(row);
    }

    Ok(features)
}

fn extract_targets(data: &[Vec<f64>]) -> Vec<f64> {
    data.iter().map(|row| row[0]).collect()
}

fn save_preprocessing_info(path: &str) -> Result<()> {
    let info = serde_json::json!({
        "preprocessing": {
            "outlier_removal": {
                "method": "z-score",
                "threshold": 3.0
            },
            "detrending": true,
            "normalization": {
                "method": "standard",
                "mean": 0.0,
                "std": 1.0
            }
        },
        "features": {
            "lags": [1, 2, 3, 6, 12, 24],
            "rolling_windows": [24, 168]
        }
    });

    std::fs::write(path, serde_json::to_string_pretty(&info)?)?;
    Ok(())
}

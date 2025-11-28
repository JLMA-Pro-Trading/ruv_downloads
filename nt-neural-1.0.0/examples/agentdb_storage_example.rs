//! AgentDB model storage example
//!
//! Shows how to use AgentDB for persistent model storage with metadata and versioning.

use anyhow::Result;
use nt_neural::{
    NHITSModel, NHITSConfig,
    storage::{AgentDbStorage, ModelMetadata, SearchFilter},
};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    tracing::info!("AgentDB Storage Example");

    // 1. Initialize AgentDB storage
    let storage = AgentDbStorage::new("./data/models/agentdb.db").await?;
    tracing::info!("AgentDB initialized");

    // 2. Create a model
    let config = NHITSConfig {
        input_size: 168,
        horizon: 24,
        hidden_size: 512,
        ..Default::default()
    };

    #[cfg(feature = "candle")]
    let model = NHITSModel::new(config)?;

    // 3. Create comprehensive metadata
    let metadata = ModelMetadata {
        name: "btc-hourly-predictor-v1".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),

        description: Some(
            "Bitcoin hourly price predictor. Trained on 2 years of Binance data. \
             Optimized for 24-hour forecast horizon."
                .to_string()
        ),

        tags: vec![
            "production".to_string(),
            "crypto".to_string(),
            "btc".to_string(),
            "hourly".to_string(),
            "high-accuracy".to_string(),
        ],

        hyperparameters: Some(serde_json::json!({
            "input_size": 168,
            "horizon": 24,
            "num_stacks": 3,
            "hidden_size": 512,
            "pooling_sizes": [4, 4, 1],
            "dropout": 0.1,
        })),

        training_config: Some(serde_json::json!({
            "batch_size": 32,
            "num_epochs": 100,
            "learning_rate": 0.001,
            "optimizer": "Adam",
            "early_stopping": true,
        })),

        metrics: Some(serde_json::json!({
            "val_loss": 0.0234,
            "mae": 124.5,
            "rmse": 186.2,
            "r2_score": 0.89,
            "directional_accuracy": 0.583,
        })),

        dataset_info: Some(serde_json::json!({
            "source": "Binance",
            "symbol": "BTC/USD",
            "timeframe": "1h",
            "samples": 17520,
            "date_range": "2022-01-01 to 2024-01-01",
        })),

        hardware: Some(serde_json::json!({
            "gpu": "NVIDIA RTX 4090",
            "training_time_hours": 2.5,
        })),

        ..Default::default()
    };

    // 4. Serialize model
    #[cfg(feature = "candle")]
    let model_bytes = model.to_safetensors()?;

    #[cfg(not(feature = "candle"))]
    let model_bytes = vec![1, 2, 3, 4, 5]; // Dummy data for demo

    // 5. Save to AgentDB
    tracing::info!("Saving model to AgentDB...");
    let model_id = storage.save_model(&model_bytes, metadata).await?;

    println!("\n✅ Model saved successfully!");
    println!("Model ID: {}", model_id);

    // 6. Load model back
    tracing::info!("Loading model from AgentDB...");
    let loaded_bytes = storage.load_model(&model_id).await?;
    let loaded_metadata = storage.get_metadata(&model_id).await?;

    println!("\n📦 Loaded Model:");
    println!("  Name: {}", loaded_metadata.name);
    println!("  Type: {}", loaded_metadata.model_type);
    println!("  Version: {}", loaded_metadata.version);
    println!("  Size: {} bytes", loaded_bytes.len());

    if let Some(metrics) = &loaded_metadata.metrics {
        println!("\n📊 Metrics:");
        if let Some(mae) = metrics.get("mae") {
            println!("  MAE: {}", mae);
        }
        if let Some(r2) = metrics.get("r2_score") {
            println!("  R²: {}", r2);
        }
    }

    // 7. List all models
    println!("\n📋 All Models:");
    let all_models = storage.list_models(None).await?;
    for meta in &all_models {
        println!("  - {} ({})", meta.name, meta.version);
    }

    // 8. Search with filters
    println!("\n🔍 Searching for production crypto models...");
    let filter = SearchFilter {
        model_type: Some("NHITS".to_string()),
        tags: Some(vec!["production".to_string(), "crypto".to_string()]),
        ..Default::default()
    };

    let filtered_models = storage.list_models(Some(filter)).await?;
    println!("Found {} matching models", filtered_models.len());
    for meta in &filtered_models {
        println!("  - {}", meta.name);
        if let Some(metrics) = &meta.metrics {
            if let Some(val_loss) = metrics.get("val_loss") {
                println!("    Val Loss: {}", val_loss);
            }
        }
    }

    // 9. Get database statistics
    let stats = storage.get_stats().await?;
    println!("\n📈 Database Stats:");
    println!("{}", serde_json::to_string_pretty(&stats)?);

    Ok(())
}

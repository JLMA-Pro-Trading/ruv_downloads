//! Basic example of using AgentDB storage for neural network models
//!
//! This example demonstrates:
//! - Initializing AgentDB storage
//! - Saving and loading models
//! - Managing model metadata
//! - Searching for similar models
//!
//! Run with: cargo run --example agentdb_basic

use nt_neural::storage::{AgentDbStorage, AgentDbConfig, ModelMetadata};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    println!("🚀 AgentDB Storage Example\n");

    // Configure AgentDB storage
    let config = AgentDbConfig {
        db_path: "./data/models/example-agentdb.db".into(),
        dimension: 768,
        preset: "medium".to_string(),
        in_memory: false,
    };

    println!("📦 Initializing AgentDB storage at: {}", config.db_path.display());
    let storage = AgentDbStorage::with_config(config).await?;
    println!("✅ AgentDB initialized successfully\n");

    // Create a dummy model (in practice, this would be actual model weights)
    let model_bytes = vec![0u8; 1024]; // 1KB dummy model

    // Create rich metadata
    let metadata = ModelMetadata {
        name: "bitcoin-price-predictor".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),
        description: Some("Neural network model for predicting Bitcoin prices using NHITS architecture".to_string()),
        tags: vec![
            "crypto".to_string(),
            "bitcoin".to_string(),
            "time-series".to_string(),
            "nhits".to_string(),
        ],
        metrics: Some(nt_neural::storage::types::TrainingMetrics {
            train_loss: 0.0234,
            val_loss: 0.0267,
            training_time: 3600.0,
            epochs: 100,
            best_val_loss: Some(0.0245),
            additional: [
                ("mse".to_string(), 0.045),
                ("mae".to_string(), 0.123),
                ("r2_score".to_string(), 0.892),
            ]
            .into_iter()
            .collect(),
        }),
        architecture: Some(nt_neural::storage::types::ArchitectureInfo {
            input_size: 168,
            output_size: 24,
            hidden_size: 512,
            num_layers: 3,
            num_parameters: Some(2_456_789),
            details: Default::default(),
        }),
        ..Default::default()
    };

    // Save the model
    println!("💾 Saving model: {}", metadata.name);
    let model_id = storage.save_model(&model_bytes, metadata.clone()).await?;
    println!("✅ Model saved with ID: {}\n", model_id);

    // Load the model back
    println!("📥 Loading model: {}", model_id);
    let loaded_bytes = storage.load_model(&model_id).await?;
    println!("✅ Model loaded, size: {} bytes\n", loaded_bytes.len());

    // Get model metadata
    println!("📊 Retrieving model metadata...");
    let loaded_metadata = storage.get_metadata(&model_id).await?;
    println!("  Name: {}", loaded_metadata.name);
    println!("  Type: {}", loaded_metadata.model_type);
    println!("  Version: {}", loaded_metadata.version);
    println!("  Tags: {:?}", loaded_metadata.tags);

    if let Some(metrics) = &loaded_metadata.metrics {
        println!("  Training Loss: {:.4}", metrics.train_loss);
        println!("  Validation Loss: {:.4}", metrics.val_loss);
        println!("  Epochs: {}", metrics.epochs);
    }

    if let Some(arch) = &loaded_metadata.architecture {
        println!("  Input Size: {}", arch.input_size);
        println!("  Output Size: {}", arch.output_size);
        println!("  Parameters: {}", arch.num_parameters.unwrap_or(0));
    }
    println!();

    // List all models
    println!("📋 Listing all models...");
    let all_models = storage.list_models(None).await?;
    println!("  Found {} model(s)\n", all_models.len());

    for (i, model) in all_models.iter().enumerate() {
        println!("  {}. {} ({})", i + 1, model.name, model.model_type);
    }
    println!();

    // Get database statistics
    println!("📊 Database Statistics:");
    let stats = storage.get_stats().await?;
    println!("{}\n", serde_json::to_string_pretty(&stats)?);

    println!("✅ Example completed successfully!");

    Ok(())
}

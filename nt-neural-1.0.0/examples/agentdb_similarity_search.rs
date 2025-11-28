//! Advanced example demonstrating vector similarity search with AgentDB
//!
//! This example shows:
//! - Storing multiple models with embeddings
//! - Searching for similar models by features
//! - Using different similarity metrics
//! - Managing model collections
//!
//! Run with: cargo run --example agentdb_similarity_search

use nt_neural::storage::{
    AgentDbStorage, AgentDbConfig, ModelMetadata, SimilarityMetric, SearchFilter
};
use std::collections::HashMap;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    println!("🔍 AgentDB Similarity Search Example\n");

    // Initialize storage
    let config = AgentDbConfig {
        db_path: "./data/models/similarity-example.db".into(),
        dimension: 384, // Using smaller dimension for example
        preset: "small".to_string(),
        in_memory: false,
    };

    println!("📦 Initializing AgentDB...");
    let storage = AgentDbStorage::with_config(config).await?;
    println!("✅ Ready\n");

    // Create a collection of diverse models
    let models = vec![
        (
            "btc-lstm-1h",
            "LSTM-Attention",
            vec!["crypto", "bitcoin", "hourly", "lstm"],
            "Bitcoin 1-hour price prediction using LSTM with attention",
        ),
        (
            "btc-nhits-24h",
            "NHITS",
            vec!["crypto", "bitcoin", "daily", "nhits"],
            "Bitcoin 24-hour forecast with NHITS architecture",
        ),
        (
            "eth-transformer-1h",
            "Transformer",
            vec!["crypto", "ethereum", "hourly", "transformer"],
            "Ethereum hourly price forecasting with transformers",
        ),
        (
            "spy-lstm-daily",
            "LSTM-Attention",
            vec!["stocks", "spy", "daily", "lstm"],
            "S&P 500 daily price prediction with LSTM",
        ),
        (
            "gold-nhits-weekly",
            "NHITS",
            vec!["commodities", "gold", "weekly", "nhits"],
            "Gold weekly price forecast using NHITS",
        ),
    ];

    println!("💾 Saving {} models to AgentDB...", models.len());
    let mut model_ids = Vec::new();

    for (name, model_type, tags, description) in &models {
        let model_bytes = vec![0u8; 512]; // Dummy model data

        let metadata = ModelMetadata {
            name: name.to_string(),
            model_type: model_type.to_string(),
            version: "1.0.0".to_string(),
            description: Some(description.to_string()),
            tags: tags.iter().map(|t| t.to_string()).collect(),
            metrics: Some(nt_neural::storage::types::TrainingMetrics {
                train_loss: 0.02 + (rand::random::<f64>() * 0.01),
                val_loss: 0.03 + (rand::random::<f64>() * 0.01),
                training_time: 1800.0,
                epochs: 50,
                best_val_loss: None,
                additional: HashMap::new(),
            }),
            ..Default::default()
        };

        let model_id = storage.save_model(&model_bytes, metadata).await?;
        model_ids.push((name.to_string(), model_id));
        println!("  ✓ Saved: {}", name);
    }
    println!();

    // Example 1: Find models similar to Bitcoin models
    println!("🔍 Example 1: Finding models similar to Bitcoin predictions");
    println!("  Query: Looking for models related to Bitcoin crypto trading\n");

    // Create a query embedding (in production, this would come from an embedding model)
    let query_embedding: Vec<f32> = (0..384)
        .map(|i| {
            let v = (i as f32) / 384.0;
            if i % 10 == 0 { v * 2.0 } else { v }
        })
        .collect();

    let similar_models = storage
        .search_similar_models(&query_embedding, 3)
        .await?;

    println!("  Top 3 Similar Models:");
    for (i, result) in similar_models.iter().enumerate() {
        println!("    {}. {} (score: {:.4})", i + 1, result.metadata.name, result.score);
        println!("       Type: {}, Tags: {:?}", result.metadata.model_type, result.metadata.tags);
    }
    println!();

    // Example 2: Filter by model type
    println!("🔍 Example 2: Filtering models by type");
    let filter = SearchFilter {
        model_type: Some("NHITS".to_string()),
        ..Default::default()
    };

    let nhits_models = storage.list_models(Some(filter)).await?;
    println!("  Found {} NHITS models:", nhits_models.len());
    for model in &nhits_models {
        println!("    - {} ({})", model.name, model.description.as_deref().unwrap_or(""));
    }
    println!();

    // Example 3: Search with different metrics
    println!("🔍 Example 3: Comparing similarity metrics");

    for metric in &[SimilarityMetric::Cosine, SimilarityMetric::Euclidean, SimilarityMetric::Dot] {
        let results = storage
            .search_similar_models_with_metric(&query_embedding, 2, *metric)
            .await?;

        println!("  Metric: {:?}", metric);
        for (i, result) in results.iter().enumerate() {
            println!("    {}. {} (score: {:.4})", i + 1, result.metadata.name, result.score);
        }
    }
    println!();

    // Example 4: Filter by tags
    println!("🔍 Example 4: Finding models with specific tags");
    let filter = SearchFilter {
        tags: Some(vec!["crypto".to_string(), "hourly".to_string()]),
        ..Default::default()
    };

    let tagged_models = storage.list_models(Some(filter)).await?;
    println!("  Found {} models with 'crypto' or 'hourly' tags:", tagged_models.len());
    for model in &tagged_models {
        println!("    - {}: {:?}", model.name, model.tags);
    }
    println!();

    // Show final statistics
    println!("📊 Final Statistics:");
    let stats = storage.get_stats().await?;
    println!("{}", serde_json::to_string_pretty(&stats)?);

    println!("\n✅ Similarity search example completed!");

    Ok(())
}

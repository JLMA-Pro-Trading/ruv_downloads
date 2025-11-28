//! Inference example
//!
//! Demonstrates loading a trained model and making predictions.

use anyhow::Result;
use nt_neural::{
    NHITSModel, Predictor, PredictionResult,
    storage::AgentDbStorage,
    utils::preprocessing::*,
};

#[cfg(feature = "candle")]
#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();

    tracing::info!("Neural Model Inference Example");

    // 1. Load model from AgentDB
    let storage = AgentDbStorage::new("./data/models/agentdb.db").await?;
    let model_id = "your-model-id"; // Replace with actual ID

    tracing::info!("Loading model: {}", model_id);
    let model_bytes = storage.load_model(model_id).await?;
    let metadata = storage.get_metadata(model_id).await?;

    println!("Model: {}", metadata.name);
    println!("Type: {}", metadata.model_type);
    println!("Version: {}", metadata.version);

    // 2. Deserialize model
    let model = NHITSModel::from_safetensors(&model_bytes)?;

    // 3. Load normalization parameters
    let norm_params: NormParams = serde_json::from_str(
        &std::fs::read_to_string("models/norm_params.json")?
    )?;

    // 4. Create predictor
    let predictor = Predictor::new(model)?;

    // 5. Get recent data for prediction
    let recent_prices = get_recent_prices(168).await?; // Last 168 hours

    // 6. Preprocess input
    let normalized = normalize_with_params(&recent_prices, &norm_params);

    // 7. Make prediction
    tracing::info!("Making prediction...");
    let start = std::time::Instant::now();

    let result: PredictionResult = predictor.predict(&normalized).await?;

    let elapsed = start.elapsed();
    println!("\n=== Prediction Results ===");
    println!("Inference time: {:.2}ms", elapsed.as_secs_f64() * 1000.0);

    // 8. Denormalize predictions
    let predictions = denormalize(&result.values, &norm_params);

    println!("\nNext 24 hours forecast:");
    for (i, &pred) in predictions.iter().enumerate() {
        println!("  Hour {}: ${:.2}", i + 1, pred);
    }

    // 9. If available, show confidence intervals
    if let Some((lower, upper)) = result.intervals {
        let lower_denorm = denormalize(&lower, &norm_params);
        let upper_denorm = denormalize(&upper, &norm_params);

        println!("\n80% Confidence Intervals:");
        for i in 0..3 {
            println!(
                "  Hour {}: ${:.2} - ${:.2}",
                i + 1,
                lower_denorm[i],
                upper_denorm[i]
            );
        }
    }

    // 10. Show prediction confidence
    if let Some(confidence) = result.confidence {
        println!("\nPrediction confidence: {:.1}%", confidence * 100.0);
    }

    Ok(())
}

#[cfg(not(feature = "candle"))]
fn main() {
    println!("This example requires the 'candle' feature.");
    println!("Run with: cargo run --example inference_example --features candle");
}

// Helper functions

async fn get_recent_prices(n: usize) -> Result<Vec<f64>> {
    // In production, fetch from database or API
    // Here we'll simulate recent data
    let mut prices = Vec::with_capacity(n);
    let mut price = 50000.0;

    for _ in 0..n {
        price += (rand::random::<f64>() - 0.5) * 100.0;
        prices.push(price);
    }

    Ok(prices)
}

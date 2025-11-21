//! Integration tests for AgentDB storage
//!
//! These tests require `npx agentdb` to be installed.
//! Run with: cargo test --package nt-neural --test storage_integration_test -- --ignored

use nt_neural::storage::{AgentDbStorage, AgentDbConfig, ModelMetadata, ModelCheckpoint, SearchFilter};
use std::collections::HashMap;

#[tokio::test]
#[ignore] // Requires npx agentdb
async fn test_storage_initialization() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config).await;
    assert!(storage.is_ok(), "Failed to initialize AgentDB storage");
}

#[tokio::test]
#[ignore]
async fn test_model_save_and_load() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Create test model data
    let model_bytes = vec![1, 2, 3, 4, 5, 6, 7, 8];

    let metadata = ModelMetadata {
        name: "test-nhits-model".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),
        description: Some("Test model for integration testing".to_string()),
        tags: vec!["test".to_string(), "nhits".to_string()],
        ..Default::default()
    };

    // Save model
    let model_id = storage
        .save_model(&model_bytes, metadata.clone())
        .await
        .expect("Failed to save model");

    assert!(!model_id.is_empty(), "Model ID should not be empty");

    // Load model
    let loaded_bytes = storage
        .load_model(&model_id)
        .await
        .expect("Failed to load model");

    assert_eq!(model_bytes, loaded_bytes, "Loaded model bytes should match original");

    // Get metadata
    let loaded_metadata = storage
        .get_metadata(&model_id)
        .await
        .expect("Failed to get metadata");

    assert_eq!(metadata.name, loaded_metadata.name);
    assert_eq!(metadata.model_type, loaded_metadata.model_type);
}

#[tokio::test]
#[ignore]
async fn test_model_versioning() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Save multiple versions of the same model
    for version in &["1.0.0", "1.1.0", "2.0.0"] {
        let model_bytes = version.as_bytes().to_vec();
        let metadata = ModelMetadata {
            name: "versioned-model".to_string(),
            model_type: "LSTM-Attention".to_string(),
            version: version.to_string(),
            ..Default::default()
        };

        storage
            .save_model(&model_bytes, metadata)
            .await
            .expect("Failed to save model version");
    }

    // List all models
    let models = storage
        .list_models(None)
        .await
        .expect("Failed to list models");

    assert_eq!(models.len(), 3, "Should have 3 model versions");
}

#[tokio::test]
#[ignore]
async fn test_model_filtering() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Save models of different types
    for model_type in &["NHITS", "LSTM-Attention", "Transformer"] {
        let model_bytes = vec![1, 2, 3];
        let metadata = ModelMetadata {
            name: format!("{}-model", model_type.to_lowercase()),
            model_type: model_type.to_string(),
            version: "1.0.0".to_string(),
            ..Default::default()
        };

        storage
            .save_model(&model_bytes, metadata)
            .await
            .expect("Failed to save model");
    }

    // Filter by model type
    let filter = SearchFilter {
        model_type: Some("NHITS".to_string()),
        ..Default::default()
    };

    let filtered_models = storage
        .list_models(Some(filter))
        .await
        .expect("Failed to list filtered models");

    assert_eq!(filtered_models.len(), 1, "Should find exactly 1 NHITS model");
    assert_eq!(filtered_models[0].model_type, "NHITS");
}

#[tokio::test]
#[ignore]
async fn test_checkpoint_management() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Save a model first
    let model_bytes = vec![1, 2, 3];
    let metadata = ModelMetadata {
        name: "checkpoint-test-model".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),
        ..Default::default()
    };

    let model_id = storage
        .save_model(&model_bytes, metadata)
        .await
        .expect("Failed to save model");

    // Create checkpoint
    let checkpoint = ModelCheckpoint {
        checkpoint_id: uuid::Uuid::new_v4().to_string(),
        model_id: model_id.clone(),
        epoch: 10,
        step: 1000,
        loss: 0.123,
        val_loss: Some(0.145),
        optimizer_state: Some(serde_json::json!({"lr": 0.001})),
        created_at: chrono::Utc::now(),
    };

    let checkpoint_bytes = vec![4, 5, 6, 7, 8];

    // Save checkpoint
    let checkpoint_id = storage
        .save_checkpoint(&model_id, checkpoint.clone(), &checkpoint_bytes)
        .await
        .expect("Failed to save checkpoint");

    assert_eq!(checkpoint_id, checkpoint.checkpoint_id);

    // Load checkpoint
    let (loaded_checkpoint, loaded_bytes) = storage
        .load_checkpoint(&checkpoint_id)
        .await
        .expect("Failed to load checkpoint");

    assert_eq!(loaded_checkpoint.epoch, checkpoint.epoch);
    assert_eq!(loaded_checkpoint.step, checkpoint.step);
    assert_eq!(loaded_bytes, checkpoint_bytes);
}

#[tokio::test]
#[ignore]
async fn test_vector_similarity_search() {
    let config = AgentDbConfig {
        in_memory: true,
        dimension: 128, // Smaller dimension for testing
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Save multiple models with different metadata
    let models = vec![
        ("bitcoin-predictor", vec!["crypto", "btc", "prediction"]),
        ("ethereum-forecaster", vec!["crypto", "eth", "forecast"]),
        ("stock-analyzer", vec!["stocks", "spy", "analysis"]),
    ];

    for (name, tags) in models {
        let model_bytes = vec![1, 2, 3];
        let metadata = ModelMetadata {
            name: name.to_string(),
            model_type: "NHITS".to_string(),
            version: "1.0.0".to_string(),
            tags,
            ..Default::default()
        };

        storage
            .save_model(&model_bytes, metadata)
            .await
            .expect("Failed to save model");
    }

    // Create a query embedding (random for testing)
    let query_embedding: Vec<f32> = (0..128).map(|i| (i as f32) / 128.0).collect();

    // Search for similar models
    let results = storage
        .search_similar_models(&query_embedding, 3)
        .await
        .expect("Failed to search similar models");

    assert!(!results.is_empty(), "Should find at least one similar model");

    // Results should be ordered by similarity score
    for i in 1..results.len() {
        assert!(
            results[i - 1].score >= results[i].score,
            "Results should be ordered by descending similarity score"
        );
    }
}

#[tokio::test]
#[ignore]
async fn test_database_stats() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Get stats
    let stats = storage
        .get_stats()
        .await
        .expect("Failed to get stats");

    // Stats should contain some basic information
    assert!(stats.is_object(), "Stats should be a JSON object");
}

#[tokio::test]
#[ignore]
async fn test_model_with_metrics() {
    let config = AgentDbConfig {
        in_memory: true,
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    let model_bytes = vec![1, 2, 3];

    let mut additional_metrics = HashMap::new();
    additional_metrics.insert("mse".to_string(), 0.045);
    additional_metrics.insert("mae".to_string(), 0.123);
    additional_metrics.insert("r2".to_string(), 0.892);

    let metadata = ModelMetadata {
        name: "metrics-test-model".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),
        metrics: Some(nt_neural::storage::types::TrainingMetrics {
            train_loss: 0.234,
            val_loss: 0.267,
            training_time: 3600.0,
            epochs: 50,
            best_val_loss: Some(0.245),
            additional: additional_metrics,
        }),
        ..Default::default()
    };

    let model_id = storage
        .save_model(&model_bytes, metadata.clone())
        .await
        .expect("Failed to save model with metrics");

    let loaded_metadata = storage
        .get_metadata(&model_id)
        .await
        .expect("Failed to get metadata");

    assert!(loaded_metadata.metrics.is_some(), "Metrics should be preserved");
    let metrics = loaded_metadata.metrics.unwrap();
    assert_eq!(metrics.epochs, 50);
    assert_eq!(metrics.additional.len(), 3);
}

#[tokio::test]
#[ignore]
async fn test_export_and_import() {
    let temp_dir = tempfile::tempdir().expect("Failed to create temp dir");
    let export_path = temp_dir.path().join("export.json");

    let config = AgentDbConfig {
        in_memory: false,
        db_path: temp_dir.path().join("test.db"),
        ..Default::default()
    };

    let storage = AgentDbStorage::with_config(config)
        .await
        .expect("Failed to create storage");

    // Save a model
    let model_bytes = vec![1, 2, 3];
    let metadata = ModelMetadata {
        name: "export-test-model".to_string(),
        model_type: "NHITS".to_string(),
        version: "1.0.0".to_string(),
        ..Default::default()
    };

    storage
        .save_model(&model_bytes, metadata)
        .await
        .expect("Failed to save model");

    // Export database
    storage
        .export(&export_path, false)
        .await
        .expect("Failed to export database");

    assert!(export_path.exists(), "Export file should exist");
}

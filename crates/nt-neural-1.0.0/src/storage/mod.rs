//! Model storage and retrieval integration with AgentDB
//!
//! This module provides seamless integration with AgentDB for storing,
//! versioning, and retrieving neural network models with vector similarity search.
//!
//! # Features
//!
//! - **Model Storage**: Persistent storage of trained models with metadata
//! - **Vector Embeddings**: Similarity search for finding related models
//! - **Versioning**: Track model versions and evolution
//! - **Checkpointing**: Save and restore training checkpoints
//! - **Metadata**: Rich metadata including training metrics and configuration
//!
//! # Example
//!
//! ```no_run
//! use nt_neural::storage::{AgentDbStorage, ModelMetadata};
//!
//! # async fn example() -> anyhow::Result<()> {
//! // Initialize AgentDB storage
//! let storage = AgentDbStorage::new("./data/models/agentdb.db").await?;
//!
//! // Save a model
//! let model_id = storage.save_model(
//!     &model_bytes,
//!     ModelMetadata {
//!         name: "nhits-btc-24h".to_string(),
//!         model_type: "NHITS".to_string(),
//!         version: "1.0.0".to_string(),
//!         ..Default::default()
//!     }
//! ).await?;
//!
//! // Load the model back
//! let model = storage.load_model(&model_id).await?;
//!
//! // Search for similar models
//! let similar = storage.search_similar_models(&embedding, 5).await?;
//! # Ok(())
//! # }
//! ```

pub mod agentdb;
pub mod types;

pub use agentdb::{AgentDbStorage, AgentDbConfig};
pub use types::{
    ModelMetadata, ModelCheckpoint, ModelId,
    SearchFilter, SimilarityMetric
};

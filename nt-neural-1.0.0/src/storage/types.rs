//! Type definitions for model storage

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unique identifier for a stored model
pub type ModelId = String;

/// Model metadata for storage and retrieval
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    /// Human-readable model name
    pub name: String,

    /// Model type (NHITS, LSTM-Attention, Transformer, etc.)
    pub model_type: String,

    /// Model version (semantic versioning)
    pub version: String,

    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Training configuration as JSON
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<serde_json::Value>,

    /// Training metrics
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metrics: Option<TrainingMetrics>,

    /// Model architecture details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub architecture: Option<ArchitectureInfo>,

    /// Custom tags for categorization
    #[serde(default)]
    pub tags: Vec<String>,

    /// Additional metadata
    #[serde(default)]
    pub metadata: HashMap<String, serde_json::Value>,

    /// Timestamp when model was created
    pub created_at: chrono::DateTime<chrono::Utc>,

    /// Timestamp of last update
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl Default for ModelMetadata {
    fn default() -> Self {
        Self {
            name: String::new(),
            model_type: String::new(),
            version: "1.0.0".to_string(),
            description: None,
            config: None,
            metrics: None,
            architecture: None,
            tags: Vec::new(),
            metadata: HashMap::new(),
            created_at: chrono::Utc::now(),
            updated_at: None,
        }
    }
}

/// Training metrics stored with the model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingMetrics {
    /// Final training loss
    pub train_loss: f64,

    /// Final validation loss
    pub val_loss: f64,

    /// Total training time in seconds
    pub training_time: f64,

    /// Number of epochs trained
    pub epochs: usize,

    /// Best validation loss achieved
    #[serde(skip_serializing_if = "Option::is_none")]
    pub best_val_loss: Option<f64>,

    /// Additional metrics (MSE, MAE, R2, etc.)
    #[serde(default)]
    pub additional: HashMap<String, f64>,
}

/// Model architecture information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchitectureInfo {
    /// Input size (sequence length)
    pub input_size: usize,

    /// Output size (forecast horizon)
    pub output_size: usize,

    /// Hidden layer size
    pub hidden_size: usize,

    /// Number of layers
    pub num_layers: usize,

    /// Total number of parameters
    #[serde(skip_serializing_if = "Option::is_none")]
    pub num_parameters: Option<usize>,

    /// Additional architecture details
    #[serde(default)]
    pub details: HashMap<String, serde_json::Value>,
}

/// Training checkpoint for resuming training
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCheckpoint {
    /// Unique checkpoint ID
    pub checkpoint_id: String,

    /// Associated model ID
    pub model_id: ModelId,

    /// Epoch number
    pub epoch: usize,

    /// Step/iteration number
    pub step: usize,

    /// Loss at this checkpoint
    pub loss: f64,

    /// Validation loss
    #[serde(skip_serializing_if = "Option::is_none")]
    pub val_loss: Option<f64>,

    /// Optimizer state snapshot
    #[serde(skip_serializing_if = "Option::is_none")]
    pub optimizer_state: Option<serde_json::Value>,

    /// Timestamp when checkpoint was created
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Search filter for querying models
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchFilter {
    /// Filter by model type
    #[serde(skip_serializing_if = "Option::is_none")]
    pub model_type: Option<String>,

    /// Filter by tags (any match)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,

    /// Filter by minimum validation loss
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_val_loss: Option<f64>,

    /// Filter by maximum validation loss
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_val_loss: Option<f64>,

    /// Filter by creation date (after)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_after: Option<chrono::DateTime<chrono::Utc>>,

    /// Filter by creation date (before)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_before: Option<chrono::DateTime<chrono::Utc>>,

    /// Custom metadata filters
    #[serde(default)]
    pub metadata_filters: HashMap<String, serde_json::Value>,
}

/// Similarity metrics for vector search
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub enum SimilarityMetric {
    /// Cosine similarity (default)
    #[default]
    Cosine,

    /// Euclidean distance
    Euclidean,

    /// Dot product
    Dot,
}

impl std::fmt::Display for SimilarityMetric {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Cosine => write!(f, "cosine"),
            Self::Euclidean => write!(f, "euclidean"),
            Self::Dot => write!(f, "dot"),
        }
    }
}

/// Search result with similarity score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    /// Model ID
    pub model_id: ModelId,

    /// Similarity score (higher is more similar)
    pub score: f64,

    /// Model metadata
    pub metadata: ModelMetadata,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_metadata_serialization() {
        let metadata = ModelMetadata {
            name: "test-model".to_string(),
            model_type: "NHITS".to_string(),
            version: "1.0.0".to_string(),
            description: Some("Test model".to_string()),
            tags: vec!["test".to_string(), "neural".to_string()],
            ..Default::default()
        };

        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: ModelMetadata = serde_json::from_str(&json).unwrap();

        assert_eq!(metadata.name, deserialized.name);
        assert_eq!(metadata.model_type, deserialized.model_type);
        assert_eq!(metadata.tags, deserialized.tags);
    }

    #[test]
    fn test_search_filter_default() {
        let filter = SearchFilter::default();
        assert!(filter.model_type.is_none());
        assert!(filter.tags.is_none());
        assert!(filter.min_val_loss.is_none());
    }

    #[test]
    fn test_similarity_metric_display() {
        assert_eq!(SimilarityMetric::Cosine.to_string(), "cosine");
        assert_eq!(SimilarityMetric::Euclidean.to_string(), "euclidean");
        assert_eq!(SimilarityMetric::Dot.to_string(), "dot");
    }
}

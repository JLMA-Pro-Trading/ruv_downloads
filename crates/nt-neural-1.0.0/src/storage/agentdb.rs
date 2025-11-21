//! AgentDB integration for model storage and retrieval
//!
//! This module provides async APIs for storing neural network models in AgentDB
//! with vector embeddings for similarity search, versioning, and checkpoint management.

use super::types::{
    ModelMetadata, ModelCheckpoint, ModelId, SearchFilter,
    SimilarityMetric, SearchResult
};
use crate::error::{NeuralError, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tokio::process::Command;

/// Configuration for AgentDB storage
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentDbConfig {
    /// Path to the AgentDB database file
    pub db_path: PathBuf,

    /// Vector dimension for embeddings (default: 768)
    pub dimension: usize,

    /// Database preset size (small, medium, large)
    pub preset: String,

    /// Enable in-memory database for testing
    pub in_memory: bool,
}

impl Default for AgentDbConfig {
    fn default() -> Self {
        Self {
            db_path: PathBuf::from("./data/models/agentdb.db"),
            dimension: 768,
            preset: "medium".to_string(),
            in_memory: false,
        }
    }
}

/// AgentDB storage backend for neural network models
pub struct AgentDbStorage {
    config: AgentDbConfig,
    initialized: bool,
}

impl AgentDbStorage {
    /// Create a new AgentDB storage instance
    pub async fn new(db_path: impl AsRef<Path>) -> Result<Self> {
        let config = AgentDbConfig {
            db_path: db_path.as_ref().to_path_buf(),
            ..Default::default()
        };

        let mut storage = Self {
            config,
            initialized: false,
        };

        storage.initialize().await?;
        Ok(storage)
    }

    /// Create with custom configuration
    pub async fn with_config(config: AgentDbConfig) -> Result<Self> {
        let mut storage = Self {
            config,
            initialized: false,
        };

        storage.initialize().await?;
        Ok(storage)
    }

    /// Initialize the AgentDB database
    async fn initialize(&mut self) -> Result<()> {
        if self.initialized {
            return Ok(());
        }

        // Create parent directory if it doesn't exist
        if let Some(parent) = self.config.db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let db_path = if self.config.in_memory {
            ":memory:".to_string()
        } else {
            self.config.db_path.display().to_string()
        };

        // Initialize AgentDB
        let mut cmd = Command::new("npx");
        cmd.arg("agentdb")
            .arg("init")
            .arg(&db_path)
            .arg("--dimension")
            .arg(self.config.dimension.to_string())
            .arg("--preset")
            .arg(&self.config.preset)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if self.config.in_memory {
            cmd.arg("--in-memory");
        }

        let output = cmd.output().await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(NeuralError::Storage(format!(
                "Failed to initialize AgentDB: {}",
                stderr
            )));
        }

        self.initialized = true;
        tracing::info!("AgentDB initialized at {}", db_path);
        Ok(())
    }

    /// Save a model to AgentDB
    pub async fn save_model(
        &self,
        model_bytes: &[u8],
        metadata: ModelMetadata,
    ) -> Result<ModelId> {
        self.ensure_initialized()?;

        let model_id = uuid::Uuid::new_v4().to_string();

        // Create a temporary file for the model
        let temp_dir = tempfile::tempdir()?;
        let model_path = temp_dir.path().join(format!("{}.safetensors", model_id));
        tokio::fs::write(&model_path, model_bytes).await?;

        // Generate embedding for the model metadata
        let embedding = self.generate_metadata_embedding(&metadata)?;

        // Store in AgentDB using reflexion store command
        let metadata_json = serde_json::to_string(&metadata)?;

        let output = Command::new("npx")
            .arg("agentdb")
            .arg("reflexion")
            .arg("store")
            .arg(&model_id)
            .arg(&metadata.name)
            .arg("1.0") // reward (success indicator)
            .arg("true") // success
            .arg(&metadata_json)
            .arg(&embedding)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(NeuralError::Storage(format!(
                "Failed to store model in AgentDB: {}",
                stderr
            )));
        }

        // Store the actual model file
        let storage_path = self.get_model_storage_path(&model_id);
        if let Some(parent) = storage_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::copy(&model_path, &storage_path).await?;

        tracing::info!("Model {} saved to AgentDB", model_id);
        Ok(model_id)
    }

    /// Load a model from AgentDB
    pub async fn load_model(&self, model_id: &str) -> Result<Vec<u8>> {
        self.ensure_initialized()?;

        let storage_path = self.get_model_storage_path(model_id);

        if !storage_path.exists() {
            return Err(NeuralError::Storage(format!(
                "Model {} not found",
                model_id
            )));
        }

        let model_bytes = tokio::fs::read(&storage_path).await?;
        tracing::info!("Model {} loaded from AgentDB", model_id);
        Ok(model_bytes)
    }

    /// Get model metadata
    pub async fn get_metadata(&self, model_id: &str) -> Result<ModelMetadata> {
        self.ensure_initialized()?;

        // Query AgentDB for the model metadata
        let output = Command::new("npx")
            .arg("agentdb")
            .arg("reflexion")
            .arg("retrieve")
            .arg(model_id)
            .arg("--k")
            .arg("1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(NeuralError::Storage(format!(
                "Model {} not found",
                model_id
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let episodes: Vec<serde_json::Value> = serde_json::from_str(&stdout)?;

        if let Some(episode) = episodes.first() {
            if let Some(critique) = episode.get("critique") {
                let metadata: ModelMetadata = serde_json::from_value(critique.clone())?;
                return Ok(metadata);
            }
        }

        Err(NeuralError::Storage(format!(
            "Metadata for model {} not found",
            model_id
        )))
    }

    /// List all models with optional filtering
    pub async fn list_models(&self, filter: Option<SearchFilter>) -> Result<Vec<ModelMetadata>> {
        self.ensure_initialized()?;

        // Build filter query
        let mut cmd = Command::new("npx");
        cmd.arg("agentdb")
            .arg("reflexion")
            .arg("retrieve")
            .arg("") // empty query to get all
            .arg("--k")
            .arg("1000"); // large limit

        if let Some(f) = &filter {
            if f.min_val_loss.is_some() {
                cmd.arg("--min-reward").arg(f.min_val_loss.unwrap().to_string());
            }
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let output = cmd.output().await?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let episodes: Vec<serde_json::Value> = serde_json::from_str(&stdout)?;

        let mut models = Vec::new();
        for episode in episodes {
            if let Some(critique) = episode.get("critique") {
                if let Ok(metadata) = serde_json::from_value::<ModelMetadata>(critique.clone()) {
                    // Apply additional filters
                    if let Some(f) = &filter {
                        if let Some(ref model_type) = f.model_type {
                            if &metadata.model_type != model_type {
                                continue;
                            }
                        }
                        if let Some(ref tags) = f.tags {
                            if !tags.iter().any(|t| metadata.tags.contains(t)) {
                                continue;
                            }
                        }
                    }
                    models.push(metadata);
                }
            }
        }

        Ok(models)
    }

    /// Search for similar models using vector embeddings
    pub async fn search_similar_models(
        &self,
        embedding: &[f32],
        k: usize,
    ) -> Result<Vec<SearchResult>> {
        self.search_similar_models_with_metric(embedding, k, SimilarityMetric::Cosine).await
    }

    /// Search for similar models with custom similarity metric
    pub async fn search_similar_models_with_metric(
        &self,
        embedding: &[f32],
        k: usize,
        metric: SimilarityMetric,
    ) -> Result<Vec<SearchResult>> {
        self.ensure_initialized()?;

        // Convert embedding to JSON array
        let vector_json = serde_json::to_string(embedding)?;

        let db_path = if self.config.in_memory {
            ":memory:".to_string()
        } else {
            self.config.db_path.display().to_string()
        };

        // Use AgentDB vector-search command
        let output = Command::new("npx")
            .arg("agentdb")
            .arg("vector-search")
            .arg(&db_path)
            .arg(&vector_json)
            .arg("-k")
            .arg(k.to_string())
            .arg("-m")
            .arg(metric.to_string())
            .arg("-f")
            .arg("json")
            .arg("-v") // verbose to get scores
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(NeuralError::Storage(format!(
                "Vector search failed: {}",
                stderr
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let results: Vec<serde_json::Value> = serde_json::from_str(&stdout)?;

        let mut search_results = Vec::new();
        for result in results {
            if let (Some(id), Some(score)) = (
                result.get("id").and_then(|v| v.as_str()),
                result.get("score").and_then(|v| v.as_f64()),
            ) {
                if let Ok(metadata) = self.get_metadata(id).await {
                    search_results.push(SearchResult {
                        model_id: id.to_string(),
                        score,
                        metadata,
                    });
                }
            }
        }

        Ok(search_results)
    }

    /// Save a training checkpoint
    pub async fn save_checkpoint(
        &self,
        model_id: &str,
        checkpoint: ModelCheckpoint,
        state_bytes: &[u8],
    ) -> Result<String> {
        self.ensure_initialized()?;

        let checkpoint_id = checkpoint.checkpoint_id.clone();

        // Store checkpoint metadata in AgentDB
        let checkpoint_json = serde_json::to_string(&checkpoint)?;
        let task = format!("checkpoint-{}-{}", model_id, checkpoint.epoch);

        let output = Command::new("npx")
            .arg("agentdb")
            .arg("reflexion")
            .arg("store")
            .arg(&checkpoint_id)
            .arg(&task)
            .arg(checkpoint.loss.to_string())
            .arg("true")
            .arg(&checkpoint_json)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(NeuralError::Storage(format!(
                "Failed to store checkpoint: {}",
                stderr
            )));
        }

        // Store checkpoint state file
        let checkpoint_path = self.get_checkpoint_storage_path(&checkpoint_id);
        if let Some(parent) = checkpoint_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        tokio::fs::write(&checkpoint_path, state_bytes).await?;

        tracing::info!("Checkpoint {} saved", checkpoint_id);
        Ok(checkpoint_id)
    }

    /// Load a training checkpoint
    pub async fn load_checkpoint(&self, checkpoint_id: &str) -> Result<(ModelCheckpoint, Vec<u8>)> {
        self.ensure_initialized()?;

        // Get checkpoint metadata from AgentDB
        let output = Command::new("npx")
            .arg("agentdb")
            .arg("reflexion")
            .arg("retrieve")
            .arg(checkpoint_id)
            .arg("--k")
            .arg("1")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(NeuralError::Storage(format!(
                "Checkpoint {} not found",
                checkpoint_id
            )));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let episodes: Vec<serde_json::Value> = serde_json::from_str(&stdout)?;

        let checkpoint = if let Some(episode) = episodes.first() {
            if let Some(critique) = episode.get("critique") {
                serde_json::from_value::<ModelCheckpoint>(critique.clone())?
            } else {
                return Err(NeuralError::Storage(format!(
                    "Checkpoint {} metadata not found",
                    checkpoint_id
                )));
            }
        } else {
            return Err(NeuralError::Storage(format!(
                "Checkpoint {} not found",
                checkpoint_id
            )));
        };

        // Load checkpoint state file
        let checkpoint_path = self.get_checkpoint_storage_path(checkpoint_id);
        let state_bytes = tokio::fs::read(&checkpoint_path).await?;

        Ok((checkpoint, state_bytes))
    }

    /// Get database statistics
    pub async fn get_stats(&self) -> Result<serde_json::Value> {
        self.ensure_initialized()?;

        let db_path = if self.config.in_memory {
            ":memory:".to_string()
        } else {
            self.config.db_path.display().to_string()
        };

        let output = Command::new("npx")
            .arg("agentdb")
            .arg("stats")
            .arg(&db_path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            return Err(NeuralError::Storage(
                "Failed to get AgentDB stats".to_string()
            ));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stats: serde_json::Value = serde_json::from_str(&stdout)?;
        Ok(stats)
    }

    /// Export database to file
    pub async fn export(&self, output_path: impl AsRef<Path>, compress: bool) -> Result<()> {
        self.ensure_initialized()?;

        let db_path = if self.config.in_memory {
            ":memory:".to_string()
        } else {
            self.config.db_path.display().to_string()
        };

        let mut cmd = Command::new("npx");
        cmd.arg("agentdb")
            .arg("export")
            .arg(&db_path)
            .arg(output_path.as_ref().to_str().unwrap());

        if compress {
            cmd.arg("--compress");
        }

        let output = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .output()
            .await?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(NeuralError::Storage(format!(
                "Export failed: {}",
                stderr
            )));
        }

        Ok(())
    }

    // Helper methods

    fn ensure_initialized(&self) -> Result<()> {
        if !self.initialized {
            return Err(NeuralError::Storage(
                "AgentDB not initialized".to_string()
            ));
        }
        Ok(())
    }

    fn get_model_storage_path(&self, model_id: &str) -> PathBuf {
        self.config.db_path
            .parent()
            .unwrap_or(Path::new("."))
            .join("models")
            .join(format!("{}.safetensors", model_id))
    }

    fn get_checkpoint_storage_path(&self, checkpoint_id: &str) -> PathBuf {
        self.config.db_path
            .parent()
            .unwrap_or(Path::new("."))
            .join("checkpoints")
            .join(format!("{}.ckpt", checkpoint_id))
    }

    fn generate_metadata_embedding(&self, metadata: &ModelMetadata) -> Result<String> {
        // Create a text representation of metadata for embedding
        let text = format!(
            "{} {} {} {}",
            metadata.name,
            metadata.model_type,
            metadata.description.as_deref().unwrap_or(""),
            metadata.tags.join(" ")
        );

        // For now, return a simple hash-based embedding
        // In production, use a proper embedding model
        let mut embedding = vec![0.0f32; self.config.dimension];
        let hash = fasthash::murmur3::hash32(text.as_bytes());
        for (i, val) in embedding.iter_mut().enumerate() {
            *val = ((hash.wrapping_add(i as u32) % 1000) as f32) / 1000.0;
        }

        Ok(serde_json::to_string(&embedding)?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires npx agentdb to be installed
    async fn test_agentdb_initialization() {
        let config = AgentDbConfig {
            in_memory: true,
            ..Default::default()
        };

        let storage = AgentDbStorage::with_config(config).await;
        assert!(storage.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_model_save_and_load() {
        let config = AgentDbConfig {
            in_memory: true,
            ..Default::default()
        };

        let storage = AgentDbStorage::with_config(config).await.unwrap();

        let model_bytes = vec![1, 2, 3, 4, 5];
        let metadata = ModelMetadata {
            name: "test-model".to_string(),
            model_type: "NHITS".to_string(),
            version: "1.0.0".to_string(),
            ..Default::default()
        };

        let model_id = storage.save_model(&model_bytes, metadata).await.unwrap();
        let loaded_bytes = storage.load_model(&model_id).await.unwrap();

        assert_eq!(model_bytes, loaded_bytes);
    }
}

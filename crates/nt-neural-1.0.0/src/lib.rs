//! Neural forecasting models for time series prediction in trading.
//!
//! This crate provides high-performance neural network models optimized for
//! financial time series forecasting with GPU acceleration support.
//!
//! # Models
//!
//! - **NHITS**: Neural Hierarchical Interpolation for Time Series
//! - **LSTM-Attention**: LSTM with multi-head attention mechanism
//! - **Transformer**: Transformer architecture for time series
//! - **GRU**: Gated Recurrent Unit (simpler than LSTM)
//! - **TCN**: Temporal Convolutional Network
//! - **DeepAR**: Probabilistic forecasting with LSTM
//! - **N-BEATS**: Pure MLP with interpretable decomposition
//! - **Prophet**: Time series decomposition (trend + seasonality)
//!
//! # Features
//!
//! - GPU acceleration (CUDA, Metal)
//! - Mixed precision training (FP16/FP32)
//! - Quantile regression for confidence intervals
//! - Model checkpointing and versioning
//! - Integration with AgentDB for model storage
//! - SIMD acceleration for CPU operations (requires nightly Rust)
//!
//! # Examples
//!
//! ```no_run
//! use nt_neural::{NHITSModel, ModelConfig, TrainingConfig};
//!
//! # async fn example() -> anyhow::Result<()> {
//! // Create model configuration
//! let _config = ModelConfig {
//!     input_size: 168,  // 1 week of hourly data
//!     horizon: 24,      // 24 hour forecast
//!     hidden_size: 512,
//!     ..Default::default()
//! };
//!
//! // Initialize model
//! let model = NHITSModel::new(config)?;
//!
//! // Train model (data preparation omitted)
//! // let trained_model = model.train(train_data, val_data).await?;
//! # Ok(())
//! # }
//! ```

#![cfg_attr(feature = "simd", feature(portable_simd))]

pub mod error;
#[cfg(feature = "candle")]
pub mod models;
pub mod training;
pub mod inference;
pub mod utils;
pub mod storage;

#[cfg(not(feature = "candle"))]
pub mod stubs;

// Re-export main types
pub use error::{NeuralError, Result};

#[cfg(feature = "candle")]
pub use models::{
    ModelConfig, ModelType,
};

#[cfg(feature = "candle")]
pub use models::{
    nhits::{NHITSModel, NHITSConfig},
    lstm_attention::{LSTMAttentionModel, LSTMAttentionConfig},
    transformer::{TransformerModel, TransformerConfig},
};

// Re-export new models
#[cfg(feature = "candle")]
pub use models::{
    gru::{GRUModel, GRUConfig},
    tcn::{TCNModel, TCNConfig},
    deepar::{DeepARModel, DeepARConfig, DistributionType},
    nbeats::{NBeatsModel, NBeatsConfig, StackType},
    prophet::{ProphetModel, ProphetConfig, GrowthModel},
};

#[cfg(feature = "candle")]
pub use training::{
    Trainer, TrainingConfig, TrainingMetrics,
    data_loader::{DataLoader, TimeSeriesDataset},
    optimizer::{Optimizer, OptimizerConfig},
    nhits_trainer::{NHITSTrainer, NHITSTrainingConfig},
};
pub use training::TrainingConfig;
pub use training::TrainingMetrics;

#[cfg(feature = "candle")]
pub use inference::{
    Predictor, BatchPredictor,
};
pub use inference::PredictionResult;

use serde::Serialize;
use std::path::Path;

// Re-export Device and Tensor from appropriate source
#[cfg(feature = "candle")]
pub use candle_core::{Device, Tensor};
#[cfg(not(feature = "candle"))]
pub use stubs::{Device, Tensor};

/// Initialize the neural module with optimal device selection
#[cfg(feature = "candle")]
pub fn initialize() -> Result<Device> {
    #[cfg(feature = "cuda")]
    {
        if let Ok(device) = Device::new_cuda(0) {
            tracing::info!("Neural module initialized with CUDA GPU acceleration");
            return Ok(device);
        }
    }

    #[cfg(feature = "metal")]
    {
        if let Ok(device) = Device::new_metal(0) {
            tracing::info!("Neural module initialized with Metal GPU acceleration");
            return Ok(device);
        }
    }

    #[cfg(feature = "accelerate")]
    {
        tracing::info!("Neural module initialized with Accelerate CPU optimization");
        return Ok(Device::Cpu);
    }

    tracing::warn!("Neural module initialized with standard CPU (no GPU acceleration)");
    Ok(Device::Cpu)
}

/// Placeholder when candle is not enabled
#[cfg(not(feature = "candle"))]
pub fn initialize() -> Result<()> {
    tracing::warn!("Neural module compiled without candle support");
    Ok(())
}

/// Model version information for tracking and reproducibility
#[cfg(feature = "candle")]
#[derive(Debug, Clone, Serialize, serde::Deserialize)]
pub struct ModelVersion {
    pub version: String,
    pub model_id: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub model_type: ModelType,
    pub config: serde_json::Value,
    pub metrics: Option<TrainingMetrics>,
}

#[cfg(feature = "candle")]
impl ModelVersion {
    pub fn new(model_type: ModelType, config: serde_json::Value) -> Self {
        let model_id = uuid::Uuid::new_v4().to_string();
        Self {
            version: "1.0.0".to_string(),
            model_id,
            created_at: chrono::Utc::now(),
            model_type,
            config,
            metrics: None,
        }
    }

    pub fn save(&self, path: impl AsRef<Path>) -> Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    pub fn load(path: impl AsRef<Path>) -> Result<Self> {
        let json = std::fs::read_to_string(path)?;
        let version = serde_json::from_str(&json)?;
        Ok(version)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(feature = "candle")]
    fn test_initialize_device() {
        let device = initialize().unwrap();
        assert!(device.is_cpu() || device.is_cuda() || device.is_metal());
    }

    #[test]
    #[cfg(not(feature = "candle"))]
    fn test_initialize_without_candle() {
        let result = initialize();
        assert!(result.is_ok());
    }

    #[test]
    fn test_model_version_serialization() {
        let model_config = serde_json::json!({
            "input_size": 168,
            "horizon": 24,
        });

        let version = ModelVersion::new(ModelType::NHITS, model_config);

        // Serialize to JSON
        let json = serde_json::to_string(&version).unwrap();
        assert!(json.contains("version"));
        assert!(json.contains("model_id"));

        // Deserialize back
        let deserialized: ModelVersion = serde_json::from_str(&json).unwrap();
        assert_eq!(version.version, deserialized.version);
        assert_eq!(version.model_id, deserialized.model_id);
    }

    #[test]
    fn test_new_model_types() {
        // Test that all new model types are properly defined
        let _gru = ModelType::GRU;
        let _tcn = ModelType::TCN;
        let _deepar = ModelType::DeepAR;
        let _nbeats = ModelType::NBeats;
        let _prophet = ModelType::Prophet;
    }
}

//! Training infrastructure for neural models

#[cfg(feature = "candle")]
pub mod data_loader;
#[cfg(feature = "candle")]
pub mod optimizer;
#[cfg(feature = "candle")]
pub mod trainer;
#[cfg(feature = "candle")]
pub mod nhits_trainer;

// CPU-only training (no candle dependency)
pub mod cpu_trainer;
pub mod simple_cpu_trainer;

use serde::{Serialize, Deserialize};

// Re-export main types when candle is enabled
#[cfg(feature = "candle")]
pub use data_loader::{DataLoader, TimeSeriesDataset};
#[cfg(feature = "candle")]
pub use optimizer::{LRScheduler, Optimizer, OptimizerConfig, OptimizerType};
#[cfg(feature = "candle")]
pub use trainer::{CheckpointMetadata, Trainer, quantile_loss};
#[cfg(feature = "candle")]
pub use nhits_trainer::{NHITSTrainer, NHITSTrainingConfig};

/// Training configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingConfig {
    pub batch_size: usize,
    pub num_epochs: usize,
    pub learning_rate: f64,
    pub weight_decay: f64,
    pub gradient_clip: Option<f64>,
    pub early_stopping_patience: usize,
    pub validation_split: f64,
    pub mixed_precision: bool,
}

impl Default for TrainingConfig {
    fn default() -> Self {
        Self {
            batch_size: 32,
            num_epochs: 100,
            learning_rate: 1e-3,
            weight_decay: 1e-5,
            gradient_clip: Some(1.0),
            early_stopping_patience: 10,
            validation_split: 0.2,
            mixed_precision: true,
        }
    }
}

/// Training metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingMetrics {
    pub epoch: usize,
    pub train_loss: f64,
    pub val_loss: Option<f64>,
    pub learning_rate: f64,
    #[serde(default)]
    pub epoch_time_seconds: f64,
}

impl Default for TrainingMetrics {
    fn default() -> Self {
        Self {
            epoch: 0,
            train_loss: 0.0,
            val_loss: None,
            learning_rate: 0.001,
            epoch_time_seconds: 0.0,
        }
    }
}

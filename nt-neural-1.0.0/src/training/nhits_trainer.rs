//! NHITS-specific training pipeline with advanced features

use crate::error::{NeuralError, Result};
use crate::models::nhits::{NHITSConfig, NHITSModel};
use crate::models::NeuralModel;
use crate::training::{
    data_loader::{DataLoader, TimeSeriesDataset},
    optimizer::{OptimizerConfig},
    trainer::Trainer,
    TrainingConfig, TrainingMetrics,
};
use candle_core::Device;
use polars::prelude::*;
use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use tracing::{info, warn};

/// NHITS-specific training configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NHITSTrainingConfig {
    /// Base training configuration
    #[serde(flatten)]
    pub base: TrainingConfig,

    /// NHITS model configuration
    pub model_config: NHITSConfig,

    /// Optimizer configuration
    pub optimizer_config: OptimizerConfig,

    /// Enable quantile loss for probabilistic forecasting
    pub use_quantile_loss: bool,

    /// Target quantiles for probabilistic forecasting
    pub target_quantiles: Vec<f64>,

    /// Checkpoint directory
    pub checkpoint_dir: Option<PathBuf>,

    /// TensorBoard logging directory
    pub tensorboard_dir: Option<PathBuf>,

    /// Save frequency (epochs)
    pub save_every: usize,

    /// GPU device ID (None for CPU)
    pub gpu_device: Option<usize>,
}

impl Default for NHITSTrainingConfig {
    fn default() -> Self {
        Self {
            base: TrainingConfig::default(),
            model_config: NHITSConfig::default(),
            optimizer_config: OptimizerConfig::default(),
            use_quantile_loss: false,
            target_quantiles: vec![0.1, 0.5, 0.9],
            checkpoint_dir: None,
            tensorboard_dir: None,
            save_every: 10,
            gpu_device: None,
        }
    }
}

/// NHITS trainer with comprehensive training pipeline
pub struct NHITSTrainer {
    config: NHITSTrainingConfig,
    device: Device,
    model: Option<NHITSModel>,
    trainer: Trainer,
    metrics_history: Vec<TrainingMetrics>,
}

impl NHITSTrainer {
    /// Create a new NHITS trainer
    pub fn new(config: NHITSTrainingConfig) -> Result<Self> {
        // Setup device
        let device = Self::setup_device(config.gpu_device)?;

        info!(
            "Initializing NHITS trainer on device: {:?}",
            if device.is_cuda() {
                "CUDA GPU"
            } else if device.is_metal() {
                "Metal GPU"
            } else {
                "CPU"
            }
        );

        // Create trainer
        let mut trainer = Trainer::new(config.base.clone(), device.clone());

        // Setup checkpointing if configured
        if let Some(ref checkpoint_dir) = config.checkpoint_dir {
            std::fs::create_dir_all(checkpoint_dir)?;
            trainer = trainer.with_checkpointing(checkpoint_dir);
        }

        Ok(Self {
            config,
            device,
            model: None,
            trainer,
            metrics_history: Vec::new(),
        })
    }

    /// Setup device (GPU if available and requested, otherwise CPU)
    fn setup_device(gpu_device: Option<usize>) -> Result<Device> {
        if let Some(device_id) = gpu_device {
            #[cfg(feature = "cuda")]
            {
                info!("Attempting to use CUDA device {}", device_id);
                return Device::new_cuda(device_id)
                    .map_err(|e| NeuralError::model(format!("Failed to initialize CUDA: {}", e)));
            }

            #[cfg(feature = "metal")]
            {
                info!("Attempting to use Metal device {}", device_id);
                return Device::new_metal(device_id)
                    .map_err(|e| NeuralError::model(format!("Failed to initialize Metal: {}", e)));
            }

            #[cfg(not(any(feature = "cuda", feature = "metal")))]
            {
                warn!("GPU requested but no GPU backend compiled, using CPU");
                return Ok(Device::Cpu);
            }
        }

        Ok(Device::Cpu)
    }

    /// Train model from CSV file
    pub async fn train_from_csv(
        &mut self,
        data_path: impl AsRef<Path>,
        target_column: &str,
    ) -> Result<TrainingMetrics> {
        info!("Loading training data from: {:?}", data_path.as_ref());

        // Load dataset
        let dataset = TimeSeriesDataset::from_csv(
            data_path,
            target_column,
            self.config.model_config.base.input_size,
            self.config.model_config.base.horizon,
        )?;

        self.train_from_dataset(dataset).await
    }

    /// Train model from Parquet file (faster for large datasets)
    pub async fn train_from_parquet(
        &mut self,
        data_path: impl AsRef<Path>,
        target_column: &str,
    ) -> Result<TrainingMetrics> {
        info!("Loading training data from: {:?}", data_path.as_ref());

        let dataset = TimeSeriesDataset::from_parquet(
            data_path,
            target_column,
            self.config.model_config.base.input_size,
            self.config.model_config.base.horizon,
        )?;

        self.train_from_dataset(dataset).await
    }

    /// Train model from in-memory DataFrame
    pub async fn train_from_dataframe(
        &mut self,
        df: DataFrame,
        target_column: &str,
    ) -> Result<TrainingMetrics> {
        info!("Creating dataset from DataFrame ({} rows)", df.height());

        let dataset = TimeSeriesDataset::new(
            df,
            target_column,
            self.config.model_config.base.input_size,
            self.config.model_config.base.horizon,
        )?;

        self.train_from_dataset(dataset).await
    }

    /// Train model from dataset
    pub async fn train_from_dataset(
        &mut self,
        mut dataset: TimeSeriesDataset,
    ) -> Result<TrainingMetrics> {
        info!("Starting training with {} samples", dataset.len());

        // Shuffle dataset
        dataset.shuffle();

        // Split into train/validation
        let (train_dataset, val_dataset) =
            dataset.train_val_split(self.config.base.validation_split)?;

        info!(
            "Train samples: {}, Validation samples: {}",
            train_dataset.len(),
            val_dataset.len()
        );

        // Create data loaders
        let train_loader = DataLoader::new(train_dataset, self.config.base.batch_size)
            .with_shuffle(true)
            .with_drop_last(false);

        let val_loader = DataLoader::new(val_dataset, self.config.base.batch_size)
            .with_shuffle(false)
            .with_drop_last(false);

        // Initialize model if not already created
        if self.model.is_none() {
            info!("Creating NHITS model...");
            let mut model_config = self.config.model_config.clone();
            model_config.base.device = Some(self.device.clone());

            self.model = Some(NHITSModel::new_with_vb(
                model_config,
                candle_nn::VarBuilder::from_varmap(
                    self.trainer.varmap(),
                    candle_core::DType::F32,
                    &self.device,
                ),
            )?);

            info!(
                "Model created with {} parameters",
                self.model.as_ref().unwrap().num_parameters()
            );
        }

        // Train the model
        let (trained_model, metrics) = self
            .trainer
            .train(
                self.model.take().unwrap(),
                train_loader,
                Some(val_loader),
                self.config.optimizer_config.clone(),
            )
            .await?;

        self.model = Some(trained_model);
        self.metrics_history.extend(metrics.clone());

        // Return final metrics
        let final_metrics = metrics
            .last()
            .cloned()
            .ok_or_else(|| NeuralError::training("No training metrics available"))?;

        info!(
            "Training completed! Final train_loss: {:.6}, val_loss: {:?}",
            final_metrics.train_loss, final_metrics.val_loss
        );

        Ok(final_metrics)
    }

    /// Save trained model to file
    pub fn save_model(&self, path: impl AsRef<Path>) -> Result<()> {
        let model = self
            .model
            .as_ref()
            .ok_or_else(|| NeuralError::model("No trained model available"))?;

        info!("Saving model to: {:?}", path.as_ref());

        // Save model weights
        model.save_weights(&path.as_ref().to_string_lossy())?;

        // Save training configuration
        let config_path = path.as_ref().with_extension("config.json");
        let config_json = serde_json::to_string_pretty(&self.config)?;
        std::fs::write(config_path, config_json)?;

        // Save metrics history
        let metrics_path = path.as_ref().with_extension("metrics.json");
        let metrics_json = serde_json::to_string_pretty(&self.metrics_history)?;
        std::fs::write(metrics_path, metrics_json)?;

        info!("Model saved successfully");

        Ok(())
    }

    /// Load trained model from file
    pub fn load_model(&mut self, path: impl AsRef<Path>) -> Result<()> {
        info!("Loading model from: {:?}", path.as_ref());

        // Load training configuration
        let config_path = path.as_ref().with_extension("config.json");
        if config_path.exists() {
            let config_json = std::fs::read_to_string(config_path)?;
            self.config = serde_json::from_str(&config_json)?;
        }

        // Create model
        let mut model_config = self.config.model_config.clone();
        model_config.base.device = Some(self.device.clone());

        let mut model = NHITSModel::new(model_config)?;

        // Load weights
        model.load_weights(&path.as_ref().to_string_lossy())?;

        self.model = Some(model);

        // Load metrics history if available
        let metrics_path = path.as_ref().with_extension("metrics.json");
        if metrics_path.exists() {
            let metrics_json = std::fs::read_to_string(metrics_path)?;
            self.metrics_history = serde_json::from_str(&metrics_json)?;
        }

        info!("Model loaded successfully");

        Ok(())
    }

    /// Get reference to trained model
    pub fn model(&self) -> Option<&NHITSModel> {
        self.model.as_ref()
    }

    /// Get mutable reference to trained model
    pub fn model_mut(&mut self) -> Option<&mut NHITSModel> {
        self.model.as_mut()
    }

    /// Get training metrics history
    pub fn metrics_history(&self) -> &[TrainingMetrics] {
        &self.metrics_history
    }

    /// Get training configuration
    pub fn config(&self) -> &NHITSTrainingConfig {
        &self.config
    }

    /// Validate model on test data
    pub async fn validate(
        &self,
        test_dataset: TimeSeriesDataset,
    ) -> Result<crate::utils::EvaluationMetrics> {
        let model = self
            .model
            .as_ref()
            .ok_or_else(|| NeuralError::model("No trained model available"))?;

        info!("Validating model on {} samples", test_dataset.len());

        let mut test_loader = DataLoader::new(test_dataset, self.config.base.batch_size)
            .with_shuffle(false)
            .with_drop_last(false);

        let mut all_predictions = Vec::new();
        let mut all_targets = Vec::new();

        while let Some((inputs, targets)) = test_loader.next_batch(&self.device)? {
            let predictions = model.forward(&inputs)?;

            // Convert tensors to vectors
            let pred_vec = predictions
                .flatten_all()?
                .to_vec1::<f64>()
                .map_err(|e| NeuralError::data(format!("Failed to convert predictions: {}", e)))?;

            let target_vec = targets
                .flatten_all()?
                .to_vec1::<f64>()
                .map_err(|e| NeuralError::data(format!("Failed to convert targets: {}", e)))?;

            all_predictions.extend(pred_vec);
            all_targets.extend(target_vec);
        }

        // Compute comprehensive metrics
        let metrics =
            crate::utils::EvaluationMetrics::compute(&all_targets, &all_predictions, None)?;

        info!(
            "Validation metrics: MAE={:.6}, RMSE={:.6}, MAPE={:.2}%, R²={:.4}",
            metrics.mae, metrics.rmse, metrics.mape, metrics.r2_score
        );

        Ok(metrics)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use polars::prelude::*;

    fn create_test_data(n: usize) -> DataFrame {
        let values: Vec<f64> = (0..n).map(|x| (x as f64 / 10.0).sin() * 100.0).collect();
        let dates: Vec<String> = (0..n).map(|i| format!("2024-01-{:02}", (i % 30) + 1)).collect();

        df!(
            "date" => dates,
            "value" => values.clone(),
            "feature1" => values.iter().map(|x| x * 1.1).collect::<Vec<_>>(),
            "feature2" => values.iter().map(|x| x * 0.9).collect::<Vec<_>>()
        )
        .unwrap()
    }

    #[test]
    fn test_nhits_trainer_creation() {
        let config = NHITSTrainingConfig::default();
        let trainer = NHITSTrainer::new(config);
        assert!(trainer.is_ok());
    }

    #[test]
    fn test_device_setup_cpu() {
        let device = NHITSTrainer::setup_device(None).unwrap();
        assert!(device.is_cpu());
    }

    #[tokio::test]
    async fn test_training_from_dataframe() {
        let mut config = NHITSTrainingConfig::default();
        config.base.num_epochs = 2; // Quick test
        config.base.batch_size = 8;
        config.model_config.base.input_size = 24;
        config.model_config.base.horizon = 12;

        let mut trainer = NHITSTrainer::new(config).unwrap();

        let df = create_test_data(500);
        let result = trainer.train_from_dataframe(df, "value").await;

        assert!(result.is_ok());

        let metrics = result.unwrap();
        assert!(metrics.train_loss > 0.0);
        assert!(trainer.model().is_some());
    }

    #[tokio::test]
    async fn test_overfit_single_batch() {
        // Test that model can overfit a single batch (sanity check)
        let mut config = NHITSTrainingConfig::default();
        config.base.num_epochs = 50;
        config.base.batch_size = 32;
        config.base.validation_split = 0.0; // No validation
        config.model_config.base.input_size = 24;
        config.model_config.base.horizon = 12;
        config.model_config.base.hidden_size = 128;

        let mut trainer = NHITSTrainer::new(config).unwrap();

        // Create small dataset
        let df = create_test_data(100);
        let result = trainer.train_from_dataframe(df, "value").await;

        assert!(result.is_ok());

        let metrics = result.unwrap();
        // Loss should decrease significantly
        assert!(metrics.train_loss < 1000.0);
    }

    #[test]
    fn test_save_load_config() {
        let config = NHITSTrainingConfig {
            base: TrainingConfig {
                batch_size: 64,
                num_epochs: 200,
                ..Default::default()
            },
            ..Default::default()
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        let loaded: NHITSTrainingConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(loaded.base.batch_size, 64);
        assert_eq!(loaded.base.num_epochs, 200);
    }
}

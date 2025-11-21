//! Complete training loop with validation, early stopping, and checkpointing

use crate::error::{NeuralError, Result};
use crate::models::NeuralModel;
use crate::training::{
    data_loader::{DataLoader, TimeSeriesDataset},
    optimizer::{LRScheduler, Optimizer, OptimizerConfig, SchedulerMode},
    TrainingConfig, TrainingMetrics,
};
#[cfg(feature = "candle")]
use candle_core::{Device, Tensor};
#[cfg(feature = "candle")]
use candle_nn::VarMap;
use std::path::{Path, PathBuf};
use std::time::Instant;
use tracing::{info, warn};

/// Model trainer with complete training pipeline
pub struct Trainer {
    config: TrainingConfig,
    device: Device,
    varmap: VarMap,
    best_val_loss: Option<f64>,
    epochs_without_improvement: usize,
    checkpoint_dir: Option<PathBuf>,
}

impl Trainer {
    /// Create a new trainer
    pub fn new(config: TrainingConfig, device: Device) -> Self {
        Self {
            config,
            device,
            varmap: VarMap::new(),
            best_val_loss: None,
            epochs_without_improvement: 0,
            checkpoint_dir: None,
        }
    }

    /// Enable checkpointing to a directory
    pub fn with_checkpointing(mut self, dir: impl AsRef<Path>) -> Self {
        self.checkpoint_dir = Some(dir.as_ref().to_path_buf());
        self
    }

    /// Get the VarMap for model initialization
    pub fn varmap(&self) -> &VarMap {
        &self.varmap
    }

    /// Get the device
    pub fn device(&self) -> &Device {
        &self.device
    }

    /// Train a model with validation
    pub async fn train<M: NeuralModel>(
        &mut self,
        mut model: M,
        mut train_loader: DataLoader,
        mut val_loader: Option<DataLoader>,
        optimizer_config: OptimizerConfig,
    ) -> Result<(M, Vec<TrainingMetrics>)> {
        // Create optimizer
        let mut optimizer = Optimizer::new(optimizer_config.clone(), &self.varmap)?;

        // Create learning rate scheduler
        let mut scheduler = LRScheduler::reduce_on_plateau(
            optimizer_config.learning_rate,
            self.config.early_stopping_patience / 2,
            0.5,
        );

        let mut metrics_history = Vec::new();

        info!(
            "Starting training for {} epochs (batch_size={}, lr={})",
            self.config.num_epochs, self.config.batch_size, optimizer_config.learning_rate
        );

        for epoch in 0..self.config.num_epochs {
            let epoch_start = Instant::now();

            // Training phase
            train_loader.reset();
            let train_loss = self.train_epoch(&model, &mut train_loader, &mut optimizer)?;

            // Validation phase
            let val_loss = if let Some(ref mut val_loader) = val_loader {
                val_loader.reset();
                Some(self.validate_epoch(&model, val_loader)?)
            } else {
                None
            };

            // Update learning rate
            let current_lr = scheduler.step(val_loss, epoch);
            optimizer.set_learning_rate(current_lr)?;

            let epoch_time = epoch_start.elapsed().as_secs_f64();

            let metrics = TrainingMetrics {
                epoch,
                train_loss,
                val_loss,
                learning_rate: current_lr,
                epoch_time_seconds: epoch_time,
            };

            info!(
                "Epoch {}/{}: train_loss={:.6}, val_loss={:?}, lr={:.2e}, time={:.2}s",
                epoch + 1,
                self.config.num_epochs,
                train_loss,
                val_loss.map(|v| format!("{:.6}", v)).unwrap_or_else(|| "N/A".to_string()),
                current_lr,
                epoch_time
            );

            metrics_history.push(metrics.clone());

            // Early stopping check
            if let Some(val_loss) = val_loss {
                let should_stop = self.check_early_stopping(val_loss);

                // Save checkpoint if best model
                if Some(val_loss) == self.best_val_loss {
                    if let Some(ref checkpoint_dir) = self.checkpoint_dir {
                        self.save_checkpoint(&model, epoch, val_loss, checkpoint_dir)?;
                    }
                }

                if should_stop {
                    info!("Early stopping triggered after {} epochs", epoch + 1);
                    break;
                }
            }

            // Periodic checkpoint
            if let Some(ref checkpoint_dir) = self.checkpoint_dir {
                if (epoch + 1) % 10 == 0 {
                    let checkpoint_path = checkpoint_dir.join(format!("checkpoint_epoch_{}.safetensors", epoch + 1));
                    model.save_weights(&checkpoint_path.to_string_lossy())?;
                }
            }
        }

        // Load best model if available
        if let Some(ref checkpoint_dir) = self.checkpoint_dir {
            let best_path = checkpoint_dir.join("best_model.safetensors");
            if best_path.exists() {
                info!("Loading best model from checkpoint");
                model.load_weights(&best_path.to_string_lossy())?;
            }
        }

        Ok((model, metrics_history))
    }

    /// Train for one epoch
    fn train_epoch<M: NeuralModel>(
        &self,
        model: &M,
        loader: &mut DataLoader,
        optimizer: &mut Optimizer,
    ) -> Result<f64> {
        let mut total_loss = 0.0;
        let mut batch_count = 0;

        while let Some((inputs, targets)) = loader.next_batch(&self.device)? {
            // Forward pass
            let predictions = model.forward(&inputs)?;

            // Compute loss (MSE)
            let loss = self.mse_loss(&predictions, &targets)?;

            // Backward pass
            optimizer.zero_grad()?;
            loss.backward()?;

            // Gradient clipping
            if let Some(max_norm) = self.config.gradient_clip {
                self.clip_gradients(&self.varmap, max_norm)?;
            }

            // Optimizer step
            optimizer.step()?;

            total_loss += loss.to_scalar::<f64>()?;
            batch_count += 1;
        }

        Ok(total_loss / batch_count as f64)
    }

    /// Validate for one epoch
    fn validate_epoch<M: NeuralModel>(
        &self,
        model: &M,
        loader: &mut DataLoader,
    ) -> Result<f64> {
        let mut total_loss = 0.0;
        let mut batch_count = 0;

        while let Some((inputs, targets)) = loader.next_batch(&self.device)? {
            // Forward pass (no gradients)
            let predictions = model.forward(&inputs)?;

            // Compute loss
            let loss = self.mse_loss(&predictions, &targets)?;

            total_loss += loss.to_scalar::<f64>()?;
            batch_count += 1;
        }

        Ok(total_loss / batch_count as f64)
    }

    /// Mean squared error loss
    fn mse_loss(&self, predictions: &Tensor, targets: &Tensor) -> Result<Tensor> {
        let diff = predictions.sub(targets)?;
        let squared = diff.sqr()?;
        let mean = squared.mean_all()?;
        Ok(mean)
    }

    /// Clip gradients by global norm
    fn clip_gradients(&self, varmap: &VarMap, max_norm: f64) -> Result<()> {
        let vars = varmap.all_vars();
        let mut total_norm = 0.0;

        // Compute global norm
        for var in &vars {
            if let Some(grad) = var.grad() {
                let grad_norm = grad.as_ref().sqr()?.sum_all()?.to_scalar::<f64>()?;
                total_norm += grad_norm;
            }
        }

        total_norm = total_norm.sqrt();

        // Clip if necessary
        if total_norm > max_norm {
            let clip_coef = max_norm / total_norm;
            for var in vars {
                if let Some(grad) = var.grad() {
                    let clipped = grad.as_ref().mul(&clip_coef)?;
                    var.set_grad(clipped)?;
                }
            }
        }

        Ok(())
    }

    /// Check early stopping condition
    fn check_early_stopping(&mut self, val_loss: f64) -> bool {
        match self.best_val_loss {
            None => {
                self.best_val_loss = Some(val_loss);
                self.epochs_without_improvement = 0;
                false
            }
            Some(best) => {
                if val_loss < best {
                    self.best_val_loss = Some(val_loss);
                    self.epochs_without_improvement = 0;
                    false
                } else {
                    self.epochs_without_improvement += 1;
                    self.epochs_without_improvement >= self.config.early_stopping_patience
                }
            }
        }
    }

    /// Save model checkpoint
    fn save_checkpoint<M: NeuralModel>(
        &self,
        model: &M,
        epoch: usize,
        val_loss: f64,
        checkpoint_dir: &Path,
    ) -> Result<()> {
        // Create checkpoint directory if it doesn't exist
        std::fs::create_dir_all(checkpoint_dir)?;

        // Save model weights
        let weights_path = checkpoint_dir.join("best_model.safetensors");
        model.save_weights(&weights_path.to_string_lossy())?;

        // Save checkpoint metadata
        let metadata = CheckpointMetadata {
            epoch,
            val_loss,
            timestamp: chrono::Utc::now(),
            config: self.config.clone(),
        };

        let metadata_path = checkpoint_dir.join("checkpoint_metadata.json");
        let json = serde_json::to_string_pretty(&metadata)?;
        std::fs::write(metadata_path, json)?;

        info!("Saved checkpoint at epoch {} (val_loss={:.6})", epoch + 1, val_loss);

        Ok(())
    }

    /// Load model from checkpoint
    pub fn load_checkpoint<M: NeuralModel>(
        checkpoint_dir: impl AsRef<Path>,
        mut model: M,
    ) -> Result<(M, CheckpointMetadata)> {
        let checkpoint_dir = checkpoint_dir.as_ref();

        // Load metadata
        let metadata_path = checkpoint_dir.join("checkpoint_metadata.json");
        let json = std::fs::read_to_string(metadata_path)?;
        let metadata: CheckpointMetadata = serde_json::from_str(&json)?;

        // Load model weights
        let weights_path = checkpoint_dir.join("best_model.safetensors");
        model.load_weights(&weights_path.to_string_lossy())?;

        Ok((model, metadata))
    }
}

/// Checkpoint metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CheckpointMetadata {
    pub epoch: usize,
    pub val_loss: f64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub config: TrainingConfig,
}

/// Quantile loss for probabilistic forecasting
pub fn quantile_loss(predictions: &Tensor, targets: &Tensor, quantile: f64) -> Result<Tensor> {
    let diff = targets.sub(predictions)?;
    let positive_part = diff.maximum(&Tensor::zeros_like(&diff)?)?;
    let negative_part = diff.minimum(&Tensor::zeros_like(&diff)?)?;

    let loss = positive_part
        .mul(&quantile)?
        .add(&negative_part.mul(&(quantile - 1.0))?)?;

    Ok(loss.mean_all()?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_trainer_creation() {
        let config = TrainingConfig::default();
        let device = Device::Cpu;
        let trainer = Trainer::new(config.clone(), device);

        assert_eq!(trainer.best_val_loss, None);
        assert_eq!(trainer.epochs_without_improvement, 0);
    }

    #[test]
    fn test_early_stopping() {
        let config = TrainingConfig {
            early_stopping_patience: 3,
            ..Default::default()
        };
        let device = Device::Cpu;
        let mut trainer = Trainer::new(config, device);

        // First epoch - improvement
        assert!(!trainer.check_early_stopping(1.0));

        // Second epoch - improvement
        assert!(!trainer.check_early_stopping(0.8));

        // Third epoch - no improvement
        assert!(!trainer.check_early_stopping(0.9));

        // Fourth epoch - no improvement
        assert!(!trainer.check_early_stopping(0.9));

        // Fifth epoch - no improvement, should trigger early stopping
        assert!(trainer.check_early_stopping(0.9));
    }
}

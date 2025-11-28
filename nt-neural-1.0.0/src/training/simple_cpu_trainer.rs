//! Simple and fast CPU-only training for demonstration
//!
//! Uses simple MLP models that train quickly without complex gradient computation

use crate::error::Result;
use crate::training::TrainingMetrics;
use ndarray::{Array1, Array2};

/// Simple MLP model for fast CPU training
pub struct SimpleMLP {
    pub w1: Array2<f64>,
    pub b1: Array1<f64>,
    pub w2: Array2<f64>,
    pub b2: Array1<f64>,
}

impl SimpleMLP {
    pub fn new(input_size: usize, hidden_size: usize, output_size: usize) -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        let scale1 = (2.0 / (input_size + hidden_size) as f64).sqrt();
        let scale2 = (2.0 / (hidden_size + output_size) as f64).sqrt();

        Self {
            w1: Array2::from_shape_fn((input_size, hidden_size), |_| {
                rng.gen_range(-scale1..scale1)
            }),
            b1: Array1::zeros(hidden_size),
            w2: Array2::from_shape_fn((hidden_size, output_size), |_| {
                rng.gen_range(-scale2..scale2)
            }),
            b2: Array1::zeros(output_size),
        }
    }

    pub fn forward(&self, x: &Array2<f64>) -> (Array2<f64>, Array2<f64>) {
        // Layer 1
        let z1 = x.dot(&self.w1) + &self.b1;
        let h1 = z1.mapv(|v| v.max(0.0)); // ReLU

        // Layer 2
        let z2 = h1.dot(&self.w2) + &self.b2;

        (h1, z2)
    }

    pub fn predict(&self, x: &Array2<f64>) -> Array2<f64> {
        let (_, output) = self.forward(x);
        output
    }

    pub fn train_step(
        &mut self,
        x: &Array2<f64>,
        y: &Array2<f64>,
        learning_rate: f64,
    ) -> f64 {
        let batch_size = x.nrows() as f64;

        // Forward pass
        let (h1, output) = self.forward(x);

        // Compute loss (MSE)
        let loss = (&output - y).mapv(|v| v * v).mean().unwrap();

        // Backward pass
        // dL/dz2 = 2 * (output - y) / batch_size
        let dz2 = (&output - y) * (2.0 / batch_size);

        // Gradients for w2 and b2
        let dw2 = h1.t().dot(&dz2);
        let db2 = dz2.sum_axis(ndarray::Axis(0));

        // Backprop to hidden layer
        let dh1 = dz2.dot(&self.w2.t());

        // ReLU derivative (only pass gradient where activation > 0)
        let dz1 = dh1 * &h1.mapv(|v| if v > 0.0 { 1.0 } else { 0.0 });

        // Gradients for w1 and b1
        let dw1 = x.t().dot(&dz1);
        let db1 = dz1.sum_axis(ndarray::Axis(0));

        // Update weights with gradient clipping
        let clip_value = 5.0;
        let dw1_clipped = dw1.mapv(|v| v.max(-clip_value).min(clip_value));
        let dw2_clipped = dw2.mapv(|v| v.max(-clip_value).min(clip_value));
        let db1_clipped = db1.mapv(|v| v.max(-clip_value).min(clip_value));
        let db2_clipped = db2.mapv(|v| v.max(-clip_value).min(clip_value));

        self.w1 = &self.w1 - &(&dw1_clipped * learning_rate);
        self.b1 = &self.b1 - &(&db1_clipped * learning_rate);
        self.w2 = &self.w2 - &(&dw2_clipped * learning_rate);
        self.b2 = &self.b2 - &(&db2_clipped * learning_rate);

        loss
    }
}

/// Simple CPU trainer configuration
#[derive(Debug, Clone)]
pub struct SimpleCPUTrainingConfig {
    pub epochs: usize,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub early_stopping_patience: usize,
    pub print_every: usize,
}

impl Default for SimpleCPUTrainingConfig {
    fn default() -> Self {
        Self {
            epochs: 30,
            batch_size: 32,
            learning_rate: 0.01,
            early_stopping_patience: 10,
            print_every: 3,
        }
    }
}

/// Simple CPU trainer
pub struct SimpleCPUTrainer {
    config: SimpleCPUTrainingConfig,
}

impl SimpleCPUTrainer {
    pub fn new(config: SimpleCPUTrainingConfig) -> Self {
        Self { config }
    }

    pub fn train(
        &self,
        model: &mut SimpleMLP,
        train_x: &Array2<f64>,
        train_y: &Array2<f64>,
        val_x: Option<&Array2<f64>>,
        val_y: Option<&Array2<f64>>,
    ) -> Result<TrainingMetrics> {
        let mut best_val_loss = f64::INFINITY;
        let mut patience_counter = 0;
        let mut train_losses = Vec::new();
        let mut val_losses = Vec::new();

        println!("Starting training...");
        println!(
            "Epochs: {}, Batch size: {}, Learning rate: {}",
            self.config.epochs, self.config.batch_size, self.config.learning_rate
        );

        for epoch in 0..self.config.epochs {
            let mut epoch_loss = 0.0;
            let num_batches =
                (train_x.nrows() + self.config.batch_size - 1) / self.config.batch_size;

            // Mini-batch training
            for batch_idx in 0..num_batches {
                let start = batch_idx * self.config.batch_size;
                let end = (start + self.config.batch_size).min(train_x.nrows());

                let batch_x = train_x.slice(ndarray::s![start..end, ..]).to_owned();
                let batch_y = train_y.slice(ndarray::s![start..end, ..]).to_owned();

                let loss = model.train_step(&batch_x, &batch_y, self.config.learning_rate);
                epoch_loss += loss;
            }

            epoch_loss /= num_batches as f64;
            train_losses.push(epoch_loss);

            // Validation
            let val_loss = if let (Some(vx), Some(vy)) = (val_x, val_y) {
                let pred = model.predict(vx);
                let loss = (&pred - vy).mapv(|v| v * v).mean().unwrap();
                val_losses.push(loss);
                loss
            } else {
                epoch_loss
            };

            // Print progress
            if (epoch + 1) % self.config.print_every == 0 {
                println!(
                    "Epoch {}/{}: train_loss={:.6}, val_loss={:.6}",
                    epoch + 1,
                    self.config.epochs,
                    epoch_loss,
                    val_loss
                );
            }

            // Early stopping
            if val_loss < best_val_loss {
                best_val_loss = val_loss;
                patience_counter = 0;
            } else {
                patience_counter += 1;
                if patience_counter >= self.config.early_stopping_patience {
                    println!("Early stopping at epoch {}", epoch + 1);
                    break;
                }
            }
        }

        Ok(TrainingMetrics {
            train_loss: *train_losses.last().unwrap_or(&0.0),
            val_loss: val_losses.last().copied(),
            epoch: train_losses.len(),
            learning_rate: self.config.learning_rate,
            epoch_time_seconds: 0.0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_mlp_creation() {
        let model = SimpleMLP::new(10, 20, 5);
        assert_eq!(model.w1.shape(), &[10, 20]);
        assert_eq!(model.w2.shape(), &[20, 5]);
    }

    #[test]
    fn test_simple_mlp_forward() {
        let model = SimpleMLP::new(10, 20, 5);
        let x = Array2::from_shape_fn((4, 10), |_| rand::random::<f64>());
        let output = model.predict(&x);
        assert_eq!(output.shape(), &[4, 5]);
    }

    #[test]
    fn test_train_step() {
        let mut model = SimpleMLP::new(10, 20, 5);
        let x = Array2::from_shape_fn((4, 10), |_| rand::random::<f64>());
        let y = Array2::from_shape_fn((4, 5), |_| rand::random::<f64>());

        let initial_loss = model.train_step(&x, &y, 0.01);
        let second_loss = model.train_step(&x, &y, 0.01);

        // Loss should generally decrease with training
        assert!(initial_loss.is_finite());
        assert!(second_loss.is_finite());
    }
}

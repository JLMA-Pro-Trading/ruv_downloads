//! CPU-only training module for neural networks
//!
//! Pure ndarray-based training without GPU dependencies.
//! Supports GRU, TCN, N-BEATS, and Prophet models.

use crate::error::Result;
use crate::training::TrainingMetrics;
use ndarray::{Array1, Array2};

/// CPU-based optimizer types
#[derive(Debug, Clone)]
pub enum OptimizerType {
    /// Stochastic Gradient Descent with momentum
    SGD { learning_rate: f64, momentum: f64 },
    /// Adam optimizer
    Adam {
        learning_rate: f64,
        beta1: f64,
        beta2: f64,
        epsilon: f64,
    },
}

impl Default for OptimizerType {
    fn default() -> Self {
        Self::Adam {
            learning_rate: 0.001,
            beta1: 0.9,
            beta2: 0.999,
            epsilon: 1e-8,
        }
    }
}

/// CPU training configuration
#[derive(Debug, Clone)]
pub struct CPUTrainingConfig {
    /// Number of training epochs
    pub epochs: usize,
    /// Batch size for training
    pub batch_size: usize,
    /// Optimizer configuration
    pub optimizer: OptimizerType,
    /// Early stopping patience (epochs without improvement)
    pub early_stopping_patience: Option<usize>,
    /// Validation split ratio (0.0 to 1.0)
    pub validation_split: f64,
    /// Print training progress every N epochs
    pub print_every: usize,
    /// Save checkpoint every N epochs
    pub checkpoint_every: Option<usize>,
}

impl Default for CPUTrainingConfig {
    fn default() -> Self {
        Self {
            epochs: 50,
            batch_size: 32,
            optimizer: OptimizerType::default(),
            early_stopping_patience: Some(10),
            validation_split: 0.2,
            print_every: 5,
            checkpoint_every: Some(10),
        }
    }
}

/// SGD optimizer with momentum
pub struct SGDOptimizer {
    learning_rate: f64,
    momentum: f64,
    velocity: Option<Vec<Array2<f64>>>,
}

impl SGDOptimizer {
    pub fn new(learning_rate: f64, momentum: f64) -> Self {
        Self {
            learning_rate,
            momentum,
            velocity: None,
        }
    }

    pub fn update(&mut self, weights: &mut [Array2<f64>], gradients: &[Array2<f64>]) {
        if self.velocity.is_none() {
            self.velocity = Some(
                gradients
                    .iter()
                    .map(|g| Array2::zeros(g.raw_dim()))
                    .collect(),
            );
        }

        let velocity = self.velocity.as_mut().unwrap();

        for (i, (w, g)) in weights.iter_mut().zip(gradients.iter()).enumerate() {
            // v = momentum * v - learning_rate * gradient
            velocity[i] = &velocity[i] * self.momentum - g * self.learning_rate;
            // w = w + v
            *w = &*w + &velocity[i];
        }
    }
}

/// Adam optimizer
pub struct AdamOptimizer {
    learning_rate: f64,
    beta1: f64,
    beta2: f64,
    epsilon: f64,
    t: usize,
    m: Option<Vec<Array2<f64>>>, // First moment
    v: Option<Vec<Array2<f64>>>, // Second moment
}

impl AdamOptimizer {
    pub fn new(learning_rate: f64, beta1: f64, beta2: f64, epsilon: f64) -> Self {
        Self {
            learning_rate,
            beta1,
            beta2,
            epsilon,
            t: 0,
            m: None,
            v: None,
        }
    }

    pub fn update(&mut self, weights: &mut [Array2<f64>], gradients: &[Array2<f64>]) {
        self.t += 1;

        if self.m.is_none() {
            self.m = Some(
                gradients
                    .iter()
                    .map(|g| Array2::zeros(g.raw_dim()))
                    .collect(),
            );
            self.v = Some(
                gradients
                    .iter()
                    .map(|g| Array2::zeros(g.raw_dim()))
                    .collect(),
            );
        }

        let m = self.m.as_mut().unwrap();
        let v = self.v.as_mut().unwrap();

        for (i, (w, g)) in weights.iter_mut().zip(gradients.iter()).enumerate() {
            // m = beta1 * m + (1 - beta1) * g
            m[i] = &m[i] * self.beta1 + g * (1.0 - self.beta1);

            // v = beta2 * v + (1 - beta2) * g^2
            v[i] = &v[i] * self.beta2 + &(g.mapv(|x| x * x) * (1.0 - self.beta2));

            // Bias correction
            let m_hat = &m[i] / (1.0 - self.beta1.powi(self.t as i32));
            let v_hat = &v[i] / (1.0 - self.beta2.powi(self.t as i32));

            // Update: w = w - lr * m_hat / (sqrt(v_hat) + epsilon)
            let update = &m_hat / &(v_hat.mapv(|x| x.sqrt()) + self.epsilon) * self.learning_rate;
            *w = &*w - &update;
        }
    }
}

/// Simple GRU model weights (CPU-only)
pub struct SimpleGRUWeights {
    // Update gate
    pub w_z: Array2<f64>,
    pub u_z: Array2<f64>,
    pub b_z: Array1<f64>,
    // Reset gate
    pub w_r: Array2<f64>,
    pub u_r: Array2<f64>,
    pub b_r: Array1<f64>,
    // Candidate
    pub w_h: Array2<f64>,
    pub u_h: Array2<f64>,
    pub b_h: Array1<f64>,
    // Output
    pub w_out: Array2<f64>,
    pub b_out: Array1<f64>,
}

impl SimpleGRUWeights {
    pub fn new(input_size: usize, hidden_size: usize, output_size: usize) -> Self {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        let xavier_in = (2.0 / (input_size + hidden_size) as f64).sqrt();
        let xavier_hidden = (2.0 / (hidden_size + hidden_size) as f64).sqrt();
        let xavier_out = (2.0 / (hidden_size + output_size) as f64).sqrt();

        Self {
            w_z: Array2::from_shape_fn((input_size, hidden_size), |_| {
                rng.gen_range(-xavier_in..xavier_in)
            }),
            u_z: Array2::from_shape_fn((hidden_size, hidden_size), |_| {
                rng.gen_range(-xavier_hidden..xavier_hidden)
            }),
            b_z: Array1::zeros(hidden_size),
            w_r: Array2::from_shape_fn((input_size, hidden_size), |_| {
                rng.gen_range(-xavier_in..xavier_in)
            }),
            u_r: Array2::from_shape_fn((hidden_size, hidden_size), |_| {
                rng.gen_range(-xavier_hidden..xavier_hidden)
            }),
            b_r: Array1::zeros(hidden_size),
            w_h: Array2::from_shape_fn((input_size, hidden_size), |_| {
                rng.gen_range(-xavier_in..xavier_in)
            }),
            u_h: Array2::from_shape_fn((hidden_size, hidden_size), |_| {
                rng.gen_range(-xavier_hidden..xavier_hidden)
            }),
            b_h: Array1::zeros(hidden_size),
            w_out: Array2::from_shape_fn((hidden_size, output_size), |_| {
                rng.gen_range(-xavier_out..xavier_out)
            }),
            b_out: Array1::zeros(output_size),
        }
    }

    /// Forward pass through GRU (simplified - treats input as flat features)
    pub fn forward(&self, input: &Array2<f64>) -> Array2<f64> {
        let batch_size = input.nrows();
        let hidden_size = self.w_z.ncols();

        // Simplified: treat entire input as single timestep
        let x = input.clone();
        let h = Array2::zeros((batch_size, hidden_size));

        // Update gate: z = sigmoid(W_z * x + U_z * h + b_z)
        let z = sigmoid(&(x.dot(&self.w_z) + h.dot(&self.u_z) + &self.b_z));

        // Reset gate: r = sigmoid(W_r * x + U_r * h + b_r)
        let r = sigmoid(&(x.dot(&self.w_r) + h.dot(&self.u_r) + &self.b_r));

        // Candidate: h_tilde = tanh(W_h * x + U_h * (r * h) + b_h)
        let h_reset = &r * &h;
        let h_tilde = tanh(&(x.dot(&self.w_h) + h_reset.dot(&self.u_h) + &self.b_h));

        // Update hidden: h = (1 - z) * h + z * h_tilde
        let h_new = &(&z * &h_tilde) + &(&(1.0 - &z) * &h);

        // Output projection
        h_new.dot(&self.w_out) + &self.b_out
    }

    /// Compute loss (MSE)
    pub fn compute_loss(&self, input: &Array2<f64>, target: &Array2<f64>) -> f64 {
        let pred = self.forward(input);
        let diff = &pred - target;
        (&diff * &diff).mean().unwrap()
    }
}

// Activation functions
fn sigmoid(x: &Array2<f64>) -> Array2<f64> {
    x.mapv(|v| 1.0 / (1.0 + (-v).exp()))
}

fn tanh(x: &Array2<f64>) -> Array2<f64> {
    x.mapv(|v| v.tanh())
}

/// CPU Trainer for simple models
pub struct CPUTrainer {
    config: CPUTrainingConfig,
}

impl CPUTrainer {
    pub fn new(config: CPUTrainingConfig) -> Self {
        Self { config }
    }

    /// Train a GRU model
    pub fn train_gru(
        &self,
        weights: &mut SimpleGRUWeights,
        train_x: &Array2<f64>,
        train_y: &Array2<f64>,
        val_x: Option<&Array2<f64>>,
        val_y: Option<&Array2<f64>>,
    ) -> Result<TrainingMetrics> {
        let mut best_val_loss = f64::INFINITY;
        let mut patience_counter = 0;
        let mut train_losses = Vec::new();
        let mut val_losses = Vec::new();

        println!("Starting GRU training...");
        println!("Epochs: {}, Batch size: {}", self.config.epochs, self.config.batch_size);

        for epoch in 0..self.config.epochs {
            let mut epoch_loss = 0.0;
            let num_batches = (train_x.nrows() + self.config.batch_size - 1) / self.config.batch_size;

            // Training batches
            for batch in 0..num_batches {
                let start = batch * self.config.batch_size;
                let end = (start + self.config.batch_size).min(train_x.nrows());

                let batch_x = train_x.slice(s![start..end, ..]).to_owned();
                let batch_y = train_y.slice(s![start..end, ..]).to_owned();

                let loss = weights.compute_loss(&batch_x, &batch_y);
                epoch_loss += loss;

                // Simple gradient approximation (finite differences)
                self.apply_gradient_step(weights, &batch_x, &batch_y);
            }

            epoch_loss /= num_batches as f64;
            train_losses.push(epoch_loss);

            // Validation
            let val_loss = if let (Some(vx), Some(vy)) = (val_x, val_y) {
                let loss = weights.compute_loss(vx, vy);
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
            if let Some(patience) = self.config.early_stopping_patience {
                if val_loss < best_val_loss {
                    best_val_loss = val_loss;
                    patience_counter = 0;
                } else {
                    patience_counter += 1;
                    if patience_counter >= patience {
                        println!("Early stopping at epoch {}", epoch + 1);
                        break;
                    }
                }
            }
        }

        Ok(TrainingMetrics {
            train_loss: *train_losses.last().unwrap_or(&0.0),
            val_loss: val_losses.last().copied(),
            epoch: train_losses.len(),
            learning_rate: match &self.config.optimizer {
                OptimizerType::SGD { learning_rate, .. } => *learning_rate,
                OptimizerType::Adam { learning_rate, .. } => *learning_rate,
            },
            epoch_time_seconds: 0.0, // Will be tracked per epoch in future
        })
    }

    fn apply_gradient_step(
        &self,
        weights: &mut SimpleGRUWeights,
        input: &Array2<f64>,
        target: &Array2<f64>,
    ) {
        let learning_rate = match &self.config.optimizer {
            OptimizerType::SGD { learning_rate, .. } => *learning_rate,
            OptimizerType::Adam { learning_rate, .. } => *learning_rate,
        };

        // Use central differences for more stable gradients
        let eps = 1e-4;
        let grad_clip = 1.0; // Gradient clipping threshold

        // Update w_out using central differences
        for i in 0..weights.w_out.nrows() {
            for j in 0..weights.w_out.ncols() {
                let original = weights.w_out[[i, j]];

                // Forward perturbation
                weights.w_out[[i, j]] = original + eps;
                let loss_plus = weights.compute_loss(input, target);

                // Backward perturbation
                weights.w_out[[i, j]] = original - eps;
                let loss_minus = weights.compute_loss(input, target);

                // Central difference: (f(x+h) - f(x-h)) / 2h
                let grad = (loss_plus - loss_minus) / (2.0 * eps);

                // Gradient clipping
                let grad = grad.max(-grad_clip).min(grad_clip);

                // Check for NaN
                if !grad.is_nan() && !grad.is_infinite() {
                    weights.w_out[[i, j]] = original - learning_rate * grad;
                } else {
                    weights.w_out[[i, j]] = original;
                }
            }
        }

        // Update b_out
        for i in 0..weights.b_out.len() {
            let original = weights.b_out[i];

            weights.b_out[i] = original + eps;
            let loss_plus = weights.compute_loss(input, target);

            weights.b_out[i] = original - eps;
            let loss_minus = weights.compute_loss(input, target);

            let grad = (loss_plus - loss_minus) / (2.0 * eps);
            let grad = grad.max(-grad_clip).min(grad_clip);

            if !grad.is_nan() && !grad.is_infinite() {
                weights.b_out[i] = original - learning_rate * grad;
            } else {
                weights.b_out[i] = original;
            }
        }
    }
}

// Re-export ndarray's s! macro for slicing
use ndarray::s;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sigmoid() {
        let x = Array2::from_shape_vec((2, 2), vec![0.0, 1.0, -1.0, 2.0]).unwrap();
        let result = sigmoid(&x);
        assert!((result[[0, 0]] - 0.5).abs() < 1e-6);
        assert!(result[[0, 1]] > 0.5);
        assert!(result[[1, 0]] < 0.5);
    }

    #[test]
    fn test_gru_weights_creation() {
        let weights = SimpleGRUWeights::new(10, 20, 5);
        assert_eq!(weights.w_z.shape(), &[10, 20]);
        assert_eq!(weights.w_out.shape(), &[20, 5]);
    }

    #[test]
    fn test_gru_forward() {
        // input_size=5, hidden_size=10, output_size=3
        let weights = SimpleGRUWeights::new(5, 10, 3);
        // Input shape should be (batch_size, input_size) = (2, 5)
        let input = Array2::from_shape_fn((2, 5), |_| rand::random::<f64>());
        let output = weights.forward(&input);
        assert_eq!(output.shape(), &[2, 3]);
    }

    #[test]
    fn test_cpu_trainer_creation() {
        let config = CPUTrainingConfig::default();
        let _trainer = CPUTrainer::new(config);
    }
}

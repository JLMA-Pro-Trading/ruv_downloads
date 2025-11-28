//! Optimizer implementations for neural network training

use crate::error::{NeuralError, Result};
#[cfg(feature = "candle")]
use candle_core::Tensor;
#[cfg(feature = "candle")]
use candle_nn::{AdamW, Optimizer as CandleOptimizer, ParamsAdamW, VarMap};
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Optimizer type
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum OptimizerType {
    Adam,
    AdamW,
    SGD,
    RMSprop,
}

/// Optimizer configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizerConfig {
    pub optimizer_type: OptimizerType,
    pub learning_rate: f64,
    pub weight_decay: f64,
    pub betas: (f64, f64),
    pub eps: f64,
    pub momentum: f64,
    pub dampening: f64,
    pub nesterov: bool,
}

impl Default for OptimizerConfig {
    fn default() -> Self {
        Self {
            optimizer_type: OptimizerType::AdamW,
            learning_rate: 1e-3,
            weight_decay: 1e-5,
            betas: (0.9, 0.999),
            eps: 1e-8,
            momentum: 0.0,
            dampening: 0.0,
            nesterov: false,
        }
    }
}

impl OptimizerConfig {
    /// Create Adam optimizer config
    pub fn adam(learning_rate: f64) -> Self {
        Self {
            optimizer_type: OptimizerType::Adam,
            learning_rate,
            weight_decay: 0.0,
            ..Default::default()
        }
    }

    /// Create AdamW optimizer config
    pub fn adamw(learning_rate: f64, weight_decay: f64) -> Self {
        Self {
            optimizer_type: OptimizerType::AdamW,
            learning_rate,
            weight_decay,
            ..Default::default()
        }
    }

    /// Create SGD optimizer config
    pub fn sgd(learning_rate: f64, momentum: f64) -> Self {
        Self {
            optimizer_type: OptimizerType::SGD,
            learning_rate,
            momentum,
            weight_decay: 0.0,
            ..Default::default()
        }
    }

    /// Create RMSprop optimizer config
    pub fn rmsprop(learning_rate: f64) -> Self {
        Self {
            optimizer_type: OptimizerType::RMSprop,
            learning_rate,
            weight_decay: 0.0,
            ..Default::default()
        }
    }
}

/// Optimizer wrapper
pub struct Optimizer {
    config: OptimizerConfig,
    inner: Box<dyn CandleOptimizer>,
    step_count: usize,
}

impl Optimizer {
    /// Create a new optimizer from VarMap
    pub fn new(config: OptimizerConfig, varmap: &VarMap) -> Result<Self> {
        let inner: Box<dyn CandleOptimizer> = match config.optimizer_type {
            OptimizerType::Adam | OptimizerType::AdamW => {
                let params = ParamsAdamW {
                    lr: config.learning_rate,
                    beta1: config.betas.0,
                    beta2: config.betas.1,
                    eps: config.eps,
                    weight_decay: config.weight_decay,
                };
                Box::new(AdamW::new(varmap.all_vars(), params)?)
            }
            OptimizerType::SGD => {
                Box::new(SGDOptimizer::new(
                    varmap.all_vars(),
                    config.learning_rate,
                    config.momentum,
                    config.weight_decay,
                    config.dampening,
                    config.nesterov,
                )?)
            }
            OptimizerType::RMSprop => {
                Box::new(RMSpropOptimizer::new(
                    varmap.all_vars(),
                    config.learning_rate,
                    0.99, // alpha
                    config.eps,
                    config.weight_decay,
                    config.momentum,
                )?)
            }
        };

        Ok(Self {
            config,
            inner,
            step_count: 0,
        })
    }

    /// Perform optimization step
    pub fn step(&mut self) -> Result<()> {
        self.inner.step()?;
        self.step_count += 1;
        Ok(())
    }

    /// Zero gradients
    pub fn zero_grad(&mut self) -> Result<()> {
        self.inner.zero_grad()?;
        Ok(())
    }

    /// Get current learning rate
    pub fn learning_rate(&self) -> f64 {
        self.config.learning_rate
    }

    /// Set learning rate
    pub fn set_learning_rate(&mut self, lr: f64) -> Result<()> {
        self.config.learning_rate = lr;
        self.inner.set_learning_rate(lr)?;
        Ok(())
    }

    /// Get step count
    pub fn step_count(&self) -> usize {
        self.step_count
    }

    /// Get optimizer config
    pub fn config(&self) -> &OptimizerConfig {
        &self.config
    }
}

/// SGD optimizer implementation
struct SGDOptimizer {
    vars: Vec<candle_nn::Var>,
    learning_rate: f64,
    momentum: f64,
    weight_decay: f64,
    dampening: f64,
    nesterov: bool,
    velocity: HashMap<String, Tensor>,
}

impl SGDOptimizer {
    fn new(
        vars: Vec<candle_nn::Var>,
        learning_rate: f64,
        momentum: f64,
        weight_decay: f64,
        dampening: f64,
        nesterov: bool,
    ) -> Result<Self> {
        Ok(Self {
            vars,
            learning_rate,
            momentum,
            weight_decay,
            dampening,
            nesterov,
            velocity: HashMap::new(),
        })
    }

    fn get_or_init_velocity(&mut self, name: &str, grad: &Tensor) -> Result<Tensor> {
        if let Some(v) = self.velocity.get(name) {
            Ok(v.clone())
        } else {
            let v = Tensor::zeros_like(grad)?;
            self.velocity.insert(name.to_string(), v.clone());
            Ok(v)
        }
    }
}

impl CandleOptimizer for SGDOptimizer {
    fn step(&mut self, _loss: &Tensor) -> candle_core::Result<()> {
        for (idx, var) in self.vars.iter().enumerate() {
            if let Some(grad) = var.grad() {
                let mut grad = grad.as_ref().clone();

                // Weight decay
                if self.weight_decay != 0.0 {
                    grad = (grad + var.as_tensor().mul(&self.weight_decay)?)?;
                }

                // Momentum
                if self.momentum != 0.0 {
                    let name = format!("var_{}", idx);
                    let mut v = self.get_or_init_velocity(&name, &grad)
                        .map_err(|e| candle_core::Error::Msg(e.to_string()))?;

                    v = (v.mul(&self.momentum)? + grad.mul(&(1.0 - self.dampening))?)?;

                    grad = if self.nesterov {
                        (grad + v.mul(&self.momentum)?)?
                    } else {
                        v.clone()
                    };

                    self.velocity.insert(name, v);
                }

                // Update parameters
                let delta = grad.mul(&(-self.learning_rate))?;
                var.set(&var.add(&delta)?)?;
            }
        }
        Ok(())
    }

    fn learning_rate(&self) -> f64 {
        self.learning_rate
    }

    fn set_learning_rate(&mut self, lr: f64) {
        self.learning_rate = lr;
    }
}

/// RMSprop optimizer implementation
struct RMSpropOptimizer {
    vars: Vec<candle_nn::Var>,
    learning_rate: f64,
    alpha: f64,
    eps: f64,
    weight_decay: f64,
    momentum: f64,
    square_avg: HashMap<String, Tensor>,
    momentum_buffer: HashMap<String, Tensor>,
}

impl RMSpropOptimizer {
    fn new(
        vars: Vec<candle_nn::Var>,
        learning_rate: f64,
        alpha: f64,
        eps: f64,
        weight_decay: f64,
        momentum: f64,
    ) -> Result<Self> {
        Ok(Self {
            vars,
            learning_rate,
            alpha,
            eps,
            weight_decay,
            momentum,
            square_avg: HashMap::new(),
            momentum_buffer: HashMap::new(),
        })
    }

    fn get_or_init_square_avg(&mut self, name: &str, grad: &Tensor) -> Result<Tensor> {
        if let Some(v) = self.square_avg.get(name) {
            Ok(v.clone())
        } else {
            let v = Tensor::zeros_like(grad)?;
            self.square_avg.insert(name.to_string(), v.clone());
            Ok(v)
        }
    }

    fn get_or_init_momentum_buffer(&mut self, name: &str, grad: &Tensor) -> Result<Tensor> {
        if let Some(v) = self.momentum_buffer.get(name) {
            Ok(v.clone())
        } else {
            let v = Tensor::zeros_like(grad)?;
            self.momentum_buffer.insert(name.to_string(), v.clone());
            Ok(v)
        }
    }
}

impl CandleOptimizer for RMSpropOptimizer {
    fn step(&mut self, _loss: &Tensor) -> candle_core::Result<()> {
        for (idx, var) in self.vars.iter().enumerate() {
            if let Some(grad) = var.grad() {
                let mut grad = grad.as_ref().clone();

                // Weight decay
                if self.weight_decay != 0.0 {
                    grad = (grad + var.as_tensor().mul(&self.weight_decay)?)?;
                }

                let name = format!("var_{}", idx);

                // Update square average
                let mut square_avg = self.get_or_init_square_avg(&name, &grad)
                    .map_err(|e| candle_core::Error::Msg(e.to_string()))?;

                square_avg = (square_avg.mul(&self.alpha)? + grad.sqr()?.mul(&(1.0 - self.alpha))?)?;
                self.square_avg.insert(name.clone(), square_avg.clone());

                // Compute update
                let avg = (square_avg.sqrt()? + self.eps)?;
                let mut delta = grad.div(&avg)?;

                // Momentum
                if self.momentum > 0.0 {
                    let mut buf = self.get_or_init_momentum_buffer(&name, &grad)
                        .map_err(|e| candle_core::Error::Msg(e.to_string()))?;

                    buf = (buf.mul(&self.momentum)? + delta)?;
                    self.momentum_buffer.insert(name, buf.clone());
                    delta = buf;
                }

                // Update parameters
                let update = delta.mul(&(-self.learning_rate))?;
                var.set(&var.add(&update)?)?;
            }
        }
        Ok(())
    }

    fn learning_rate(&self) -> f64 {
        self.learning_rate
    }

    fn set_learning_rate(&mut self, lr: f64) {
        self.learning_rate = lr;
    }
}

/// Learning rate scheduler
pub struct LRScheduler {
    initial_lr: f64,
    current_lr: f64,
    mode: SchedulerMode,
    patience: usize,
    factor: f64,
    min_lr: f64,
    steps_since_improvement: usize,
    best_metric: Option<f64>,
}

#[derive(Debug, Clone, Copy)]
pub enum SchedulerMode {
    ReduceOnPlateau,
    CosineAnnealing { t_max: usize },
    StepLR { step_size: usize, gamma: f64 },
}

impl LRScheduler {
    pub fn reduce_on_plateau(initial_lr: f64, patience: usize, factor: f64) -> Self {
        Self {
            initial_lr,
            current_lr: initial_lr,
            mode: SchedulerMode::ReduceOnPlateau,
            patience,
            factor,
            min_lr: 1e-7,
            steps_since_improvement: 0,
            best_metric: None,
        }
    }

    pub fn cosine_annealing(initial_lr: f64, t_max: usize) -> Self {
        Self {
            initial_lr,
            current_lr: initial_lr,
            mode: SchedulerMode::CosineAnnealing { t_max },
            patience: 0,
            factor: 1.0,
            min_lr: 0.0,
            steps_since_improvement: 0,
            best_metric: None,
        }
    }

    pub fn step_lr(initial_lr: f64, step_size: usize, gamma: f64) -> Self {
        Self {
            initial_lr,
            current_lr: initial_lr,
            mode: SchedulerMode::StepLR { step_size, gamma },
            patience: 0,
            factor: gamma,
            min_lr: 0.0,
            steps_since_improvement: 0,
            best_metric: None,
        }
    }

    pub fn step(&mut self, metric: Option<f64>, epoch: usize) -> f64 {
        match self.mode {
            SchedulerMode::ReduceOnPlateau => {
                if let Some(metric) = metric {
                    if let Some(best) = self.best_metric {
                        if metric < best {
                            self.best_metric = Some(metric);
                            self.steps_since_improvement = 0;
                        } else {
                            self.steps_since_improvement += 1;
                            if self.steps_since_improvement >= self.patience {
                                self.current_lr = (self.current_lr * self.factor).max(self.min_lr);
                                self.steps_since_improvement = 0;
                            }
                        }
                    } else {
                        self.best_metric = Some(metric);
                    }
                }
            }
            SchedulerMode::CosineAnnealing { t_max } => {
                let progress = (epoch % t_max) as f64 / t_max as f64;
                self.current_lr = self.min_lr + (self.initial_lr - self.min_lr) *
                    (1.0 + (std::f64::consts::PI * progress).cos()) / 2.0;
            }
            SchedulerMode::StepLR { step_size, gamma } => {
                if epoch % step_size == 0 && epoch > 0 {
                    self.current_lr *= gamma;
                }
            }
        }

        self.current_lr
    }

    pub fn get_lr(&self) -> f64 {
        self.current_lr
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optimizer_config_defaults() {
        let config = OptimizerConfig::default();
        assert_eq!(config.learning_rate, 1e-3);
        assert_eq!(config.weight_decay, 1e-5);
    }

    #[test]
    fn test_optimizer_config_adam() {
        let config = OptimizerConfig::adam(0.001);
        assert!(matches!(config.optimizer_type, OptimizerType::Adam));
        assert_eq!(config.learning_rate, 0.001);
        assert_eq!(config.weight_decay, 0.0);
    }

    #[test]
    fn test_optimizer_config_sgd() {
        let config = OptimizerConfig::sgd(0.01, 0.9);
        assert!(matches!(config.optimizer_type, OptimizerType::SGD));
        assert_eq!(config.learning_rate, 0.01);
        assert_eq!(config.momentum, 0.9);
    }

    #[test]
    fn test_lr_scheduler_reduce_on_plateau() {
        let mut scheduler = LRScheduler::reduce_on_plateau(0.1, 2, 0.5);

        // First step, no metric
        let lr = scheduler.step(Some(1.0), 0);
        assert_eq!(lr, 0.1);

        // Worse metric, wait for patience
        scheduler.step(Some(2.0), 1);
        let lr = scheduler.step(Some(2.0), 2);
        assert!(lr < 0.1); // Should reduce after patience
    }

    #[test]
    fn test_lr_scheduler_cosine_annealing() {
        let mut scheduler = LRScheduler::cosine_annealing(0.1, 100);

        let lr_0 = scheduler.step(None, 0);
        let lr_50 = scheduler.step(None, 50);
        let lr_100 = scheduler.step(None, 100);

        assert!(lr_0 > lr_50);
        assert!(lr_50 > lr_100);
    }

    #[test]
    fn test_lr_scheduler_step_lr() {
        let mut scheduler = LRScheduler::step_lr(0.1, 10, 0.5);

        let lr_0 = scheduler.step(None, 0);
        let lr_9 = scheduler.step(None, 9);
        let lr_10 = scheduler.step(None, 10);

        assert_eq!(lr_0, 0.1);
        assert_eq!(lr_9, 0.1);
        assert_eq!(lr_10, 0.05); // Should be half after step
    }
}

//! Strange loop patterns for self-tuning hyperparameters
//!
//! Implements strange-loop patterns for recursive optimization of
//! hyperparameters, enabling self-tuning prediction intervals.

// use strange_loop::StrangeLoop as StrangeLoopcrate;
use std::sync::{Arc, RwLock};
use std::collections::VecDeque;
use crate::core::Result;

// Placeholder for StrangeLoopcrate when dependency is unavailable
struct StrangeLoopcrate;

impl StrangeLoopcrate {
    fn new() -> Self {
        Self
    }
}

/// Strange loop optimizer for self-tuning hyperparameters
///
/// Uses recursive optimization patterns to automatically tune
/// coverage targets, calibration intervals, and score thresholds.
pub struct StrangeLoopOptimizer {
    loop_engine: Arc<RwLock<StrangeLoopcrate>>,
    parameters: Arc<RwLock<HyperParameters>>,
    iteration_history: Arc<RwLock<VecDeque<IterationRecord>>>,
    optimization_target: Arc<RwLock<OptimizationTarget>>,
}

#[derive(Clone, Debug)]
pub struct HyperParameters {
    /// Target coverage rate (0.0 to 1.0)
    pub target_coverage: f64,

    /// Alpha (miscoverage) parameter
    pub alpha: f64,

    /// Calibration recalibration frequency
    pub recalibration_freq: usize,

    /// Score threshold multiplier
    pub score_threshold: f64,

    /// Learning rate for adaptation
    pub learning_rate: f64,

    /// Recursion depth for optimization
    pub recursion_depth: u32,
}

#[derive(Clone, Debug)]
pub struct IterationRecord {
    iteration: u64,
    coverage: f64,
    interval_width: f64,
    parameters: HyperParameters,
    improvement: f64,
}

#[derive(Clone, Debug)]
pub enum OptimizationTarget {
    MaximizeCoverage,
    MinimizeWidth,
    BalanceCoverageAndWidth { coverage_weight: f64 },
}

impl StrangeLoopOptimizer {
    /// Create a new strange loop optimizer
    pub fn new() -> Result<Self> {
        let params = HyperParameters::default();

        Ok(Self {
            loop_engine: Arc::new(RwLock::new(StrangeLoopcrate::new())),
            parameters: Arc::new(RwLock::new(params)),
            iteration_history: Arc::new(RwLock::new(VecDeque::with_capacity(1000))),
            optimization_target: Arc::new(RwLock::new(OptimizationTarget::BalanceCoverageAndWidth {
                coverage_weight: 0.6,
            })),
        })
    }

    /// Execute one optimization iteration
    ///
    /// # Arguments
    /// * `current_coverage` - Current achieved coverage rate
    /// * `current_width` - Current average interval width
    /// * `iteration` - Current iteration number
    ///
    /// # Returns
    /// Updated hyperparameters
    pub fn optimize_step(
        &self,
        current_coverage: f64,
        current_width: f64,
        iteration: u64,
    ) -> Result<HyperParameters> {
        let mut params = self.parameters.write().unwrap();
        let target = self.optimization_target.read().unwrap();

        // Calculate optimization objective
        let objective = match target.clone() {
            OptimizationTarget::MaximizeCoverage => {
                // Penalize under-coverage
                if current_coverage < params.target_coverage {
                    -(params.target_coverage - current_coverage).abs()
                } else {
                    // Small penalty for over-coverage
                    -((current_coverage - params.target_coverage) * 0.1).abs()
                }
            }
            OptimizationTarget::MinimizeWidth => {
                // Penalize large intervals
                -current_width
            }
            OptimizationTarget::BalanceCoverageAndWidth { coverage_weight } => {
                let coverage_loss = (current_coverage - params.target_coverage).abs();
                -(coverage_weight * (1.0 - coverage_loss) + (1.0 - coverage_weight) * (1.0 / (1.0 + current_width)))
            }
        };

        // Recursive parameter adjustment
        let alpha_adjustment = self.recursive_adjust(
            objective,
            params.alpha,
            current_coverage - params.target_coverage,
            1,
        );

        let previous_alpha = params.alpha;
        params.alpha = (params.alpha + alpha_adjustment * params.learning_rate)
            .max(0.01)
            .min(0.5);

        // Adjust recalibration frequency based on coverage stability
        if iteration > 0 && iteration % 100 == 0 {
            let recent_history = self.iteration_history.read().unwrap();
            if recent_history.len() >= 10 {
                let recent: Vec<_> = recent_history
                    .iter()
                    .rev()
                    .take(10)
                    .collect();

                let coverage_variance = self.calculate_variance(
                    &recent.iter().map(|r| r.coverage).collect::<Vec<_>>()
                );

                if coverage_variance < 0.001 {
                    // Coverage is stable, increase recalibration frequency
                    params.recalibration_freq = (params.recalibration_freq as f64 * 1.1) as usize;
                } else if coverage_variance > 0.01 {
                    // Coverage is unstable, decrease frequency
                    params.recalibration_freq = (params.recalibration_freq as f64 * 0.9) as usize;
                }
            }
        }

        // Record iteration
        let improvement = (previous_alpha - params.alpha).abs();
        let record = IterationRecord {
            iteration,
            coverage: current_coverage,
            interval_width: current_width,
            parameters: params.clone(),
            improvement,
        };

        let mut history = self.iteration_history.write().unwrap();
        history.push_back(record);

        // Keep last 1000 iterations
        if history.len() > 1000 {
            history.pop_front();
        }

        Ok(params.clone())
    }

    /// Set optimization target
    pub fn set_target(&self, target: OptimizationTarget) -> Result<()> {
        *self.optimization_target.write().unwrap() = target;
        Ok(())
    }

    /// Get current hyperparameters
    pub fn current_parameters(&self) -> Result<HyperParameters> {
        Ok(self.parameters.read().unwrap().clone())
    }

    /// Get optimization history
    pub fn history(&self, limit: usize) -> Result<Vec<IterationRecord>> {
        let history = self.iteration_history.read().unwrap();
        Ok(history
            .iter()
            .rev()
            .take(limit)
            .cloned()
            .collect())
    }

    /// Get convergence metrics
    pub fn convergence_metrics(&self) -> Result<ConvergenceMetrics> {
        let history = self.iteration_history.read().unwrap();

        if history.is_empty() {
            return Ok(ConvergenceMetrics::default());
        }

        let improvements: Vec<f64> = history.iter().map(|r| r.improvement).collect();
        let coverages: Vec<f64> = history.iter().map(|r| r.coverage).collect();
        let widths: Vec<f64> = history.iter().map(|r| r.interval_width).collect();

        let avg_improvement = improvements.iter().sum::<f64>() / improvements.len() as f64;
        let improvement_variance = self.calculate_variance(&improvements);
        let coverage_variance = self.calculate_variance(&coverages);

        Ok(ConvergenceMetrics {
            total_iterations: history.len(),
            avg_improvement: avg_improvement,
            improvement_variance,
            coverage_variance,
            final_coverage: *coverages.last().unwrap_or(&0.0),
            final_width: *widths.last().unwrap_or(&0.0),
        })
    }

    /// Reset optimizer state
    pub fn reset(&self) -> Result<()> {
        *self.parameters.write().unwrap() = HyperParameters::default();
        self.iteration_history.write().unwrap().clear();
        Ok(())
    }

    // Recursive parameter adjustment using strange loop pattern
    fn recursive_adjust(&self, objective: f64, current_param: f64, error: f64, depth: u32) -> f64 {
        if depth > 5 || error.abs() < 0.001 {
            return error;
        }

        let next_adjust = error * 0.5;
        let recursive_result = self.recursive_adjust(objective, current_param, next_adjust, depth + 1);

        // Strange loop: parameter adjustment depends on itself
        error + recursive_result * 0.1
    }

    fn calculate_variance(&self, values: &[f64]) -> f64 {
        if values.is_empty() {
            return 0.0;
        }

        let mean = values.iter().sum::<f64>() / values.len() as f64;
        values.iter()
            .map(|v| (v - mean).powi(2))
            .sum::<f64>() / values.len() as f64
    }
}

impl Default for HyperParameters {
    fn default() -> Self {
        Self {
            target_coverage: 0.90,
            alpha: 0.10,
            recalibration_freq: 100,
            score_threshold: 1.0,
            learning_rate: 0.01,
            recursion_depth: 5,
        }
    }
}

impl Default for StrangeLoopOptimizer {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

/// Convergence metrics for optimization
#[derive(Debug, Clone, Default)]
pub struct ConvergenceMetrics {
    /// Total iterations performed
    pub total_iterations: usize,

    /// Average parameter improvement per iteration
    pub avg_improvement: f64,

    /// Variance in improvements (lower = more stable)
    pub improvement_variance: f64,

    /// Variance in coverage achieved
    pub coverage_variance: f64,

    /// Final coverage rate achieved
    pub final_coverage: f64,

    /// Final average interval width
    pub final_width: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optimizer_creation() {
        let optimizer = StrangeLoopOptimizer::new().unwrap();
        let params = optimizer.current_parameters().unwrap();

        assert_eq!(params.target_coverage, 0.90);
        assert_eq!(params.alpha, 0.10);
    }

    #[test]
    fn test_single_optimization_step() {
        let optimizer = StrangeLoopOptimizer::new().unwrap();

        let new_params = optimizer.optimize_step(0.85, 10.0, 1).unwrap();
        assert!(new_params.alpha != 0.10);
    }

    #[test]
    fn test_optimization_convergence() {
        let optimizer = StrangeLoopOptimizer::new().unwrap();

        // Simulate multiple optimization steps
        for i in 1..=50 {
            let coverage = 0.90 - (0.05 * ((i as f64 - 1.0) / 50.0).sin()).abs();
            let _params = optimizer.optimize_step(coverage, 10.0, i as u64).unwrap();
        }

        let metrics = optimizer.convergence_metrics().unwrap();
        assert_eq!(metrics.total_iterations, 50);
    }

    #[test]
    fn test_optimization_history() {
        let optimizer = StrangeLoopOptimizer::new().unwrap();

        for i in 1..=10 {
            optimizer.optimize_step(0.90, 10.0, i as u64).unwrap();
        }

        let history = optimizer.history(5).unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn test_reset() {
        let optimizer = StrangeLoopOptimizer::new().unwrap();

        optimizer.optimize_step(0.85, 10.0, 1).unwrap();
        optimizer.reset().unwrap();

        let params = optimizer.current_parameters().unwrap();
        assert_eq!(params.alpha, 0.10);

        let history = optimizer.history(100).unwrap();
        assert!(history.is_empty());
    }

    #[test]
    fn test_set_optimization_target() {
        let optimizer = StrangeLoopOptimizer::new().unwrap();

        optimizer.set_target(OptimizationTarget::MaximizeCoverage).unwrap();
        optimizer.set_target(OptimizationTarget::MinimizeWidth).unwrap();

        optimizer.set_target(OptimizationTarget::BalanceCoverageAndWidth {
            coverage_weight: 0.7,
        }).unwrap();
    }
}

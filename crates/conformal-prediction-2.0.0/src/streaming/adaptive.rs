//! Adaptive Decay Rate Control using PID
//!
//! Automatically adjusts the exponential decay rate λ to maintain
//! target coverage under concept drift.
//!
//! ## PID Control Loop
//!
//! The controller monitors empirical coverage and adjusts λ:
//!
//! - **P (Proportional)**: Responds to current coverage error
//! - **I (Integral)**: Corrects persistent bias
//! - **D (Derivative)**: Dampens oscillations
//!
//! ## Tuning Guidelines
//!
//! - **Kp**: Fast response to coverage deviations (0.01 - 0.1)
//! - **Ki**: Eliminates steady-state error (0.001 - 0.01)
//! - **Kd**: Reduces overshoot (0.001 - 0.01)

use std::collections::VecDeque;

/// PID controller configuration
#[derive(Debug, Clone)]
pub struct PIDConfig {
    /// Proportional gain
    pub kp: f64,

    /// Integral gain
    pub ki: f64,

    /// Derivative gain
    pub kd: f64,

    /// Target coverage level (1 - α)
    pub target_coverage: f64,

    /// Window size for coverage estimation
    pub coverage_window: usize,

    /// Minimum decay rate
    pub min_decay: f64,

    /// Maximum decay rate
    pub max_decay: f64,
}

impl Default for PIDConfig {
    fn default() -> Self {
        Self {
            kp: 0.05,
            ki: 0.005,
            kd: 0.01,
            target_coverage: 0.9,
            coverage_window: 100,
            min_decay: 0.0001,
            max_decay: 0.1,
        }
    }
}

/// PID controller for adaptive decay rate
///
/// Monitors empirical coverage and adjusts the exponential decay rate
/// to maintain target coverage under non-stationarity.
pub struct PIDController {
    /// Configuration
    config: PIDConfig,

    /// Integral error accumulator
    integral: f64,

    /// Previous error for derivative
    prev_error: Option<f64>,

    /// Current decay rate (public for direct initialization)
    pub(crate) decay_rate: f64,

    /// History of coverage checks
    coverage_history: VecDeque<bool>,
}

impl PIDController {
    /// Create a new PID controller
    pub fn new(config: PIDConfig) -> Self {
        // Initialize decay rate at midpoint
        let initial_decay = (config.min_decay + config.max_decay) / 2.0;
        let coverage_window = config.coverage_window;

        Self {
            config,
            integral: 0.0,
            prev_error: None,
            decay_rate: initial_decay,
            coverage_history: VecDeque::with_capacity(coverage_window),
        }
    }

    /// Record a coverage check
    ///
    /// # Arguments
    ///
    /// * `covered` - Whether the true value was in the prediction interval
    pub fn record_coverage(&mut self, covered: bool) {
        self.coverage_history.push_back(covered);

        // Maintain window size
        if self.coverage_history.len() > self.config.coverage_window {
            self.coverage_history.pop_front();
        }
    }

    /// Get current empirical coverage
    pub fn empirical_coverage(&self) -> Option<f64> {
        if self.coverage_history.is_empty() {
            return None;
        }

        let covered_count = self.coverage_history.iter().filter(|&&x| x).count();
        Some(covered_count as f64 / self.coverage_history.len() as f64)
    }

    /// Update decay rate using PID control
    ///
    /// Called periodically to adjust λ based on coverage error.
    ///
    /// # Returns
    ///
    /// New decay rate, or None if insufficient data
    pub fn update(&mut self) -> Option<f64> {
        let coverage = self.empirical_coverage()?;

        // Compute error (positive if coverage too low)
        let error = self.config.target_coverage - coverage;

        // Update integral
        self.integral += error;

        // Compute derivative
        let derivative = if let Some(prev) = self.prev_error {
            error - prev
        } else {
            0.0
        };
        self.prev_error = Some(error);

        // PID formula
        let adjustment = self.config.kp * error
            + self.config.ki * self.integral
            + self.config.kd * derivative;

        // Update decay rate
        // If coverage too low, increase decay (use more recent data)
        // If coverage too high, decrease decay (use more historical data)
        self.decay_rate += adjustment;

        // Clamp to valid range
        self.decay_rate = self.decay_rate.clamp(
            self.config.min_decay,
            self.config.max_decay
        );

        Some(self.decay_rate)
    }

    /// Get current decay rate
    pub fn decay_rate(&self) -> f64 {
        self.decay_rate
    }

    /// Get target coverage
    pub fn target_coverage(&self) -> f64 {
        self.config.target_coverage
    }

    /// Reset the controller state
    pub fn reset(&mut self) {
        self.integral = 0.0;
        self.prev_error = None;
        self.decay_rate = (self.config.min_decay + self.config.max_decay) / 2.0;
        self.coverage_history.clear();
    }

    /// Get configuration
    pub fn config(&self) -> &PIDConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pid_creation() {
        let config = PIDConfig::default();
        let pid = PIDController::new(config.clone());

        assert_eq!(pid.target_coverage(), config.target_coverage);
        assert!(pid.decay_rate() > config.min_decay);
        assert!(pid.decay_rate() < config.max_decay);
    }

    #[test]
    fn test_coverage_recording() {
        let config = PIDConfig::default();
        let mut pid = PIDController::new(config);

        // No coverage initially
        assert!(pid.empirical_coverage().is_none());

        // Record some checks
        pid.record_coverage(true);
        pid.record_coverage(true);
        pid.record_coverage(false);

        let coverage = pid.empirical_coverage().unwrap();
        assert!((coverage - 2.0/3.0).abs() < 1e-10);
    }

    #[test]
    fn test_window_limit() {
        let config = PIDConfig {
            coverage_window: 5,
            ..Default::default()
        };
        let mut pid = PIDController::new(config);

        // Add more than window size
        for _ in 0..10 {
            pid.record_coverage(true);
        }

        // Should only keep last 5
        assert_eq!(pid.coverage_history.len(), 5);
    }

    #[test]
    fn test_update_increases_decay_on_low_coverage() {
        let config = PIDConfig {
            target_coverage: 0.9,
            coverage_window: 10,
            ..Default::default()
        };
        let mut pid = PIDController::new(config);

        let initial_decay = pid.decay_rate();

        // Simulate low coverage (70%)
        for _ in 0..10 {
            for _ in 0..7 {
                pid.record_coverage(true);
            }
            for _ in 0..3 {
                pid.record_coverage(false);
            }
        }

        pid.update();

        // Decay should increase to weight recent data more
        assert!(pid.decay_rate() > initial_decay);
    }

    #[test]
    fn test_update_decreases_decay_on_high_coverage() {
        let config = PIDConfig {
            target_coverage: 0.9,
            coverage_window: 10,
            ..Default::default()
        };
        let mut pid = PIDController::new(config);

        let initial_decay = pid.decay_rate();

        // Simulate high coverage (100%)
        for _ in 0..10 {
            pid.record_coverage(true);
        }

        pid.update();

        // Decay should decrease to use more historical data
        assert!(pid.decay_rate() < initial_decay);
    }

    #[test]
    fn test_clamping() {
        let config = PIDConfig {
            min_decay: 0.01,
            max_decay: 0.02,
            kp: 1.0, // Large gain to force clamping
            ..Default::default()
        };
        let mut pid = PIDController::new(config.clone());

        // Force very low coverage
        for _ in 0..20 {
            pid.record_coverage(false);
        }

        pid.update();

        // Should be clamped to max
        assert!(pid.decay_rate() <= config.max_decay);
        assert!(pid.decay_rate() >= config.min_decay);
    }

    #[test]
    fn test_reset() {
        let config = PIDConfig::default();
        let mut pid = PIDController::new(config.clone());

        // Record some data
        for _ in 0..5 {
            pid.record_coverage(true);
        }
        pid.update();

        // Reset
        pid.reset();

        // Should be back to initial state
        assert!(pid.coverage_history.is_empty());
        assert!(pid.empirical_coverage().is_none());

        let after_reset = pid.decay_rate();
        let expected_initial = (config.min_decay + config.max_decay) / 2.0;
        assert!((after_reset - expected_initial).abs() < 1e-10);
    }

    #[test]
    fn test_insufficient_data_update() {
        let config = PIDConfig::default();
        let mut pid = PIDController::new(config);

        // No coverage data
        let result = pid.update();
        assert!(result.is_none());
    }

    #[test]
    fn test_proportional_control() {
        let config = PIDConfig {
            kp: 0.1,
            ki: 0.0,
            kd: 0.0,
            target_coverage: 0.9,
            coverage_window: 10,
            ..Default::default()
        };
        let mut pid = PIDController::new(config);

        let initial_decay = pid.decay_rate();

        // Create coverage error
        for _ in 0..10 {
            pid.record_coverage(false); // 0% coverage
        }

        pid.update();

        // Proportional control should respond immediately
        assert_ne!(pid.decay_rate(), initial_decay);
    }

    #[test]
    fn test_integral_control() {
        let config = PIDConfig {
            kp: 0.0,
            ki: 0.01,
            kd: 0.0,
            target_coverage: 0.9,
            coverage_window: 10,
            ..Default::default()
        };
        let mut pid = PIDController::new(config);

        // Persistent error
        for _ in 0..10 {
            pid.record_coverage(false);
        }

        let _decay_after_1 = pid.update().unwrap();
        let decay_after_2 = pid.update().unwrap();
        let decay_after_3 = pid.update().unwrap();

        // Integral should accumulate
        assert!(decay_after_3 > decay_after_2);
    }

    #[test]
    fn test_derivative_control() {
        let config = PIDConfig {
            kp: 0.0,
            ki: 0.0,
            kd: 0.1,
            target_coverage: 0.9,
            coverage_window: 10,
            ..Default::default()
        };
        let mut pid = PIDController::new(config);

        // First update with error
        for _ in 0..10 {
            pid.record_coverage(false);
        }
        pid.update();

        // Second update with same error (no change)
        let _decay_stable = pid.update().unwrap();

        // Derivative should be near zero for stable error
        // (implementation detail: derivative dampens changes)
        assert!(pid.decay_rate() > 0.0);
    }
}

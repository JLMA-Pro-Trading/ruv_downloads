//! Streaming Conformal Prediction
//!
//! This module implements online/adaptive conformal prediction for non-stationary data:
//!
//! ## Key Components
//!
//! - **Exponentially Weighted CP**: Weights recent calibration scores more heavily
//! - **Adaptive Decay**: PID controller adjusts decay rate to maintain target coverage
//! - **Sliding Window**: Efficient management of calibration history
//!
//! ## Theory
//!
//! In streaming settings, older calibration data may become stale due to:
//! - Concept drift
//! - Non-stationarity
//! - Distribution shift
//!
//! We use exponential weighting: w_i = exp(-λ × (t_current - t_i))
//! where λ is the decay rate, adaptively tuned via PID control.
//!
//! ## Example
//!
//! ```rust,no_run
//! use conformal_prediction::streaming::StreamingConformalPredictor;
//!
//! let mut predictor = StreamingConformalPredictor::new(0.1, 0.01);
//!
//! // Update with new observations
//! predictor.update(&[1.0, 2.0], 5.0, 4.8);
//!
//! // Predict interval
//! // let (lower, upper) = predictor.predict_interval(0.5)?;
//! ```

pub mod ewcp;
pub mod adaptive;
pub mod window;

pub use ewcp::StreamingConformalPredictor;
pub use adaptive::{PIDController, PIDConfig};
pub use window::{SlidingWindow, WindowConfig};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_exports() {
        // Ensure all public types are accessible
        let _predictor = StreamingConformalPredictor::new(0.1, 0.01);
        let _pid = PIDController::new(PIDConfig::default());
        let _window = SlidingWindow::new(WindowConfig::default());
    }
}

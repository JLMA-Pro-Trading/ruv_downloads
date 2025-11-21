//! # Neural Trader Predictor
//!
//! Conformal prediction SDK for neural trading with guaranteed prediction intervals.
//!
//! ## Features
//!
//! - **Split Conformal Prediction**: Distribution-free prediction intervals with provable coverage
//! - **Adaptive Conformal Inference (ACI)**: PID-controlled dynamic coverage adjustment
//! - **Conformalized Quantile Regression (CQR)**: Quantile-based prediction intervals
//! - **Multiple Nonconformity Scores**: Absolute, normalized, and quantile-based scores
//! - **High-Performance Optimizations**: Nanosecond scheduling, sublinear algorithms, temporal lead solving
//! - **Hybrid Integration**: CPD and PCP features via conformal-prediction crate
//!
//! ## Quick Start
//!
//! ```rust
//! use neural_trader_predictor::{ConformalPredictor, scores::AbsoluteScore};
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // Create predictor with 90% coverage (alpha = 0.1)
//! let mut predictor = ConformalPredictor::new(0.1, AbsoluteScore);
//!
//! // Calibrate with historical data
//! let predictions = vec![100.0, 105.0, 98.0, 102.0];
//! let actuals = vec![102.0, 104.0, 99.0, 101.0];
//! predictor.calibrate(&predictions, &actuals)?;
//!
//! // Make prediction with guaranteed interval
//! let interval = predictor.predict(103.0);
//! println!("Prediction: {} [{}, {}]", interval.point, interval.lower, interval.upper);
//! # Ok(())
//! # }
//! ```

pub mod core;
pub mod conformal;
pub mod scores;
pub mod optimizers;
pub mod integration;

#[cfg(feature = "cli")]
pub mod cli;

// Re-exports for convenience
pub use core::{
    types::{PredictionInterval, PredictorConfig},
    errors::{Error, Result},
    traits::{NonconformityScore, BaseModel},
};

pub use conformal::{
    split::SplitConformalPredictor,
    adaptive::AdaptiveConformalPredictor,
    cqr::CQRPredictor,
};

pub use scores::{
    absolute::AbsoluteScore,
    normalized::NormalizedScore,
    quantile::QuantileScore,
};

pub use integration::{
    HybridPredictor,
    CPDWrapper,
    PCPWrapper,
};

// Type alias for common usage
pub type ConformalPredictor = SplitConformalPredictor<AbsoluteScore>;

/// Library version
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version() {
        assert!(!VERSION.is_empty());
    }
}

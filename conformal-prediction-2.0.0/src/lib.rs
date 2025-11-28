//! # Conformal Prediction with Lean-Agentic
//!
//! This crate explores conformal prediction techniques using:
//! - `lean-agentic`: For formal verification and type-safe guarantees
//! - `random-world`: For conformal prediction algorithms
//!
//! ## Overview
//!
//! Conformal prediction is a framework for creating prediction regions that have
//! guaranteed validity under minimal assumptions. This crate combines:
//!
//! 1. **Conformal Prediction** (via `random-world`):
//!    - Provides prediction intervals with guaranteed coverage
//!    - Works with any underlying ML model
//!    - No distributional assumptions required
//!
//! 2. **Formal Verification** (via `lean-agentic`):
//!    - Type-safe term construction
//!    - Hash-consed equality checks (150x faster)
//!    - Proof-carrying code for prediction guarantees
//!
//! ## Key Concepts
//!
//! ### Conformal Prediction
//!
//! Given a significance level α (e.g., 0.1 for 90% confidence):
//! - Conformal predictors output prediction sets/regions
//! - Guarantee: P(y_true ∈ prediction_set) ≥ 1 - α
//! - Works by computing "nonconformity scores"
//!
//! ### Lean-Agentic Integration
//!
//! - Formally verify prediction properties
//! - Type-safe prediction intervals
//! - Proof certificates for prediction validity
//!
//! ## Examples
//!
//! ```rust,no_run
//! use conformal_prediction::{ConformalPredictor, KNNNonconformity};
//!
//! # fn main() -> conformal_prediction::Result<()> {
//! // Create a k-NN nonconformity measure
//! let mut measure = KNNNonconformity::new(5);
//!
//! // Create a conformal predictor with 90% confidence
//! let mut predictor = ConformalPredictor::new(0.1, measure)?;
//!
//! // Train on calibration data
//! // predictor.calibrate(&cal_x, &cal_y)?;
//!
//! // Make predictions with guaranteed coverage
//! // let (lower, upper) = predictor.predict_interval(&test_x, point_estimate)?;
//! # Ok(())
//! # }
//! ```

use lean_agentic::{Arena, Environment, SymbolTable};
use lean_agentic::level::LevelArena;

pub mod predictor;
pub mod nonconformity;
pub mod verified;
pub mod streaming;
pub mod cpd;
pub mod pcp;

pub use predictor::ConformalPredictor;
pub use nonconformity::{NonconformityMeasure, KNNNonconformity};
pub use verified::{VerifiedPrediction, VerifiedPredictionBuilder, PredictionValue};
pub use cpd::ConformalCDF;
pub use pcp::PosteriorConformalPredictor;

/// Result type for conformal prediction operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for conformal prediction
#[derive(Debug, Clone)]
pub enum Error {
    /// Insufficient calibration data
    InsufficientData(String),

    /// Invalid significance level (must be in (0, 1))
    InvalidSignificance(f64),

    /// Prediction error
    PredictionError(String),

    /// Verification error
    VerificationError(String),

    /// Type checking error from lean-agentic
    TypeCheckError(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::InsufficientData(msg) => write!(f, "Insufficient calibration data: {}", msg),
            Error::InvalidSignificance(alpha) => write!(f, "Invalid significance level: {} (must be in (0, 1))", alpha),
            Error::PredictionError(msg) => write!(f, "Prediction error: {}", msg),
            Error::VerificationError(msg) => write!(f, "Verification error: {}", msg),
            Error::TypeCheckError(msg) => write!(f, "Type check error: {}", msg),
        }
    }
}

impl std::error::Error for Error {}

impl From<lean_agentic::Error> for Error {
    fn from(err: lean_agentic::Error) -> Self {
        Error::TypeCheckError(err.to_string())
    }
}

/// Core context for conformal prediction with formal verification
pub struct ConformalContext {
    /// Arena for term allocation
    pub arena: Arena,

    /// Symbol table for naming
    pub symbols: SymbolTable,

    /// Universe levels
    pub levels: LevelArena,

    /// Environment for definitions
    pub environment: Environment,
}

impl ConformalContext {
    /// Create a new conformal prediction context
    pub fn new() -> Self {
        Self {
            arena: Arena::new(),
            symbols: SymbolTable::new(),
            levels: LevelArena::new(),
            environment: Environment::new(),
        }
    }
}

impl Default for ConformalContext {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_creation() {
        let ctx = ConformalContext::new();
        assert!(ctx.arena.terms() == 0);
    }
}

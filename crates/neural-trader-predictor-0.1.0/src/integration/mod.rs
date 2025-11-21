//! Integration with `conformal-prediction` crate for advanced features
//!
//! This module provides a hybrid approach that combines:
//! - Our optimized split conformal prediction (fast, trading-focused)
//! - Advanced features from `conformal-prediction` crate (CPD, PCP, verification)
//!
//! ## Features
//!
//! - **CPD (Conformal Predictive Distributions)**: Full probability distributions
//! - **PCP (Posterior Conformal Prediction)**: Cluster-aware predictions
//! - **Formal Verification**: Lean4 mathematical proofs
//! - **Streaming Calibration**: Real-time adaptation

pub mod hybrid;
pub mod cpd_wrapper;
pub mod pcp_wrapper;

pub use hybrid::HybridPredictor;
pub use cpd_wrapper::CPDWrapper;
pub use pcp_wrapper::PCPWrapper;

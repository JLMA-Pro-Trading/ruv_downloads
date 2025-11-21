//! Conformal prediction algorithms

pub mod split;
pub mod adaptive;
pub mod cqr;

pub use split::SplitConformalPredictor;
pub use adaptive::AdaptiveConformalPredictor;
pub use cqr::CQRPredictor;

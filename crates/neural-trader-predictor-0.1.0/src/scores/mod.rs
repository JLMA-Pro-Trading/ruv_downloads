//! Nonconformity score functions

pub mod absolute;
pub mod normalized;
pub mod quantile;

pub use absolute::AbsoluteScore;
pub use normalized::NormalizedScore;
pub use quantile::QuantileScore;

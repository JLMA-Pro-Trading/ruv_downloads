//! Utility functions for neural module

pub mod features;
pub mod memory_pool;
pub mod metrics;
pub mod preprocessing;
pub mod preprocessing_optimized;
pub mod synthetic;
pub mod validation;

#[cfg(feature = "simd")]
pub mod simd;

// Re-export commonly used items
pub use metrics::{
    EvaluationMetrics,
    mean_absolute_error,
    root_mean_squared_error,
    mean_absolute_percentage_error,
    r2,
};

pub use preprocessing::{
    NormalizationParams,
    normalize,
    denormalize,
    min_max_normalize,
    min_max_denormalize,
    difference,
    detrend,
    seasonal_decompose,
};

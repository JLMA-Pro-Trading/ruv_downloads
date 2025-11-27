//! # Intrinsic Dimensionality Estimation
//!
//! Discover the true dimensionality of your data for automatic model compression.
//!
//! ## Quick Example
//!
//! ```rust,ignore
//! use intrinsic_dim::Estimator;
//!
//! let data = vec![vec![1.0; 1000]; 100]; // 1000D data
//! let estimator = Estimator::new();
//! let dim = estimator.estimate(&data).unwrap();
//!
//! println!("True complexity: {} dimensions", dim.intrinsic_dim);
//! println!("Compression possible: {}x", dim.compression_ratio);
//! ```

pub mod estimators;
pub mod fourier;
pub mod utils;
pub mod benchmarks;

pub use crate::estimators::*;
pub use crate::fourier::FourierEstimator;
pub use crate::utils::*;

use std::time::Instant;

use serde::{Deserialize, Serialize};

/// Main result structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DimensionalityResult {
    pub intrinsic_dim: usize,
    pub original_dim: usize,
    pub compression_ratio: f64,
    pub confidence_interval: (f64, f64),
    pub method: String,
    pub sparsity: Option<f64>,
}

/// Main estimator
pub struct Estimator {
    method: EstimationMethod,
}

#[derive(Debug, Clone, Copy)]
pub enum EstimationMethod {
    PCA,
    FourierEmergence,
    MLE,
    TwoNN,
}

impl Estimator {
    pub fn new() -> Self {
        Self {
            method: EstimationMethod::FourierEmergence,
        }
    }

    pub fn with_method(method: EstimationMethod) -> Self {
        Self { method }
    }

    pub fn estimate(&self, data: &[Vec<f64>]) -> Result<DimensionalityResult, String> {
        if data.is_empty() || data[0].is_empty() {
            return Err("Empty data".to_string());
        }

        let original_dim = data[0].len();
        let start = Instant::now();

        let (intrinsic_dim, sparsity) = match self.method {
            EstimationMethod::PCA => (estimators::pca::estimate(data)?, None),
            EstimationMethod::FourierEmergence => {
                let fourier = FourierEstimator::new(original_dim, original_dim * 3);
                let dim = fourier.estimate_from_data(data)?;
                let sparsity = fourier.get_sparsity();
                (dim, Some(sparsity))
            }
            EstimationMethod::MLE => (estimators::mle::estimate(data)?, None),
            EstimationMethod::TwoNN => (estimators::twonn::estimate(data)?, None),
        };

        let _elapsed = start.elapsed().as_secs_f64();

        // Calculate confidence based on data size and method
        let confidence = self.calculate_confidence(data.len(), intrinsic_dim);

        Ok(DimensionalityResult {
            intrinsic_dim,
            original_dim,
            compression_ratio: original_dim as f64 / intrinsic_dim.max(1) as f64,
            confidence_interval: confidence,
            method: format!("{:?}", self.method),
            sparsity,
        })
    }

    fn calculate_confidence(&self, n_samples: usize, dim: usize) -> (f64, f64) {
        // Better confidence estimation based on sample size
        let std_err = (dim as f64 / n_samples as f64).sqrt();
        let lower = (dim as f64 - 1.96 * std_err).max(1.0);
        let upper = dim as f64 + 1.96 * std_err;
        (lower, upper)
    }

    /// Fast estimation using subsampling for large datasets
    pub fn estimate_fast(&self, data: &[Vec<f64>], max_samples: usize) -> Result<DimensionalityResult, String> {
        let subset = if data.len() > max_samples {
            // Random subsample for speed
            use rand::seq::SliceRandom;
            let mut rng = rand::thread_rng();
            let mut indices: Vec<usize> = (0..data.len()).collect();
            indices.shuffle(&mut rng);
            indices[..max_samples]
                .iter()
                .map(|&i| data[i].clone())
                .collect::<Vec<_>>()
        } else {
            data.to_vec()
        };

        self.estimate(&subset)
    }
}

impl Default for Estimator {
    fn default() -> Self {
        Self::new()
    }
}
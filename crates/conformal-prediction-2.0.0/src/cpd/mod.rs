//! # Conformal Predictive Distribution (CPD)
//!
//! This module implements Conformal Predictive Distributions, which provide
//! full probability distributions for predictions rather than just confidence intervals.
//!
//! ## Key Components
//!
//! - **`ConformalCDF`**: Core struct representing a cumulative distribution function
//!   derived from conformal prediction calibration scores
//! - **Calibration**: Generate CPDs from calibration data and nonconformity measures
//! - **Quantile Computation**: Efficient inverse CDF operations for interval prediction
//!
//! ## Mathematical Foundation
//!
//! For calibration scores α₁ ≤ α₂ ≤ ... ≤ αₙ and candidate value y:
//!
//! 1. Compute nonconformity score: α(y) = A(x, y)
//! 2. Calculate p-value: p = (#{i: αᵢ ≥ α(y)} + 1) / (n + 1)
//! 3. CDF value: Q(y) = 1 - p
//!
//! The resulting CDF Q(y) provides a full predictive distribution with:
//! - `cdf(y)`: Probability that true value ≤ y
//! - `quantile(p)`: Value y such that P(Y ≤ y) = p
//! - `sample()`: Random sampling from the predictive distribution
//!
//! ## Performance
//!
//! - CDF queries: O(log n) via binary search on sorted scores
//! - Quantile queries: O(log n) for inverse CDF
//! - Memory: O(n) for calibration scores
//!
//! ## Example
//!
//! ```rust
//! use conformal_prediction::cpd::{ConformalCDF, calibrate_cpd};
//! use conformal_prediction::KNNNonconformity;
//!
//! # fn example() -> conformal_prediction::Result<()> {
//! // Calibration data
//! let cal_scores = vec![0.5, 1.0, 1.5, 2.0, 2.5];
//!
//! // Create CDF from sorted calibration scores
//! let cdf = ConformalCDF::from_sorted_scores(cal_scores)?;
//!
//! // Query CDF at a point
//! let prob = cdf.cdf(1.2);  // P(Y ≤ 1.2)
//!
//! // Get quantile (inverse CDF)
//! let median = cdf.quantile(0.5)?;  // 50th percentile
//!
//! // Sample from distribution
//! let mut rng = rand::thread_rng();
//! let sample = cdf.sample(&mut rng)?;
//!
//! // Distribution moments
//! let mean = cdf.mean();
//! let variance = cdf.variance();
//! # Ok(())
//! # }
//! ```

mod distribution;
mod quantile;
mod calibration;

pub use distribution::ConformalCDF;
pub use quantile::{
    compute_quantile,
    linear_interpolate,
    compute_quantiles_batch,
    compute_cdf,
    compute_cdf_batch,
};
pub use calibration::{
    calibrate_cpd,
    calibrate_cpd_batch,
    transductive_cpd,
    create_y_grid,
};

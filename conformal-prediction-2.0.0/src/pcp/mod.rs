//! Posterior Conformal Prediction with Clustering
//!
//! This module implements cluster-aware conformal prediction that adapts prediction
//! intervals based on the local structure of the input space.
//!
//! # Overview
//!
//! Posterior Conformal Prediction (PCP) improves upon standard conformal prediction by:
//! 1. Clustering the calibration data into K groups
//! 2. Learning separate residual distributions for each cluster
//! 3. Providing cluster-specific prediction intervals
//!
//! # Theory
//!
//! Standard conformal prediction provides marginal coverage:
//! P(Y ∈ C(X)) ≥ 1 - α
//!
//! PCP provides cluster-conditional coverage while maintaining marginal guarantees:
//! - For each cluster k: P(Y ∈ C(X) | X ∈ cluster k) ≈ 1 - α
//! - Overall: P(Y ∈ C(X)) ≥ 1 - α (guaranteed)
//!
//! # Algorithm
//!
//! 1. **Training Phase**:
//!    - Cluster calibration features {x₁, ..., xₙ} into K groups using k-means
//!    - For each cluster k, store residuals {rᵢ⁽ᵏ⁾}
//!
//! 2. **Prediction Phase**:
//!    - For new input x:
//!      - Find nearest cluster(s) (hard or soft assignment)
//!      - Use cluster-specific residual quantiles
//!      - Blend if multiple clusters are likely
//!
//! # Example
//!
//! ```rust,no_run
//! use conformal_prediction::pcp::PosteriorConformalPredictor;
//!
//! # fn main() -> conformal_prediction::Result<()> {
//! // Create predictor with 90% confidence
//! let mut predictor = PosteriorConformalPredictor::new(0.1)?;
//!
//! // Fit on calibration data with 3 clusters
//! let cal_x = vec![vec![1.0, 2.0], vec![2.0, 3.0]];
//! let cal_y = vec![1.0, 2.0];
//! let predictions = vec![1.1, 1.9]; // Model predictions
//!
//! predictor.fit(&cal_x, &cal_y, &predictions, 3)?;
//!
//! // Predict with cluster-aware intervals
//! let test_x = vec![1.5, 2.5];
//! let point_pred = 1.5;
//! let (lower, upper) = predictor.predict_cluster_aware(&test_x, point_pred)?;
//! # Ok(())
//! # }
//! ```

pub mod clustering;
pub mod mixture;
pub mod predictor;

pub use clustering::{KMeans, ClusterAssignment};
pub use mixture::MixtureModel;
pub use predictor::PosteriorConformalPredictor;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_module_exports() {
        // Ensure all public types are accessible
        let _kmeans = KMeans::new(3, 100);
        let _mixture = MixtureModel::new(3);
    }
}

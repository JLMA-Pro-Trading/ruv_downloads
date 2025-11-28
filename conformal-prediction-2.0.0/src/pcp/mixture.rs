//! Mixture model for cluster-aware residual distributions
//!
//! This module implements a mixture of empirical distributions, one per cluster,
//! for computing cluster-conditional conformal prediction intervals.

use crate::{Error, Result};

/// Mixture model for residual distributions
///
/// # Theory
///
/// For K clusters, we maintain K separate residual distributions.
/// When predicting for a new point x:
///
/// 1. **Hard clustering**: Use single cluster's residual quantile
///    - Find k* = argmin_k ||x - centroid_k||
///    - Use quantile from residuals in cluster k*
///
/// 2. **Soft clustering**: Blend residual quantiles
///    - Compute P(cluster k | x) for all k
///    - Weighted quantile: Q = Σ_k P(k|x) × Q_k
///
/// # Guarantee
///
/// While providing cluster-conditional adaptation, maintains marginal coverage:
/// P(Y ∈ C(X)) ≥ 1 - α
#[derive(Clone, Debug)]
pub struct MixtureModel {
    /// Number of clusters
    n_clusters: usize,

    /// Residuals per cluster (cluster_id → residuals)
    cluster_residuals: Vec<Vec<f64>>,

    /// Whether the model has been fitted
    fitted: bool,
}

impl MixtureModel {
    /// Create a new mixture model
    ///
    /// # Arguments
    ///
    /// * `n_clusters` - Number of clusters
    pub fn new(n_clusters: usize) -> Self {
        Self {
            n_clusters,
            cluster_residuals: vec![Vec::new(); n_clusters],
            fitted: false,
        }
    }

    /// Fit the mixture model on residuals and cluster assignments
    ///
    /// # Arguments
    ///
    /// * `residuals` - Absolute residuals from calibration set
    /// * `cluster_assignments` - Cluster index for each residual
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Mismatched lengths
    /// - Invalid cluster indices
    /// - Empty data
    pub fn fit(&mut self, residuals: &[f64], cluster_assignments: &[usize]) -> Result<()> {
        if residuals.len() != cluster_assignments.len() {
            return Err(Error::InsufficientData(format!(
                "Mismatched lengths: {} residuals vs {} assignments",
                residuals.len(),
                cluster_assignments.len()
            )));
        }

        if residuals.is_empty() {
            return Err(Error::InsufficientData("Empty residuals".to_string()));
        }

        // Clear previous residuals
        self.cluster_residuals = vec![Vec::new(); self.n_clusters];

        // Group residuals by cluster
        for (&residual, &cluster) in residuals.iter().zip(cluster_assignments.iter()) {
            if cluster >= self.n_clusters {
                return Err(Error::PredictionError(format!(
                    "Invalid cluster index: {} (max: {})",
                    cluster,
                    self.n_clusters - 1
                )));
            }
            self.cluster_residuals[cluster].push(residual);
        }

        // Sort residuals in each cluster for quantile computation
        for cluster_res in &mut self.cluster_residuals {
            cluster_res.sort_by(|a, b| a.partial_cmp(b).unwrap());
        }

        self.fitted = true;
        Ok(())
    }

    /// Get quantile for a specific cluster
    ///
    /// # Arguments
    ///
    /// * `cluster` - Cluster index
    /// * `alpha` - Significance level
    ///
    /// # Returns
    ///
    /// The (1 - α) quantile of residuals in the cluster
    ///
    /// # Theory
    ///
    /// For cluster k with residuals {r₁⁽ᵏ⁾, ..., rₙ⁽ᵏ⁾}:
    /// Q_{1-α}⁽ᵏ⁾ = quantile(residuals, 1 - α)
    pub fn cluster_quantile(&self, cluster: usize, alpha: f64) -> Result<f64> {
        if !self.fitted {
            return Err(Error::PredictionError("Model not fitted".to_string()));
        }

        if cluster >= self.n_clusters {
            return Err(Error::PredictionError(format!(
                "Invalid cluster index: {}",
                cluster
            )));
        }

        let residuals = &self.cluster_residuals[cluster];

        if residuals.is_empty() {
            // Fall back to global quantile if cluster is empty
            return self.global_quantile(alpha);
        }

        let quantile_level = 1.0 - alpha;
        let idx = ((quantile_level * residuals.len() as f64).ceil() as usize)
            .min(residuals.len() - 1);

        Ok(residuals[idx])
    }

    /// Get weighted quantile across clusters
    ///
    /// # Arguments
    ///
    /// * `cluster_probs` - Probability of each cluster
    /// * `alpha` - Significance level
    ///
    /// # Returns
    ///
    /// Weighted quantile: Σ_k P(k) × Q_{1-α}⁽ᵏ⁾
    ///
    /// # Theory
    ///
    /// Soft assignment blends cluster-specific intervals:
    /// - Compute Q_k for each cluster k
    /// - Weight by cluster probabilities P(k|x)
    /// - Result adapts to local structure while remaining conservative
    pub fn weighted_quantile(&self, cluster_probs: &[f64], alpha: f64) -> Result<f64> {
        if !self.fitted {
            return Err(Error::PredictionError("Model not fitted".to_string()));
        }

        if cluster_probs.len() != self.n_clusters {
            return Err(Error::PredictionError(format!(
                "Expected {} cluster probabilities, got {}",
                self.n_clusters,
                cluster_probs.len()
            )));
        }

        // Validate probabilities
        let sum: f64 = cluster_probs.iter().sum();
        if (sum - 1.0).abs() > 1e-6 {
            return Err(Error::PredictionError(format!(
                "Cluster probabilities must sum to 1.0, got {}",
                sum
            )));
        }

        // Weighted average of cluster quantiles
        let mut weighted_quantile = 0.0;

        for (cluster, &prob) in cluster_probs.iter().enumerate() {
            let cluster_q = self.cluster_quantile(cluster, alpha)?;
            weighted_quantile += prob * cluster_q;
        }

        Ok(weighted_quantile)
    }

    /// Get global quantile across all clusters
    ///
    /// # Arguments
    ///
    /// * `alpha` - Significance level
    ///
    /// # Returns
    ///
    /// Global (1 - α) quantile across all residuals
    ///
    /// This is used as a fallback and provides standard conformal prediction.
    pub fn global_quantile(&self, alpha: f64) -> Result<f64> {
        if !self.fitted {
            return Err(Error::PredictionError("Model not fitted".to_string()));
        }

        // Merge all residuals
        let mut all_residuals: Vec<f64> = self
            .cluster_residuals
            .iter()
            .flat_map(|r| r.iter().copied())
            .collect();

        if all_residuals.is_empty() {
            return Err(Error::PredictionError("No residuals available".to_string()));
        }

        all_residuals.sort_by(|a, b| a.partial_cmp(b).unwrap());

        let quantile_level = 1.0 - alpha;
        let idx = ((quantile_level * all_residuals.len() as f64).ceil() as usize)
            .min(all_residuals.len() - 1);

        Ok(all_residuals[idx])
    }

    /// Get number of residuals in each cluster
    pub fn cluster_sizes(&self) -> Vec<usize> {
        self.cluster_residuals
            .iter()
            .map(|r| r.len())
            .collect()
    }

    /// Check if model is fitted
    pub fn is_fitted(&self) -> bool {
        self.fitted
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mixture_model_creation() {
        let model = MixtureModel::new(3);
        assert!(!model.is_fitted());
        assert_eq!(model.n_clusters, 3);
    }

    #[test]
    fn test_fit_and_cluster_quantile() {
        let mut model = MixtureModel::new(2);

        // Cluster 0: small residuals, Cluster 1: large residuals
        let residuals = vec![0.1, 0.2, 0.3, 5.0, 6.0, 7.0];
        let assignments = vec![0, 0, 0, 1, 1, 1];

        model.fit(&residuals, &assignments).unwrap();
        assert!(model.is_fitted());

        // Cluster 0 should have smaller quantile
        let q0 = model.cluster_quantile(0, 0.1).unwrap();
        let q1 = model.cluster_quantile(1, 0.1).unwrap();

        assert!(q0 < q1);
        assert!(q0 <= 0.3);
        assert!(q1 >= 5.0);
    }

    #[test]
    fn test_weighted_quantile() {
        let mut model = MixtureModel::new(2);

        let residuals = vec![1.0, 2.0, 10.0, 20.0];
        let assignments = vec![0, 0, 1, 1];

        model.fit(&residuals, &assignments).unwrap();

        // Equal weighting
        let probs = vec![0.5, 0.5];
        let q_weighted = model.weighted_quantile(&probs, 0.1).unwrap();

        let q0 = model.cluster_quantile(0, 0.1).unwrap();
        let q1 = model.cluster_quantile(1, 0.1).unwrap();

        // Should be average
        assert!((q_weighted - (q0 + q1) / 2.0).abs() < 1e-6);

        // Heavily weight first cluster
        let probs = vec![0.9, 0.1];
        let q_weighted = model.weighted_quantile(&probs, 0.1).unwrap();
        assert!(q_weighted < 5.0); // Closer to small residuals
    }

    #[test]
    fn test_global_quantile() {
        let mut model = MixtureModel::new(2);

        let residuals = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let assignments = vec![0, 0, 1, 1, 1];

        model.fit(&residuals, &assignments).unwrap();

        let q_global = model.global_quantile(0.1).unwrap();

        // Should be high percentile of all residuals
        assert!(q_global >= 4.0);
    }

    #[test]
    fn test_cluster_sizes() {
        let mut model = MixtureModel::new(3);

        let residuals = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let assignments = vec![0, 0, 1, 1, 2];

        model.fit(&residuals, &assignments).unwrap();

        let sizes = model.cluster_sizes();
        assert_eq!(sizes, vec![2, 2, 1]);
    }

    #[test]
    fn test_invalid_cluster_index() {
        let mut model = MixtureModel::new(2);

        let residuals = vec![1.0, 2.0];
        let assignments = vec![0, 3]; // Invalid cluster 3

        let result = model.fit(&residuals, &assignments);
        assert!(result.is_err());
    }

    #[test]
    fn test_mismatched_lengths() {
        let mut model = MixtureModel::new(2);

        let residuals = vec![1.0, 2.0, 3.0];
        let assignments = vec![0, 1]; // Wrong length

        let result = model.fit(&residuals, &assignments);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_probabilities() {
        let mut model = MixtureModel::new(2);

        let residuals = vec![1.0, 2.0];
        let assignments = vec![0, 1];
        model.fit(&residuals, &assignments).unwrap();

        // Probabilities don't sum to 1
        let probs = vec![0.5, 0.6];
        let result = model.weighted_quantile(&probs, 0.1);
        assert!(result.is_err());
    }
}

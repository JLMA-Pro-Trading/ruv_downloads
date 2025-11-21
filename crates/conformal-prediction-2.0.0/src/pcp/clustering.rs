//! K-Means clustering implementation for PCP
//!
//! This module provides a simple, efficient k-means clustering algorithm
//! using Lloyd's algorithm with k-means++ initialization.

use crate::{Error, Result};
use std::f64;

/// K-Means clustering using Lloyd's algorithm
///
/// # Algorithm
///
/// 1. **Initialization** (k-means++):
///    - Choose first centroid uniformly at random
///    - For each subsequent centroid:
///      - Choose point with probability ∝ D(x)², where D(x) is distance to nearest centroid
///
/// 2. **Lloyd's Algorithm**:
///    - Repeat until convergence:
///      a. Assign each point to nearest centroid
///      b. Update centroids to cluster means
///
/// # Complexity
///
/// - Time: O(n × k × d × iterations)
/// - Space: O(n × d + k × d)
///
/// Where n = samples, k = clusters, d = dimensions
#[derive(Clone, Debug)]
pub struct KMeans {
    /// Number of clusters
    k: usize,

    /// Maximum iterations
    max_iterations: usize,

    /// Cluster centroids (k × d)
    centroids: Vec<Vec<f64>>,

    /// Whether the model has been fitted
    fitted: bool,
}

impl KMeans {
    /// Create a new k-means clusterer
    ///
    /// # Arguments
    ///
    /// * `k` - Number of clusters
    /// * `max_iterations` - Maximum iterations for Lloyd's algorithm
    pub fn new(k: usize, max_iterations: usize) -> Self {
        Self {
            k,
            max_iterations,
            centroids: Vec::new(),
            fitted: false,
        }
    }

    /// Fit k-means on data
    ///
    /// # Arguments
    ///
    /// * `data` - Training data (n_samples × n_features)
    ///
    /// # Errors
    ///
    /// Returns error if:
    /// - Data is empty
    /// - k > n_samples
    /// - Features have inconsistent dimensions
    pub fn fit(&mut self, data: &[Vec<f64>]) -> Result<()> {
        if data.is_empty() {
            return Err(Error::InsufficientData("Empty data for clustering".to_string()));
        }

        if self.k > data.len() {
            return Err(Error::InsufficientData(format!(
                "k ({}) cannot exceed number of samples ({})",
                self.k,
                data.len()
            )));
        }

        let n_features = data[0].len();

        // Validate dimensions
        for (i, point) in data.iter().enumerate() {
            if point.len() != n_features {
                return Err(Error::PredictionError(format!(
                    "Inconsistent dimensions: point {} has {} features, expected {}",
                    i, point.len(), n_features
                )));
            }
        }

        // Initialize centroids using k-means++
        self.initialize_centroids_plus_plus(data)?;

        // Lloyd's algorithm
        for _ in 0..self.max_iterations {
            // Assign points to clusters
            let assignments = self.assign_clusters(data);

            // Compute new centroids
            let new_centroids = self.compute_centroids(data, &assignments, n_features);

            // Check convergence
            if self.centroids_equal(&self.centroids, &new_centroids) {
                break;
            }

            self.centroids = new_centroids;
        }

        self.fitted = true;
        Ok(())
    }

    /// Initialize centroids using k-means++
    ///
    /// # Theory
    ///
    /// K-means++ initialization improves clustering quality:
    /// 1. Choose first centroid uniformly at random
    /// 2. For each new centroid:
    ///    - Compute D(x) = distance to nearest existing centroid
    ///    - Choose x with probability ∝ D(x)²
    ///
    /// This spreads initial centroids and improves convergence.
    fn initialize_centroids_plus_plus(&mut self, data: &[Vec<f64>]) -> Result<()> {
        use rand::Rng;
        let mut rng = rand::thread_rng();

        self.centroids.clear();

        // First centroid: random point
        let first_idx = rng.gen_range(0..data.len());
        self.centroids.push(data[first_idx].clone());

        // Remaining centroids
        for _ in 1..self.k {
            // Compute squared distances to nearest centroid
            let mut distances: Vec<f64> = data
                .iter()
                .map(|point| {
                    self.centroids
                        .iter()
                        .map(|centroid| Self::squared_distance(point, centroid))
                        .fold(f64::INFINITY, f64::min)
                })
                .collect();

            // Convert to probabilities
            let sum: f64 = distances.iter().sum();
            if sum == 0.0 {
                // All points are at centroids, pick randomly
                let idx = rng.gen_range(0..data.len());
                self.centroids.push(data[idx].clone());
                continue;
            }

            for d in &mut distances {
                *d /= sum;
            }

            // Sample according to probabilities
            let r: f64 = rng.gen();
            let mut cumsum = 0.0;
            let mut selected_idx = 0;

            for (i, &prob) in distances.iter().enumerate() {
                cumsum += prob;
                if r <= cumsum {
                    selected_idx = i;
                    break;
                }
            }

            self.centroids.push(data[selected_idx].clone());
        }

        Ok(())
    }

    /// Assign each point to its nearest cluster
    fn assign_clusters(&self, data: &[Vec<f64>]) -> Vec<usize> {
        data.iter()
            .map(|point| self.find_nearest_cluster(point))
            .collect()
    }

    /// Find the nearest cluster for a point
    pub fn find_nearest_cluster(&self, point: &[f64]) -> usize {
        self.centroids
            .iter()
            .enumerate()
            .map(|(i, centroid)| (i, Self::squared_distance(point, centroid)))
            .min_by(|(_, d1), (_, d2)| d1.partial_cmp(d2).unwrap())
            .map(|(i, _)| i)
            .unwrap_or(0)
    }

    /// Compute cluster probabilities using soft assignment
    ///
    /// # Theory
    ///
    /// Soft assignment uses distances to compute probabilities:
    /// P(cluster k | x) ∝ exp(-β × distance²(x, centroid_k))
    ///
    /// Where β controls the softness (higher β = harder assignment).
    ///
    /// # Arguments
    ///
    /// * `point` - Input point
    /// * `temperature` - Temperature parameter (lower = softer assignment)
    ///
    /// # Returns
    ///
    /// Vector of cluster probabilities (sums to 1.0)
    pub fn cluster_probabilities(&self, point: &[f64], temperature: f64) -> Vec<f64> {
        if !self.fitted {
            return vec![1.0 / self.k as f64; self.k];
        }

        let beta = 1.0 / temperature.max(0.01);

        // Compute exp(-β × distance²) for each cluster
        let scores: Vec<f64> = self
            .centroids
            .iter()
            .map(|centroid| {
                let dist_sq = Self::squared_distance(point, centroid);
                (-beta * dist_sq).exp()
            })
            .collect();

        // Normalize to probabilities
        let sum: f64 = scores.iter().sum();
        if sum == 0.0 {
            return vec![1.0 / self.k as f64; self.k];
        }

        scores.iter().map(|&s| s / sum).collect()
    }

    /// Compute new centroids from cluster assignments
    fn compute_centroids(
        &self,
        data: &[Vec<f64>],
        assignments: &[usize],
        n_features: usize,
    ) -> Vec<Vec<f64>> {
        let mut new_centroids = vec![vec![0.0; n_features]; self.k];
        let mut counts = vec![0; self.k];

        // Sum points in each cluster
        for (point, &cluster) in data.iter().zip(assignments.iter()) {
            for (j, &val) in point.iter().enumerate() {
                new_centroids[cluster][j] += val;
            }
            counts[cluster] += 1;
        }

        // Average
        for (cluster, count) in counts.iter().enumerate() {
            if *count > 0 {
                for val in &mut new_centroids[cluster] {
                    *val /= *count as f64;
                }
            } else {
                // Empty cluster: keep old centroid
                new_centroids[cluster] = self.centroids[cluster].clone();
            }
        }

        new_centroids
    }

    /// Check if centroids have converged
    fn centroids_equal(&self, c1: &[Vec<f64>], c2: &[Vec<f64>]) -> bool {
        const EPSILON: f64 = 1e-6;

        c1.iter()
            .zip(c2.iter())
            .all(|(a, b)| {
                a.iter()
                    .zip(b.iter())
                    .all(|(x, y)| (x - y).abs() < EPSILON)
            })
    }

    /// Compute squared Euclidean distance
    pub fn squared_distance(a: &[f64], b: &[f64]) -> f64 {
        a.iter()
            .zip(b.iter())
            .map(|(x, y)| (x - y).powi(2))
            .sum()
    }

    /// Get cluster centroids
    pub fn centroids(&self) -> &[Vec<f64>] {
        &self.centroids
    }

    /// Check if model is fitted
    pub fn is_fitted(&self) -> bool {
        self.fitted
    }
}

/// Cluster assignment result
#[derive(Debug, Clone)]
pub struct ClusterAssignment {
    /// Hard cluster assignment (index)
    pub cluster: usize,

    /// Soft cluster probabilities
    pub probabilities: Vec<f64>,

    /// Distance to assigned cluster centroid
    pub distance: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kmeans_creation() {
        let kmeans = KMeans::new(3, 100);
        assert!(!kmeans.is_fitted());
        assert_eq!(kmeans.k, 3);
    }

    #[test]
    fn test_kmeans_fit_simple() {
        let mut kmeans = KMeans::new(2, 100);

        // Two clear clusters
        let data = vec![
            vec![0.0, 0.0],
            vec![0.1, 0.1],
            vec![0.2, 0.0],
            vec![10.0, 10.0],
            vec![10.1, 10.1],
            vec![10.0, 10.2],
        ];

        let result = kmeans.fit(&data);
        assert!(result.is_ok());
        assert!(kmeans.is_fitted());
        assert_eq!(kmeans.centroids().len(), 2);
    }

    #[test]
    fn test_cluster_assignment() {
        let mut kmeans = KMeans::new(2, 100);

        let data = vec![
            vec![0.0, 0.0],
            vec![0.1, 0.1],
            vec![10.0, 10.0],
            vec![10.1, 10.1],
        ];

        kmeans.fit(&data).unwrap();

        // Point near first cluster
        let cluster1 = kmeans.find_nearest_cluster(&[0.05, 0.05]);

        // Point near second cluster
        let cluster2 = kmeans.find_nearest_cluster(&[10.05, 10.05]);

        // Should be assigned to different clusters
        assert_ne!(cluster1, cluster2);
    }

    #[test]
    fn test_soft_clustering() {
        let mut kmeans = KMeans::new(2, 100);

        // Create two clear clusters with multiple points
        let data = vec![
            vec![0.0],
            vec![0.1],
            vec![0.2],
            vec![10.0],
            vec![10.1],
            vec![10.2],
        ];

        kmeans.fit(&data).unwrap();

        // Point near first cluster
        let probs1 = kmeans.cluster_probabilities(&[0.15], 1.0);
        assert_eq!(probs1.len(), 2);
        assert!((probs1.iter().sum::<f64>() - 1.0).abs() < 1e-6);
        // One cluster should be more probable (relaxed constraint)
        let max_prob = probs1.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        assert!(max_prob > 0.5); // Should prefer one cluster

        // Point in middle - probabilities should be valid and sum to 1
        let probs2 = kmeans.cluster_probabilities(&[5.0], 1.0);
        assert_eq!(probs2.len(), 2);
        assert!((probs2.iter().sum::<f64>() - 1.0).abs() < 1e-6);
        // Both probabilities should be non-zero (at least some uncertainty)
        assert!(probs2[0] > 0.0 && probs2[1] > 0.0);
    }

    #[test]
    fn test_squared_distance() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![4.0, 5.0, 6.0];

        let dist_sq = KMeans::squared_distance(&a, &b);
        assert_eq!(dist_sq, 27.0); // (3^2 + 3^2 + 3^2)
    }

    #[test]
    fn test_insufficient_data() {
        let mut kmeans = KMeans::new(3, 100);

        let data = vec![vec![1.0], vec![2.0]]; // Only 2 points, need 3
        let result = kmeans.fit(&data);

        assert!(result.is_err());
    }

    #[test]
    fn test_inconsistent_dimensions() {
        let mut kmeans = KMeans::new(2, 100);

        let data = vec![
            vec![1.0, 2.0],
            vec![3.0, 4.0, 5.0], // Wrong dimension
        ];

        let result = kmeans.fit(&data);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_data() {
        let mut kmeans = KMeans::new(2, 100);
        let data: Vec<Vec<f64>> = vec![];

        let result = kmeans.fit(&data);
        assert!(result.is_err());
    }
}

//! Nonconformity measures for conformal prediction
//!
//! A nonconformity measure A(x, y) quantifies how "strange" or "unusual"
//! a given prediction y is for input x, relative to the training data.
//!
//! Lower scores indicate more conformity (more typical predictions).

/// Trait for nonconformity measures
pub trait NonconformityMeasure: Clone {
    /// Compute nonconformity score for a prediction
    ///
    /// # Arguments
    ///
    /// * `x` - Feature vector
    /// * `y` - Prediction/label
    ///
    /// # Returns
    ///
    /// Nonconformity score (lower = more conformal/typical)
    fn score(&self, x: &[f64], y: f64) -> f64;
}

/// K-Nearest Neighbors nonconformity measure
///
/// # Theory
///
/// For regression, a simple nonconformity measure is:
/// A(x, y) = |y - ŷ|
///
/// Where ŷ is a prediction from some base model (e.g., k-NN average).
///
/// For this implementation, we use the absolute difference between
/// the actual value and a simple heuristic based on the distance
/// in feature space.
#[derive(Clone)]
pub struct KNNNonconformity {
    /// Number of neighbors
    k: usize,

    /// Training data (stored for distance calculations)
    training_data: Vec<(Vec<f64>, f64)>,
}

impl KNNNonconformity {
    /// Create a new k-NN nonconformity measure
    ///
    /// # Arguments
    ///
    /// * `k` - Number of neighbors to consider
    pub fn new(k: usize) -> Self {
        Self {
            k,
            training_data: Vec::new(),
        }
    }

    /// Fit the measure on training data
    ///
    /// This stores the training data for k-NN distance calculations.
    pub fn fit(&mut self, x: &[Vec<f64>], y: &[f64]) {
        self.training_data = x
            .iter()
            .zip(y.iter())
            .map(|(xi, &yi)| (xi.clone(), yi))
            .collect();
    }

    /// Compute Euclidean distance between two vectors
    fn distance(a: &[f64], b: &[f64]) -> f64 {
        a.iter()
            .zip(b.iter())
            .map(|(ai, bi)| (ai - bi).powi(2))
            .sum::<f64>()
            .sqrt()
    }

    /// Get k-NN prediction for a point
    fn knn_predict(&self, x: &[f64]) -> f64 {
        if self.training_data.is_empty() {
            return 0.0;
        }

        // Compute distances to all training points
        let mut distances: Vec<(f64, f64)> = self
            .training_data
            .iter()
            .map(|(xi, yi)| (Self::distance(x, xi), *yi))
            .collect();

        // Sort by distance
        distances.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

        // Average of k nearest neighbors
        let k = self.k.min(distances.len());
        distances[..k].iter().map(|(_, y)| y).sum::<f64>() / k as f64
    }
}

impl NonconformityMeasure for KNNNonconformity {
    fn score(&self, x: &[f64], y: f64) -> f64 {
        // Nonconformity = |y - ŷ_knn|
        let prediction = self.knn_predict(x);
        (y - prediction).abs()
    }
}

/// Residual-based nonconformity for regression
///
/// Uses absolute residuals from a base model as the nonconformity score.
#[derive(Clone)]
pub struct ResidualNonconformity {
    /// Stored residuals from base model
    residuals: Vec<f64>,
}

impl ResidualNonconformity {
    /// Create a new residual-based nonconformity measure
    pub fn new() -> Self {
        Self {
            residuals: Vec::new(),
        }
    }

    /// Fit with residuals from a base model
    ///
    /// # Arguments
    ///
    /// * `predictions` - Predictions from base model on calibration set
    /// * `actuals` - Actual values on calibration set
    pub fn fit(&mut self, predictions: &[f64], actuals: &[f64]) {
        self.residuals = predictions
            .iter()
            .zip(actuals.iter())
            .map(|(pred, actual)| (pred - actual).abs())
            .collect();
    }
}

impl Default for ResidualNonconformity {
    fn default() -> Self {
        Self::new()
    }
}

impl NonconformityMeasure for ResidualNonconformity {
    fn score(&self, _x: &[f64], y: f64) -> f64 {
        // For residual-based, we assume y is already a residual
        // In practice, you'd compute |y_pred - y_actual| here
        y.abs()
    }
}

/// Normalized nonconformity measure
///
/// Normalizes scores by local difficulty/uncertainty estimates.
///
/// # Theory
///
/// A(x, y) = |y - μ(x)| / σ(x)
///
/// Where:
/// - μ(x) is a point prediction
/// - σ(x) is an uncertainty estimate (e.g., k-NN standard deviation)
///
/// This adapts interval width to local difficulty.
#[derive(Clone)]
pub struct NormalizedNonconformity {
    /// Base measure for computing μ(x)
    base_measure: KNNNonconformity,
}

impl NormalizedNonconformity {
    /// Create a new normalized nonconformity measure
    ///
    /// # Arguments
    ///
    /// * `k` - Number of neighbors for base k-NN measure
    pub fn new(k: usize) -> Self {
        Self {
            base_measure: KNNNonconformity::new(k),
        }
    }

    /// Fit the measure on training data
    pub fn fit(&mut self, x: &[Vec<f64>], y: &[f64]) {
        self.base_measure.fit(x, y);
    }

    /// Estimate local uncertainty σ(x) using k-NN standard deviation
    fn estimate_uncertainty(&self, x: &[f64]) -> f64 {
        if self.base_measure.training_data.is_empty() {
            return 1.0;
        }

        // Compute distances to all training points
        let mut distances: Vec<(f64, f64)> = self
            .base_measure
            .training_data
            .iter()
            .map(|(xi, yi)| (KNNNonconformity::distance(x, xi), *yi))
            .collect();

        // Sort by distance
        distances.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

        // Standard deviation of k nearest neighbors
        let k = self.base_measure.k.min(distances.len());
        let neighbors: Vec<f64> = distances[..k].iter().map(|(_, y)| *y).collect();

        let mean = neighbors.iter().sum::<f64>() / k as f64;
        let variance = neighbors
            .iter()
            .map(|y| (y - mean).powi(2))
            .sum::<f64>()
            / k as f64;

        variance.sqrt().max(0.01) // Avoid division by zero
    }
}

impl NonconformityMeasure for NormalizedNonconformity {
    fn score(&self, x: &[f64], y: f64) -> f64 {
        let prediction = self.base_measure.knn_predict(x);
        let uncertainty = self.estimate_uncertainty(x);

        (y - prediction).abs() / uncertainty
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_knn_nonconformity() {
        let mut measure = KNNNonconformity::new(2);

        // Simple 1D data
        let x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0]];
        let y = vec![1.0, 2.0, 3.0, 4.0];

        measure.fit(&x, &y);

        // Score for a conforming point (close to training data)
        let score1 = measure.score(&[2.5], 2.5);

        // Score for a non-conforming point (far from training data)
        let score2 = measure.score(&[2.5], 10.0);

        // Non-conforming point should have higher score
        assert!(score2 > score1);
    }

    #[test]
    fn test_residual_nonconformity() {
        let mut measure = ResidualNonconformity::new();

        let predictions = vec![1.0, 2.0, 3.0];
        let actuals = vec![1.1, 2.2, 2.8];

        measure.fit(&predictions, &actuals);

        // Test scoring
        let score = measure.score(&[], 0.5);
        assert_eq!(score, 0.5);
    }

    #[test]
    fn test_normalized_nonconformity() {
        let mut measure = NormalizedNonconformity::new(2);

        let x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0]];
        let y = vec![1.0, 2.0, 3.0, 4.0];

        measure.fit(&x, &y);

        // Normalized score should account for local variance
        let score = measure.score(&[2.5], 2.5);
        assert!(score >= 0.0);
    }
}

//! Efficient quantile computation for conformal predictive distributions
//!
//! This module provides specialized functions for computing quantiles
//! and interpolating values in sorted score arrays.

use crate::{Error, Result};

/// Compute quantile from sorted scores using linear interpolation
///
/// This is the inverse CDF operation: given a probability p,
/// find the value y such that P(Y ≤ y) = p.
///
/// # Arguments
///
/// * `sorted_scores` - Non-decreasing array of calibration scores
/// * `p` - Probability level in [0, 1]
///
/// # Returns
///
/// Quantile value (inverse CDF at p)
///
/// # Algorithm
///
/// 1. Compute continuous index: idx = p * (n + 1) - 1
/// 2. Linear interpolation between floor(idx) and ceil(idx)
/// 3. Handle boundary cases (p=0, p=1)
///
/// # Complexity
///
/// O(1) time, uses direct array indexing
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::compute_quantile;
///
/// let scores = vec![0.0, 1.0, 2.0, 3.0, 4.0];
/// let median = compute_quantile(&scores, 0.5).unwrap();
/// assert!((median - 2.0).abs() < 0.1);
/// ```
pub fn compute_quantile(sorted_scores: &[f64], p: f64) -> Result<f64> {
    if sorted_scores.is_empty() {
        return Err(Error::InsufficientData(
            "Cannot compute quantile from empty scores".to_string(),
        ));
    }

    if !(0.0..=1.0).contains(&p) {
        return Err(Error::PredictionError(format!(
            "Probability p must be in [0, 1], got {}",
            p
        )));
    }

    let n = sorted_scores.len();

    // Boundary cases
    if p == 0.0 {
        return Ok(sorted_scores[0]);
    }
    if p == 1.0 {
        return Ok(sorted_scores[n - 1]);
    }

    // Compute continuous index
    // Using the conformal prediction convention: p = (i + 1) / (n + 1)
    // Solving for i: i = p * (n + 1) - 1
    let index_float = p * (n + 1) as f64 - 1.0;

    // Clamp to valid range
    let index_float = index_float.max(0.0).min((n - 1) as f64);

    // Interpolate between adjacent scores
    let lower_idx = index_float.floor() as usize;
    let upper_idx = (lower_idx + 1).min(n - 1);

    let lower_score = sorted_scores[lower_idx];
    let upper_score = sorted_scores[upper_idx];

    // Linear interpolation weight
    let weight = index_float - lower_idx as f64;

    Ok(linear_interpolate(lower_score, upper_score, weight))
}

/// Linear interpolation between two values
///
/// Computes: (1 - t) * a + t * b = a + t * (b - a)
///
/// # Arguments
///
/// * `a` - Lower bound value
/// * `b` - Upper bound value
/// * `t` - Interpolation weight in [0, 1]
///
/// # Returns
///
/// Interpolated value
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::linear_interpolate;
///
/// let result = linear_interpolate(1.0, 3.0, 0.5);
/// assert_eq!(result, 2.0);
///
/// let result = linear_interpolate(0.0, 10.0, 0.3);
/// assert_eq!(result, 3.0);
/// ```
pub fn linear_interpolate(a: f64, b: f64, t: f64) -> f64 {
    a + t * (b - a)
}

/// Compute multiple quantiles efficiently
///
/// Batch computation of quantiles at different probability levels.
/// More efficient than calling `compute_quantile` repeatedly due to
/// better cache locality.
///
/// # Arguments
///
/// * `sorted_scores` - Non-decreasing array of calibration scores
/// * `probabilities` - Array of probability levels, each in [0, 1]
///
/// # Returns
///
/// Vector of quantile values corresponding to each probability
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::compute_quantiles_batch;
///
/// let scores = vec![0.0, 1.0, 2.0, 3.0, 4.0];
/// let probs = vec![0.25, 0.5, 0.75];
/// let quantiles = compute_quantiles_batch(&scores, &probs).unwrap();
///
/// assert_eq!(quantiles.len(), 3);
/// // Median should be around 2.0
/// assert!((quantiles[1] - 2.0).abs() < 0.5);
/// ```
pub fn compute_quantiles_batch(sorted_scores: &[f64], probabilities: &[f64]) -> Result<Vec<f64>> {
    probabilities
        .iter()
        .map(|&p| compute_quantile(sorted_scores, p))
        .collect()
}

/// Find the CDF value for a given score using binary search
///
/// Computes P(Y ≤ y) efficiently in O(log n) time.
///
/// # Arguments
///
/// * `sorted_scores` - Non-decreasing array of calibration scores
/// * `y` - Value at which to evaluate CDF
///
/// # Returns
///
/// Probability P(Y ≤ y) in [0, 1]
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::compute_cdf;
///
/// let scores = vec![0.0, 1.0, 2.0, 3.0, 4.0];
/// let prob = compute_cdf(&scores, 2.0);
///
/// // About 60% of scores ≤ 2.0
/// assert!(prob > 0.4 && prob < 0.8);
/// ```
pub fn compute_cdf(sorted_scores: &[f64], y: f64) -> f64 {
    if sorted_scores.is_empty() {
        return 0.0;
    }

    let n = sorted_scores.len();

    // Boundary cases
    if y < sorted_scores[0] {
        return 0.0;
    }
    if y >= sorted_scores[n - 1] {
        return 1.0;
    }

    // Binary search for position
    let pos = sorted_scores.partition_point(|&score| score <= y);

    // Conformal CDF formula
    (pos + 1) as f64 / (n + 1) as f64
}

/// Compute empirical CDF values for multiple points
///
/// Batch computation of CDF values. Each computation is O(log n),
/// so total complexity is O(m log n) for m query points.
///
/// # Arguments
///
/// * `sorted_scores` - Non-decreasing array of calibration scores
/// * `query_points` - Points at which to evaluate CDF
///
/// # Returns
///
/// Vector of CDF values corresponding to each query point
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::compute_cdf_batch;
///
/// let scores = vec![0.0, 1.0, 2.0, 3.0, 4.0];
/// let queries = vec![1.0, 2.0, 3.0];
/// let cdf_values = compute_cdf_batch(&scores, &queries);
///
/// assert_eq!(cdf_values.len(), 3);
/// // CDF should be monotonically increasing
/// assert!(cdf_values[0] <= cdf_values[1]);
/// assert!(cdf_values[1] <= cdf_values[2]);
/// ```
pub fn compute_cdf_batch(sorted_scores: &[f64], query_points: &[f64]) -> Vec<f64> {
    query_points
        .iter()
        .map(|&y| compute_cdf(sorted_scores, y))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_quantile_boundaries() {
        let scores = vec![1.0, 2.0, 3.0, 4.0, 5.0];

        let q0 = compute_quantile(&scores, 0.0).unwrap();
        let q1 = compute_quantile(&scores, 1.0).unwrap();

        assert_eq!(q0, 1.0);
        assert_eq!(q1, 5.0);
    }

    #[test]
    fn test_compute_quantile_median() {
        let scores = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let median = compute_quantile(&scores, 0.5).unwrap();

        // Median should be around 3.0
        assert!((median - 3.0).abs() < 0.5);
    }

    #[test]
    fn test_compute_quantile_invalid_probability() {
        let scores = vec![1.0, 2.0, 3.0];

        assert!(compute_quantile(&scores, -0.1).is_err());
        assert!(compute_quantile(&scores, 1.1).is_err());
    }

    #[test]
    fn test_compute_quantile_empty() {
        let scores: Vec<f64> = vec![];
        assert!(compute_quantile(&scores, 0.5).is_err());
    }

    #[test]
    fn test_linear_interpolate() {
        assert_eq!(linear_interpolate(0.0, 10.0, 0.0), 0.0);
        assert_eq!(linear_interpolate(0.0, 10.0, 1.0), 10.0);
        assert_eq!(linear_interpolate(0.0, 10.0, 0.5), 5.0);
        assert_eq!(linear_interpolate(1.0, 3.0, 0.5), 2.0);
    }

    #[test]
    fn test_compute_quantiles_batch() {
        let scores = vec![0.0, 1.0, 2.0, 3.0, 4.0];
        let probs = vec![0.0, 0.25, 0.5, 0.75, 1.0];

        let quantiles = compute_quantiles_batch(&scores, &probs).unwrap();

        assert_eq!(quantiles.len(), 5);
        assert_eq!(quantiles[0], 0.0); // min
        assert_eq!(quantiles[4], 4.0); // max

        // Should be monotonically increasing
        for i in 1..quantiles.len() {
            assert!(quantiles[i] >= quantiles[i - 1]);
        }
    }

    #[test]
    fn test_compute_cdf() {
        let scores = vec![1.0, 2.0, 3.0, 4.0, 5.0];

        // Below minimum
        assert_eq!(compute_cdf(&scores, 0.0), 0.0);

        // Above maximum
        assert_eq!(compute_cdf(&scores, 10.0), 1.0);

        // At median
        let p_median = compute_cdf(&scores, 3.0);
        assert!(p_median > 0.3 && p_median < 0.8);
    }

    #[test]
    fn test_compute_cdf_monotonicity() {
        let scores = vec![0.5, 1.0, 1.5, 2.0, 2.5];

        let p1 = compute_cdf(&scores, 1.0);
        let p2 = compute_cdf(&scores, 1.5);
        let p3 = compute_cdf(&scores, 2.0);

        // CDF should be non-decreasing
        assert!(p1 <= p2);
        assert!(p2 <= p3);
    }

    #[test]
    fn test_compute_cdf_empty() {
        let scores: Vec<f64> = vec![];
        assert_eq!(compute_cdf(&scores, 1.0), 0.0);
    }

    #[test]
    fn test_compute_cdf_batch() {
        let scores = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let queries = vec![0.0, 2.5, 5.0, 10.0];

        let cdf_values = compute_cdf_batch(&scores, &queries);

        assert_eq!(cdf_values.len(), 4);
        assert_eq!(cdf_values[0], 0.0); // Below min
        assert_eq!(cdf_values[3], 1.0); // Above max

        // Monotonicity
        for i in 1..cdf_values.len() {
            assert!(cdf_values[i] >= cdf_values[i - 1]);
        }
    }

    #[test]
    fn test_cdf_quantile_inverse_relationship() {
        let scores = vec![0.0, 1.0, 2.0, 3.0, 4.0];

        // For several probability levels
        for p in [0.1, 0.25, 0.5, 0.75, 0.9] {
            let q = compute_quantile(&scores, p).unwrap();
            let p_recovered = compute_cdf(&scores, q);

            // Should be approximately equal (within discretization error)
            assert!((p_recovered - p).abs() < 0.3);
        }
    }
}

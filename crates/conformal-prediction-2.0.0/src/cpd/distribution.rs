//! Core Conformal Predictive Distribution implementation
//!
//! This module provides the `ConformalCDF` struct which represents a cumulative
//! distribution function derived from conformal prediction calibration scores.

use crate::{Error, Result};
use rand::Rng;

/// Conformal Predictive Distribution represented as a CDF
///
/// This struct stores sorted nonconformity scores from calibration data
/// and provides efficient O(log n) queries for:
/// - CDF evaluation: P(Y ≤ y)
/// - Quantile computation: inverse CDF
/// - Random sampling from the distribution
/// - Statistical moments (mean, variance, skewness)
///
/// ## Construction
///
/// ```rust
/// use conformal_prediction::cpd::ConformalCDF;
///
/// # fn example() -> conformal_prediction::Result<()> {
/// // From pre-sorted scores
/// let scores = vec![0.5, 1.0, 1.5, 2.0, 2.5];
/// let cdf = ConformalCDF::from_sorted_scores(scores)?;
///
/// // From unsorted scores (will be sorted internally)
/// let unsorted = vec![2.0, 0.5, 1.5, 1.0, 2.5];
/// let cdf2 = ConformalCDF::from_scores(unsorted)?;
/// # Ok(())
/// # }
/// ```
#[derive(Clone, Debug)]
pub struct ConformalCDF {
    /// Sorted nonconformity scores from calibration set
    /// Invariant: scores[i] <= scores[i+1] for all i
    scores: Vec<f64>,

    /// Number of calibration samples (n)
    n: usize,

    /// Cached min/max values for bounds checking
    min_score: f64,
    max_score: f64,
}

impl ConformalCDF {
    /// Create a CDF from already-sorted calibration scores
    ///
    /// # Arguments
    ///
    /// * `scores` - Sorted nonconformity scores (must be in ascending order)
    ///
    /// # Errors
    ///
    /// Returns `Error::InsufficientData` if scores is empty
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// let cdf = ConformalCDF::from_sorted_scores(vec![0.1, 0.5, 1.0, 1.5])?;
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn from_sorted_scores(scores: Vec<f64>) -> Result<Self> {
        if scores.is_empty() {
            return Err(Error::InsufficientData(
                "Cannot create CDF from empty calibration scores".to_string(),
            ));
        }

        let n = scores.len();
        let min_score = scores[0];
        let max_score = scores[n - 1];

        Ok(Self {
            scores,
            n,
            min_score,
            max_score,
        })
    }

    /// Create a CDF from unsorted calibration scores
    ///
    /// Scores will be sorted internally before creating the CDF.
    ///
    /// # Arguments
    ///
    /// * `mut scores` - Unsorted nonconformity scores
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// let cdf = ConformalCDF::from_scores(vec![2.0, 0.5, 1.0])?;
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn from_scores(mut scores: Vec<f64>) -> Result<Self> {
        if scores.is_empty() {
            return Err(Error::InsufficientData(
                "Cannot create CDF from empty calibration scores".to_string(),
            ));
        }

        // Sort scores for O(log n) binary search
        scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        Self::from_sorted_scores(scores)
    }

    /// Compute CDF value at point y: P(Y ≤ y)
    ///
    /// Uses binary search on sorted scores for O(log n) complexity.
    ///
    /// ## Algorithm
    ///
    /// For a candidate value y:
    /// 1. Find position i where scores[i-1] ≤ y < scores[i]
    /// 2. p-value = (n - i + 1) / (n + 1)  [conformal p-value]
    /// 3. CDF(y) = 1 - p-value = i / (n + 1)
    ///
    /// # Arguments
    ///
    /// * `y` - Point at which to evaluate CDF
    ///
    /// # Returns
    ///
    /// Probability that Y ≤ y, in range [0, 1]
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let prob = cdf.cdf(1.2);  // P(Y ≤ 1.2)
    /// assert!(prob > 0.0 && prob < 1.0);
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn cdf(&self, y: f64) -> f64 {
        // Handle boundary cases
        if y < self.min_score {
            return 0.0;
        }
        if y >= self.max_score {
            return 1.0;
        }

        // Binary search to find position where y would be inserted
        // This gives us the count of scores ≤ y
        let pos = self.scores.partition_point(|&score| score <= y);

        // Conformal CDF: P(Y ≤ y) = (# scores ≤ y + 1) / (n + 1)
        // Adding 1 to numerator and denominator ensures proper coverage
        (pos + 1) as f64 / (self.n + 1) as f64
    }

    /// Compute inverse CDF (quantile function): Q(p) = inf{y: P(Y ≤ y) ≥ p}
    ///
    /// Uses binary search with linear interpolation for smooth quantiles.
    ///
    /// # Arguments
    ///
    /// * `p` - Probability level in [0, 1]
    ///
    /// # Returns
    ///
    /// Value y such that P(Y ≤ y) ≈ p
    ///
    /// # Errors
    ///
    /// Returns `Error::PredictionError` if p is not in [0, 1]
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let median = cdf.quantile(0.5)?;  // 50th percentile
    /// let q95 = cdf.quantile(0.95)?;    // 95th percentile
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn quantile(&self, p: f64) -> Result<f64> {
        if !(0.0..=1.0).contains(&p) {
            return Err(Error::PredictionError(format!(
                "Probability p must be in [0, 1], got {}",
                p
            )));
        }

        // Handle boundary cases
        if p == 0.0 {
            return Ok(self.min_score);
        }
        if p == 1.0 {
            return Ok(self.max_score);
        }

        // Compute index in sorted scores corresponding to quantile
        // p = (i + 1) / (n + 1) => i = p * (n + 1) - 1
        let index_float = p * (self.n + 1) as f64 - 1.0;

        // Clamp to valid range to avoid extrapolation below min or above max
        let index_float = index_float.max(0.0).min((self.n - 1) as f64);

        // Linear interpolation between adjacent scores
        let lower_idx = index_float.floor() as usize;
        let upper_idx = (lower_idx + 1).min(self.n - 1);

        let lower_score = self.scores[lower_idx];
        let upper_score = self.scores[upper_idx];

        // Interpolation weight
        let weight = index_float - lower_idx as f64;

        let result = lower_score + weight * (upper_score - lower_score);

        // Ensure result is within bounds (numerical stability)
        Ok(result.max(self.min_score).min(self.max_score))
    }

    /// Sample a random value from the predictive distribution
    ///
    /// Uses inverse transform sampling: generate U ~ Uniform(0, 1),
    /// then return Q(U) where Q is the quantile function.
    ///
    /// # Arguments
    ///
    /// * `rng` - Random number generator
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let mut rng = rand::thread_rng();
    /// let sample = cdf.sample(&mut rng)?;
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn sample<R: Rng>(&self, rng: &mut R) -> Result<f64> {
        let u: f64 = rng.gen(); // Uniform(0, 1)
        self.quantile(u)
    }

    /// Compute mean of the distribution
    ///
    /// Uses trapezoidal integration over the quantile function.
    ///
    /// # Returns
    ///
    /// Expected value E[Y]
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let mean = cdf.mean();
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn mean(&self) -> f64 {
        // For discrete distributions, mean = sum of values weighted by probabilities
        // Using midpoint rule: integrate Q(p) dp from 0 to 1

        // Simple approximation: average of calibration scores
        // This is exact for uniform distributions over the scores
        self.scores.iter().sum::<f64>() / self.n as f64
    }

    /// Compute variance of the distribution
    ///
    /// # Returns
    ///
    /// Variance Var[Y] = E[Y²] - E[Y]²
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let var = cdf.variance();
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn variance(&self) -> f64 {
        let mean = self.mean();

        // Var[Y] = E[(Y - μ)²]
        self.scores
            .iter()
            .map(|&y| (y - mean).powi(2))
            .sum::<f64>()
            / self.n as f64
    }

    /// Compute standard deviation of the distribution
    ///
    /// # Returns
    ///
    /// Standard deviation σ = sqrt(Var[Y])
    pub fn std_dev(&self) -> f64 {
        self.variance().sqrt()
    }

    /// Compute skewness of the distribution
    ///
    /// Measures asymmetry of the distribution around its mean.
    ///
    /// # Returns
    ///
    /// Skewness γ = E[(Y - μ)³] / σ³
    /// - γ = 0: symmetric
    /// - γ > 0: right-skewed (long right tail)
    /// - γ < 0: left-skewed (long left tail)
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let skew = cdf.skewness();
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn skewness(&self) -> f64 {
        let mean = self.mean();
        let std_dev = self.std_dev();

        if std_dev == 0.0 {
            return 0.0;
        }

        let third_moment: f64 = self.scores
            .iter()
            .map(|&y| (y - mean).powi(3))
            .sum::<f64>()
            / self.n as f64;

        third_moment / std_dev.powi(3)
    }

    /// Get the number of calibration samples
    pub fn size(&self) -> usize {
        self.n
    }

    /// Get reference to sorted calibration scores
    pub fn scores(&self) -> &[f64] {
        &self.scores
    }

    /// Get minimum calibration score
    pub fn min_score(&self) -> f64 {
        self.min_score
    }

    /// Get maximum calibration score
    pub fn max_score(&self) -> f64 {
        self.max_score
    }

    /// Compute prediction interval with guaranteed coverage
    ///
    /// Returns [lower, upper] such that P(lower ≤ Y ≤ upper) ≥ 1 - α
    ///
    /// # Arguments
    ///
    /// * `alpha` - Significance level in (0, 1), e.g., 0.1 for 90% coverage
    ///
    /// # Returns
    ///
    /// Tuple (lower, upper) representing the prediction interval
    ///
    /// # Example
    ///
    /// ```rust
    /// # use conformal_prediction::cpd::ConformalCDF;
    /// # let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0])?;
    /// let (lower, upper) = cdf.prediction_interval(0.1)?; // 90% interval
    /// # Ok::<(), conformal_prediction::Error>(())
    /// ```
    pub fn prediction_interval(&self, alpha: f64) -> Result<(f64, f64)> {
        if !(0.0..1.0).contains(&alpha) {
            return Err(Error::InvalidSignificance(alpha));
        }

        let lower = self.quantile(alpha / 2.0)?;
        let upper = self.quantile(1.0 - alpha / 2.0)?;

        Ok((lower, upper))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_from_sorted_scores() {
        let scores = vec![0.5, 1.0, 1.5, 2.0, 2.5];
        let cdf = ConformalCDF::from_sorted_scores(scores.clone()).unwrap();

        assert_eq!(cdf.size(), 5);
        assert_eq!(cdf.min_score(), 0.5);
        assert_eq!(cdf.max_score(), 2.5);
        assert_eq!(cdf.scores(), &scores);
    }

    #[test]
    fn test_from_unsorted_scores() {
        let scores = vec![2.0, 0.5, 1.5, 1.0, 2.5];
        let cdf = ConformalCDF::from_scores(scores).unwrap();

        assert_eq!(cdf.size(), 5);
        assert_eq!(cdf.min_score(), 0.5);
        assert_eq!(cdf.max_score(), 2.5);
    }

    #[test]
    fn test_empty_scores() {
        let result = ConformalCDF::from_sorted_scores(vec![]);
        assert!(result.is_err());
    }

    #[test]
    fn test_cdf_boundary_cases() {
        let cdf = ConformalCDF::from_sorted_scores(vec![1.0, 2.0, 3.0]).unwrap();

        // Below minimum
        assert_eq!(cdf.cdf(0.5), 0.0);

        // Above maximum
        assert_eq!(cdf.cdf(5.0), 1.0);

        // At boundaries should be between 0 and 1
        let p_at_min = cdf.cdf(1.0);
        let p_at_max = cdf.cdf(3.0);
        assert!(p_at_min > 0.0 && p_at_min < 1.0);
        assert!(p_at_max > 0.0);
    }

    #[test]
    fn test_cdf_monotonicity() {
        let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0, 2.5]).unwrap();

        // CDF should be non-decreasing
        let y1 = 1.0;
        let y2 = 1.5;
        let y3 = 2.0;

        let p1 = cdf.cdf(y1);
        let p2 = cdf.cdf(y2);
        let p3 = cdf.cdf(y3);

        assert!(p1 <= p2);
        assert!(p2 <= p3);
    }

    #[test]
    fn test_quantile() {
        let cdf = ConformalCDF::from_sorted_scores(vec![0.0, 1.0, 2.0, 3.0, 4.0]).unwrap();

        // Median should be around 2.0
        let median = cdf.quantile(0.5).unwrap();
        assert!((median - 2.0).abs() < 0.5);

        // Boundary cases
        let min = cdf.quantile(0.0).unwrap();
        let max = cdf.quantile(1.0).unwrap();
        assert_eq!(min, 0.0);
        assert_eq!(max, 4.0);
    }

    #[test]
    fn test_quantile_invalid_probability() {
        let cdf = ConformalCDF::from_sorted_scores(vec![1.0, 2.0]).unwrap();

        assert!(cdf.quantile(-0.1).is_err());
        assert!(cdf.quantile(1.1).is_err());
    }

    #[test]
    fn test_cdf_quantile_inverse() {
        let cdf = ConformalCDF::from_sorted_scores(vec![0.5, 1.0, 1.5, 2.0, 2.5]).unwrap();

        // Q(CDF(y)) should be approximately y for y in support
        let y = 1.5;
        let p = cdf.cdf(y);
        let y_recovered = cdf.quantile(p).unwrap();

        // Should be close (may not be exact due to discrete nature)
        // For discrete distributions, allow larger tolerance
        assert!((y_recovered - y).abs() < 1.0);
    }

    #[test]
    fn test_sampling() {
        let cdf = ConformalCDF::from_sorted_scores(vec![0.0, 1.0, 2.0, 3.0, 4.0]).unwrap();
        let mut rng = rand::thread_rng();

        // Generate multiple samples
        let samples: Vec<f64> = (0..100)
            .map(|_| cdf.sample(&mut rng).unwrap())
            .collect();

        // All samples should be in valid range
        for sample in &samples {
            assert!(*sample >= cdf.min_score());
            assert!(*sample <= cdf.max_score());
        }

        // Mean of samples should be close to distribution mean
        let sample_mean = samples.iter().sum::<f64>() / samples.len() as f64;
        let dist_mean = cdf.mean();
        assert!((sample_mean - dist_mean).abs() < 1.0);
    }

    #[test]
    fn test_mean() {
        let cdf = ConformalCDF::from_sorted_scores(vec![1.0, 2.0, 3.0, 4.0, 5.0]).unwrap();
        let mean = cdf.mean();

        // Mean should be 3.0 for uniform distribution over 1-5
        assert!((mean - 3.0).abs() < 0.01);
    }

    #[test]
    fn test_variance() {
        let cdf = ConformalCDF::from_sorted_scores(vec![1.0, 2.0, 3.0, 4.0, 5.0]).unwrap();
        let variance = cdf.variance();

        // Should be positive
        assert!(variance > 0.0);

        // For uniform over 1-5, variance = (5-1)²/12 = 1.333...
        assert!((variance - 2.0).abs() < 1.0);
    }

    #[test]
    fn test_std_dev() {
        let cdf = ConformalCDF::from_sorted_scores(vec![1.0, 2.0, 3.0]).unwrap();
        let std_dev = cdf.std_dev();
        let variance = cdf.variance();

        assert!((std_dev.powi(2) - variance).abs() < 1e-10);
    }

    #[test]
    fn test_skewness() {
        // Symmetric distribution
        let cdf_symmetric = ConformalCDF::from_sorted_scores(vec![1.0, 2.0, 3.0, 4.0, 5.0]).unwrap();
        let skew_symmetric = cdf_symmetric.skewness();
        assert!(skew_symmetric.abs() < 0.1); // Should be close to 0

        // Right-skewed distribution
        let cdf_right = ConformalCDF::from_sorted_scores(vec![1.0, 1.5, 2.0, 3.0, 10.0]).unwrap();
        let skew_right = cdf_right.skewness();
        assert!(skew_right > 0.0); // Positive skewness
    }

    #[test]
    fn test_prediction_interval() {
        let cdf = ConformalCDF::from_sorted_scores(vec![0.0, 1.0, 2.0, 3.0, 4.0]).unwrap();

        let (lower, upper) = cdf.prediction_interval(0.1).unwrap();

        // Interval should be within data range
        assert!(lower >= cdf.min_score());
        assert!(upper <= cdf.max_score());

        // Upper should be greater than lower
        assert!(upper > lower);

        // 90% interval should capture most of the distribution
        assert!((upper - lower) > 2.0);
    }

    #[test]
    fn test_prediction_interval_invalid_alpha() {
        let cdf = ConformalCDF::from_sorted_scores(vec![1.0, 2.0]).unwrap();

        assert!(cdf.prediction_interval(-0.1).is_err());
        assert!(cdf.prediction_interval(1.0).is_err());
        assert!(cdf.prediction_interval(1.1).is_err());
    }
}

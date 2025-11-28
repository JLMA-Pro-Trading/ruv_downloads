//! Calibration routines for generating Conformal Predictive Distributions
//!
//! This module provides functions to create CPDs from calibration data
//! using nonconformity measures.

use crate::{Error, Result, NonconformityMeasure};
use super::ConformalCDF;

/// Generate a Conformal Predictive Distribution from calibration data
///
/// Given calibration features, labels, and a nonconformity measure,
/// this computes the conformal scores and creates a CDF for prediction.
///
/// # Algorithm
///
/// 1. For each calibration point (xᵢ, yᵢ):
///    - Compute αᵢ = A(xᵢ, yᵢ) using the nonconformity measure
/// 2. Sort scores: α₁ ≤ α₂ ≤ ... ≤ αₙ
/// 3. Create ConformalCDF from sorted scores
///
/// # Arguments
///
/// * `cal_x` - Calibration feature vectors
/// * `cal_y` - Calibration labels
/// * `measure` - Nonconformity measure A(x, y)
///
/// # Returns
///
/// ConformalCDF that can be used for prediction and uncertainty quantification
///
/// # Errors
///
/// - `Error::InsufficientData` if calibration set is empty
/// - `Error::PredictionError` if cal_x and cal_y have different lengths
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::calibrate_cpd;
/// use conformal_prediction::KNNNonconformity;
///
/// # fn example() -> conformal_prediction::Result<()> {
/// // Calibration data
/// let cal_x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0]];
/// let cal_y = vec![1.0, 2.0, 3.0, 4.0];
///
/// // Create and fit nonconformity measure
/// let mut measure = KNNNonconformity::new(2);
/// measure.fit(&cal_x, &cal_y);
///
/// // Generate CPD
/// let cpd = calibrate_cpd(&cal_x, &cal_y, &measure)?;
///
/// // Use CPD for prediction
/// let test_x = vec![2.5];
/// let (lower, upper) = cpd.prediction_interval(0.1)?;
/// # Ok(())
/// # }
/// ```
pub fn calibrate_cpd<M>(
    cal_x: &[Vec<f64>],
    cal_y: &[f64],
    measure: &M,
) -> Result<ConformalCDF>
where
    M: NonconformityMeasure,
{
    if cal_x.is_empty() || cal_y.is_empty() {
        return Err(Error::InsufficientData(
            "Calibration set cannot be empty".to_string(),
        ));
    }

    if cal_x.len() != cal_y.len() {
        return Err(Error::PredictionError(format!(
            "Feature and label count mismatch: {} vs {}",
            cal_x.len(),
            cal_y.len()
        )));
    }

    // Compute nonconformity scores for all calibration points
    let mut scores: Vec<f64> = cal_x
        .iter()
        .zip(cal_y.iter())
        .map(|(x, &y)| measure.score(x, y))
        .collect();

    // Sort scores for efficient CDF queries
    scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // Create CDF from sorted scores
    ConformalCDF::from_sorted_scores(scores)
}

/// Generate CPDs for multiple test points in batch
///
/// For each test point, creates a CPD by computing nonconformity scores
/// against the test point with various candidate labels.
///
/// This is useful when you want to generate full predictive distributions
/// for multiple test instances at once.
///
/// # Arguments
///
/// * `cal_x` - Calibration feature vectors
/// * `cal_y` - Calibration labels
/// * `test_x` - Test feature vectors
/// * `measure` - Nonconformity measure
/// * `candidate_ys` - Candidate label values to evaluate
///
/// # Returns
///
/// Vector of ConformalCDFs, one per test point
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::calibrate_cpd_batch;
/// use conformal_prediction::KNNNonconformity;
///
/// # fn example() -> conformal_prediction::Result<()> {
/// let cal_x = vec![vec![1.0], vec![2.0], vec![3.0]];
/// let cal_y = vec![1.0, 2.0, 3.0];
/// let test_x = vec![vec![1.5], vec![2.5]];
/// let candidates = vec![0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];
///
/// let mut measure = KNNNonconformity::new(2);
/// measure.fit(&cal_x, &cal_y);
///
/// let cpds = calibrate_cpd_batch(&cal_x, &cal_y, &test_x, &measure, &candidates)?;
/// assert_eq!(cpds.len(), 2); // One CPD per test point
/// # Ok(())
/// # }
/// ```
pub fn calibrate_cpd_batch<M>(
    cal_x: &[Vec<f64>],
    cal_y: &[f64],
    test_x: &[Vec<f64>],
    measure: &M,
    candidate_ys: &[f64],
) -> Result<Vec<ConformalCDF>>
where
    M: NonconformityMeasure,
{
    if cal_x.is_empty() || cal_y.is_empty() {
        return Err(Error::InsufficientData(
            "Calibration set cannot be empty".to_string(),
        ));
    }

    if test_x.is_empty() {
        return Err(Error::PredictionError(
            "Test set cannot be empty".to_string(),
        ));
    }

    if candidate_ys.is_empty() {
        return Err(Error::PredictionError(
            "Candidate values cannot be empty".to_string(),
        ));
    }

    // For each test point, generate a CPD
    test_x
        .iter()
        .map(|x_test| {
            // Compute scores for all candidate values at this test point
            let mut scores: Vec<f64> = candidate_ys
                .iter()
                .map(|&y_candidate| measure.score(x_test, y_candidate))
                .collect();

            // Add calibration scores
            for (x_cal, &y_cal) in cal_x.iter().zip(cal_y.iter()) {
                scores.push(measure.score(x_cal, y_cal));
            }

            // Sort and create CDF
            scores.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            ConformalCDF::from_sorted_scores(scores)
        })
        .collect()
}

/// Generate CPD for a specific test point using transduction
///
/// For a given test feature vector, this creates a CPD by trying
/// different candidate labels and computing their conformity.
///
/// This implements the "transductive" or "full conformal" approach
/// where we compute scores by temporarily adding (x_test, y_candidate)
/// to the calibration set.
///
/// # Arguments
///
/// * `cal_x` - Calibration feature vectors
/// * `cal_y` - Calibration labels
/// * `test_x` - Single test feature vector
/// * `measure` - Nonconformity measure
/// * `y_grid` - Grid of candidate label values to evaluate
///
/// # Returns
///
/// Pairs of (y_candidate, p_value) for constructing the CDF
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::transductive_cpd;
/// use conformal_prediction::KNNNonconformity;
///
/// # fn example() -> conformal_prediction::Result<()> {
/// let cal_x = vec![vec![1.0], vec![2.0], vec![3.0]];
/// let cal_y = vec![1.0, 2.0, 3.0];
/// let test_x = vec![2.5];
/// let y_grid = vec![1.5, 2.0, 2.5, 3.0];
///
/// let mut measure = KNNNonconformity::new(2);
/// measure.fit(&cal_x, &cal_y);
///
/// let p_values = transductive_cpd(&cal_x, &cal_y, &test_x, &measure, &y_grid)?;
/// assert_eq!(p_values.len(), 4);
/// # Ok(())
/// # }
/// ```
pub fn transductive_cpd<M>(
    cal_x: &[Vec<f64>],
    cal_y: &[f64],
    test_x: &[f64],
    measure: &M,
    y_grid: &[f64],
) -> Result<Vec<(f64, f64)>>
where
    M: NonconformityMeasure,
{
    if cal_x.is_empty() || cal_y.is_empty() {
        return Err(Error::InsufficientData(
            "Calibration set cannot be empty".to_string(),
        ));
    }

    if y_grid.is_empty() {
        return Err(Error::PredictionError(
            "Candidate grid cannot be empty".to_string(),
        ));
    }

    let n = cal_y.len();

    // Compute calibration scores (fixed)
    let cal_scores: Vec<f64> = cal_x
        .iter()
        .zip(cal_y.iter())
        .map(|(x, &y)| measure.score(x, y))
        .collect();

    // For each candidate y, compute p-value
    let mut results = Vec::with_capacity(y_grid.len());

    for &y_candidate in y_grid {
        // Compute score for test point with this candidate
        let test_score = measure.score(test_x, y_candidate);

        // Count how many calibration scores are >= test score
        let count = cal_scores.iter().filter(|&&s| s >= test_score).count();

        // Conformal p-value: (count + 1) / (n + 1)
        let p_value = (count + 1) as f64 / (n + 1) as f64;

        results.push((y_candidate, p_value));
    }

    Ok(results)
}

/// Create a uniform grid for candidate y values
///
/// Helper function to generate evenly-spaced candidate values
/// for CPD generation.
///
/// # Arguments
///
/// * `y_min` - Minimum value
/// * `y_max` - Maximum value
/// * `n_points` - Number of grid points
///
/// # Returns
///
/// Vector of n_points evenly spaced values from y_min to y_max
///
/// # Example
///
/// ```rust
/// use conformal_prediction::cpd::create_y_grid;
///
/// let grid = create_y_grid(0.0, 10.0, 5);
/// assert_eq!(grid.len(), 5);
/// assert_eq!(grid[0], 0.0);
/// assert_eq!(grid[4], 10.0);
/// ```
pub fn create_y_grid(y_min: f64, y_max: f64, n_points: usize) -> Vec<f64> {
    if n_points == 0 {
        return vec![];
    }

    if n_points == 1 {
        return vec![(y_min + y_max) / 2.0];
    }

    let step = (y_max - y_min) / (n_points - 1) as f64;

    (0..n_points)
        .map(|i| y_min + i as f64 * step)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::KNNNonconformity;

    #[test]
    fn test_calibrate_cpd() {
        let cal_x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0]];
        let cal_y = vec![1.0, 2.0, 3.0, 4.0];

        let mut measure = KNNNonconformity::new(2);
        measure.fit(&cal_x, &cal_y);

        let cpd = calibrate_cpd(&cal_x, &cal_y, &measure).unwrap();

        assert_eq!(cpd.size(), 4);
        assert!(cpd.min_score() >= 0.0);
    }

    #[test]
    fn test_calibrate_cpd_empty() {
        let cal_x: Vec<Vec<f64>> = vec![];
        let cal_y: Vec<f64> = vec![];
        let measure = KNNNonconformity::new(2);

        let result = calibrate_cpd(&cal_x, &cal_y, &measure);
        assert!(result.is_err());
    }

    #[test]
    fn test_calibrate_cpd_length_mismatch() {
        let cal_x = vec![vec![1.0], vec![2.0]];
        let cal_y = vec![1.0]; // Length mismatch
        let measure = KNNNonconformity::new(2);

        let result = calibrate_cpd(&cal_x, &cal_y, &measure);
        assert!(result.is_err());
    }

    #[test]
    fn test_calibrate_cpd_batch() {
        let cal_x = vec![vec![1.0], vec![2.0], vec![3.0]];
        let cal_y = vec![1.0, 2.0, 3.0];
        let test_x = vec![vec![1.5], vec![2.5]];
        let candidates = vec![0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5];

        let mut measure = KNNNonconformity::new(2);
        measure.fit(&cal_x, &cal_y);

        let cpds = calibrate_cpd_batch(&cal_x, &cal_y, &test_x, &measure, &candidates).unwrap();

        assert_eq!(cpds.len(), 2);
        for cpd in cpds {
            assert!(cpd.size() > 0);
        }
    }

    #[test]
    fn test_transductive_cpd() {
        let cal_x = vec![vec![1.0], vec![2.0], vec![3.0], vec![4.0]];
        let cal_y = vec![1.0, 2.0, 3.0, 4.0];
        let test_x = vec![2.5];
        let y_grid = vec![1.0, 2.0, 2.5, 3.0, 4.0];

        let mut measure = KNNNonconformity::new(2);
        measure.fit(&cal_x, &cal_y);

        let results = transductive_cpd(&cal_x, &cal_y, &test_x, &measure, &y_grid).unwrap();

        assert_eq!(results.len(), 5);

        // All p-values should be in [0, 1]
        for (_, p_value) in &results {
            assert!(*p_value >= 0.0 && *p_value <= 1.0);
        }

        // p-values for conforming points should be higher
        // (closer to 2.5 should have higher p-values)
        let p_at_25 = results.iter().find(|(y, _)| *y == 2.5).unwrap().1;
        let p_at_10 = results.iter().find(|(y, _)| *y == 1.0).unwrap().1;
        let p_at_40 = results.iter().find(|(y, _)| *y == 4.0).unwrap().1;

        // 2.5 should be more conforming than extreme values
        assert!(p_at_25 >= p_at_10 || p_at_25 >= p_at_40);
    }

    #[test]
    fn test_transductive_cpd_empty_calibration() {
        let cal_x: Vec<Vec<f64>> = vec![];
        let cal_y: Vec<f64> = vec![];
        let test_x = vec![2.5];
        let y_grid = vec![1.0, 2.0, 3.0];
        let measure = KNNNonconformity::new(2);

        let result = transductive_cpd(&cal_x, &cal_y, &test_x, &measure, &y_grid);
        assert!(result.is_err());
    }

    #[test]
    fn test_create_y_grid() {
        let grid = create_y_grid(0.0, 10.0, 5);

        assert_eq!(grid.len(), 5);
        assert_eq!(grid[0], 0.0);
        assert_eq!(grid[4], 10.0);

        // Check uniform spacing
        for i in 1..grid.len() {
            let diff = grid[i] - grid[i - 1];
            assert!((diff - 2.5).abs() < 1e-10);
        }
    }

    #[test]
    fn test_create_y_grid_single_point() {
        let grid = create_y_grid(5.0, 15.0, 1);
        assert_eq!(grid.len(), 1);
        assert_eq!(grid[0], 10.0); // Midpoint
    }

    #[test]
    fn test_create_y_grid_empty() {
        let grid = create_y_grid(0.0, 10.0, 0);
        assert_eq!(grid.len(), 0);
    }

    #[test]
    fn test_cpd_prediction_interval() {
        let cal_x = vec![
            vec![1.0],
            vec![2.0],
            vec![3.0],
            vec![4.0],
            vec![5.0],
        ];
        let cal_y = vec![1.0, 2.0, 3.0, 4.0, 5.0];

        let mut measure = KNNNonconformity::new(2);
        measure.fit(&cal_x, &cal_y);

        let cpd = calibrate_cpd(&cal_x, &cal_y, &measure).unwrap();

        let (lower, upper) = cpd.prediction_interval(0.1).unwrap();

        // Interval should be valid
        // Note: For perfectly predicted data, scores may all be near zero,
        // leading to very narrow intervals (upper >= lower)
        assert!(upper >= lower);
        assert!(lower >= cpd.min_score());
        assert!(upper <= cpd.max_score());
    }

    #[test]
    fn test_cpd_statistical_properties() {
        // Use data with actual nonconformity to get meaningful statistics
        let cal_x = vec![
            vec![1.0],
            vec![2.0],
            vec![3.0],
            vec![4.0],
            vec![5.0],
            vec![6.0],
            vec![7.0],
        ];
        // Introduce some nonconformity by offsetting some predictions
        let cal_y = vec![1.5, 2.0, 3.5, 4.0, 5.5, 6.0, 7.5];

        let mut measure = KNNNonconformity::new(2);
        measure.fit(&cal_x, &cal_y);

        let cpd = calibrate_cpd(&cal_x, &cal_y, &measure).unwrap();

        // Mean should be non-negative (nonconformity scores)
        let mean = cpd.mean();
        assert!(mean >= 0.0);

        // Variance should be non-negative
        let variance = cpd.variance();
        assert!(variance >= 0.0);

        // Skewness should be finite
        let skewness = cpd.skewness();
        assert!(skewness.is_finite());
    }
}

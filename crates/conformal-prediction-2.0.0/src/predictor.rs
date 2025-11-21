//! Conformal Predictor implementation

use crate::{Error, Result, ConformalContext, NonconformityMeasure};

/// A conformal predictor that provides prediction regions with guaranteed coverage
///
/// # Theory
///
/// Given:
/// - Calibration set: {(x₁, y₁), ..., (xₙ, yₙ)}
/// - Significance level: α ∈ (0, 1)
/// - Nonconformity measure: A(x, y) → ℝ
///
/// For a new input x_new:
/// 1. Compute nonconformity scores: αᵢ = A(xᵢ, yᵢ) for all calibration points
/// 2. For each candidate prediction y':
///    - Compute α' = A(x_new, y')
///    - Check if α' is conformally typical (p-value > α)
/// 3. Output all conformally typical predictions
///
/// **Guarantee**: P(y_true ∈ prediction_set) ≥ 1 - α
pub struct ConformalPredictor<M: NonconformityMeasure> {
    /// Significance level (e.g., 0.1 for 90% confidence)
    alpha: f64,

    /// Nonconformity measure
    measure: M,

    /// Calibration nonconformity scores
    calibration_scores: Vec<f64>,

    /// Context for formal verification
    context: ConformalContext,
}

impl<M: NonconformityMeasure> ConformalPredictor<M> {
    /// Create a new conformal predictor
    ///
    /// # Arguments
    ///
    /// * `alpha` - Significance level in (0, 1). For example, 0.1 gives 90% confidence
    /// * `measure` - Nonconformity measure to use
    ///
    /// # Errors
    ///
    /// Returns `InvalidSignificance` if alpha is not in (0, 1)
    pub fn new(alpha: f64, measure: M) -> Result<Self> {
        if !(0.0 < alpha && alpha < 1.0) {
            return Err(Error::InvalidSignificance(alpha));
        }

        Ok(Self {
            alpha,
            measure,
            calibration_scores: Vec::new(),
            context: ConformalContext::new(),
        })
    }

    /// Calibrate the predictor on a dataset
    ///
    /// # Arguments
    ///
    /// * `x` - Feature vectors (n_samples × n_features)
    /// * `y` - True labels/values
    ///
    /// # Theory
    ///
    /// Calibration computes nonconformity scores for all training examples:
    /// αᵢ = A(xᵢ, yᵢ) for i = 1..n
    ///
    /// These scores are used to determine the conformality threshold.
    pub fn calibrate(&mut self, x: &[Vec<f64>], y: &[f64]) -> Result<()> {
        if x.len() != y.len() {
            return Err(Error::InsufficientData(format!(
                "Mismatched dimensions: {} features vs {} labels",
                x.len(),
                y.len()
            )));
        }

        if x.is_empty() {
            return Err(Error::InsufficientData(
                "Empty calibration set".to_string()
            ));
        }

        // Compute nonconformity scores
        self.calibration_scores = x
            .iter()
            .zip(y.iter())
            .map(|(xi, &yi)| self.measure.score(xi, yi))
            .collect();

        Ok(())
    }

    /// Predict with conformal guarantee
    ///
    /// # Arguments
    ///
    /// * `x` - Feature vector for prediction
    /// * `candidates` - Candidate predictions to test
    ///
    /// # Returns
    ///
    /// Vector of conformally valid predictions with p-values
    ///
    /// # Theory
    ///
    /// For each candidate y':
    /// 1. Compute α' = A(x, y')
    /// 2. Compute p-value = #{αᵢ ≥ α'} / (n + 1)
    /// 3. Include y' if p-value > α
    pub fn predict(
        &self,
        x: &[f64],
        candidates: &[f64],
    ) -> Result<Vec<(f64, f64)>> {
        if self.calibration_scores.is_empty() {
            return Err(Error::PredictionError(
                "Predictor not calibrated".to_string()
            ));
        }

        let mut predictions = Vec::new();

        for &candidate in candidates {
            let candidate_score = self.measure.score(x, candidate);

            // Compute p-value
            let count = self
                .calibration_scores
                .iter()
                .filter(|&&score| score >= candidate_score)
                .count();

            let p_value = (count as f64 + 1.0) / (self.calibration_scores.len() as f64 + 1.0);

            // Include if conformally valid
            if p_value > self.alpha {
                predictions.push((candidate, p_value));
            }
        }

        Ok(predictions)
    }

    /// Predict regression interval
    ///
    /// # Arguments
    ///
    /// * `x` - Feature vector
    /// * `point_estimate` - Point prediction from underlying model
    ///
    /// # Returns
    ///
    /// (lower_bound, upper_bound) with guaranteed coverage
    ///
    /// # Theory
    ///
    /// 1. Find quantile of calibration scores: q = quantile(α_calibration, 1 - α)
    /// 2. Prediction interval: [ŷ - q, ŷ + q]
    ///
    /// Where ŷ is the point estimate from the underlying model.
    pub fn predict_interval(
        &self,
        _x: &[f64],
        point_estimate: f64,
    ) -> Result<(f64, f64)> {
        if self.calibration_scores.is_empty() {
            return Err(Error::PredictionError(
                "Predictor not calibrated".to_string()
            ));
        }

        // Sort calibration scores
        let mut sorted_scores = self.calibration_scores.clone();
        sorted_scores.sort_by(|a, b| a.partial_cmp(b).unwrap());

        // Find quantile
        let quantile_idx = ((1.0 - self.alpha) * sorted_scores.len() as f64).ceil() as usize;
        let quantile_idx = quantile_idx.min(sorted_scores.len() - 1);
        let quantile = sorted_scores[quantile_idx];

        Ok((point_estimate - quantile, point_estimate + quantile))
    }

    /// Get the significance level
    pub fn alpha(&self) -> f64 {
        self.alpha
    }

    /// Get the expected coverage probability
    pub fn coverage(&self) -> f64 {
        1.0 - self.alpha
    }

    /// Get the number of calibration samples
    pub fn n_calibration(&self) -> usize {
        self.calibration_scores.len()
    }

    /// Get reference to the formal verification context
    pub fn context(&self) -> &ConformalContext {
        &self.context
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::KNNNonconformity;

    #[test]
    fn test_conformal_predictor_creation() {
        let measure = KNNNonconformity::new(3);
        let predictor = ConformalPredictor::new(0.1, measure);
        assert!(predictor.is_ok());

        let predictor = predictor.unwrap();
        assert_eq!(predictor.alpha(), 0.1);
        assert_eq!(predictor.coverage(), 0.9);
    }

    #[test]
    fn test_invalid_alpha() {
        let measure = KNNNonconformity::new(3);
        assert!(ConformalPredictor::new(-0.1, measure.clone()).is_err());
        assert!(ConformalPredictor::new(0.0, measure.clone()).is_err());
        assert!(ConformalPredictor::new(1.0, measure.clone()).is_err());
        assert!(ConformalPredictor::new(1.1, measure).is_err());
    }

    #[test]
    fn test_calibration() {
        let measure = KNNNonconformity::new(2);
        let mut predictor = ConformalPredictor::new(0.1, measure).unwrap();

        let x = vec![vec![1.0, 2.0], vec![2.0, 3.0], vec![3.0, 4.0]];
        let y = vec![1.0, 2.0, 3.0];

        assert!(predictor.calibrate(&x, &y).is_ok());
        assert_eq!(predictor.n_calibration(), 3);
    }

    #[test]
    fn test_prediction_interval() {
        let measure = KNNNonconformity::new(2);
        let mut predictor = ConformalPredictor::new(0.1, measure).unwrap();

        // Calibrate with simple data
        let x = vec![
            vec![1.0],
            vec![2.0],
            vec![3.0],
            vec![4.0],
            vec![5.0],
        ];
        let y = vec![1.0, 2.0, 3.0, 4.0, 5.0];

        predictor.calibrate(&x, &y).unwrap();

        // Predict interval
        let (lower, upper) = predictor
            .predict_interval(&[3.0], 3.0)
            .unwrap();

        // Interval should contain the point estimate
        assert!(lower <= 3.0);
        assert!(upper >= 3.0);
        assert!(lower < upper);
    }
}

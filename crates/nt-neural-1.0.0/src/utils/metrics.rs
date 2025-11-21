//! Comprehensive evaluation metrics for time series forecasting

use crate::error::Result;
use serde::{Deserialize, Serialize};

/// Evaluation metrics collection
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvaluationMetrics {
    /// Mean Absolute Error
    pub mae: f64,
    /// Root Mean Squared Error
    pub rmse: f64,
    /// Mean Absolute Percentage Error
    pub mape: f64,
    /// Symmetric MAPE (better for zero-valued series)
    pub smape: f64,
    /// R-squared (coefficient of determination)
    pub r2_score: f64,
    /// Mean Absolute Scaled Error
    pub mase: Option<f64>,
    /// Coverage of prediction intervals (if applicable)
    pub interval_coverage: Option<f64>,
}

impl EvaluationMetrics {
    /// Compute all metrics from predictions and actuals
    pub fn compute(y_true: &[f64], y_pred: &[f64], y_train: Option<&[f64]>) -> Result<Self> {
        if y_true.len() != y_pred.len() {
            return Err(crate::error::NeuralError::data(
                "y_true and y_pred must have the same length"
            ));
        }

        let mae = mean_absolute_error(y_true, y_pred);
        let rmse = root_mean_squared_error(y_true, y_pred);
        let mape = mean_absolute_percentage_error(y_true, y_pred);
        let smape = symmetric_mape(y_true, y_pred);
        let r2_score = r2(y_true, y_pred);
        let mase = y_train.map(|train| mean_absolute_scaled_error(y_true, y_pred, train));

        Ok(Self {
            mae,
            rmse,
            mape,
            smape,
            r2_score,
            mase,
            interval_coverage: None,
        })
    }

    /// Check if metrics are within acceptable thresholds
    pub fn is_acceptable(&self, mae_threshold: f64, r2_threshold: f64) -> bool {
        self.mae < mae_threshold && self.r2_score > r2_threshold
    }
}

/// Mean Absolute Error
pub fn mean_absolute_error(y_true: &[f64], y_pred: &[f64]) -> f64 {
    y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| (t - p).abs())
        .sum::<f64>()
        / y_true.len() as f64
}

/// Mean Squared Error
pub fn mean_squared_error(y_true: &[f64], y_pred: &[f64]) -> f64 {
    y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| (t - p).powi(2))
        .sum::<f64>()
        / y_true.len() as f64
}

/// Root Mean Squared Error
pub fn root_mean_squared_error(y_true: &[f64], y_pred: &[f64]) -> f64 {
    mean_squared_error(y_true, y_pred).sqrt()
}

/// Mean Absolute Percentage Error
pub fn mean_absolute_percentage_error(y_true: &[f64], y_pred: &[f64]) -> f64 {
    let sum: f64 = y_true
        .iter()
        .zip(y_pred.iter())
        .filter(|(&t, _)| t.abs() > 1e-10)
        .map(|(t, p)| ((t - p) / t).abs())
        .sum();

    let count = y_true.iter().filter(|&&t| t.abs() > 1e-10).count();

    if count > 0 {
        (sum / count as f64) * 100.0
    } else {
        0.0
    }
}

/// Symmetric Mean Absolute Percentage Error (better for series with zeros)
pub fn symmetric_mape(y_true: &[f64], y_pred: &[f64]) -> f64 {
    let sum: f64 = y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| {
            let denominator = (t.abs() + p.abs()) / 2.0;
            if denominator > 1e-10 {
                (t - p).abs() / denominator
            } else {
                0.0
            }
        })
        .sum();

    (sum / y_true.len() as f64) * 100.0
}

/// R-squared (coefficient of determination)
pub fn r2(y_true: &[f64], y_pred: &[f64]) -> f64 {
    let mean = y_true.iter().sum::<f64>() / y_true.len() as f64;

    let ss_tot: f64 = y_true.iter().map(|t| (t - mean).powi(2)).sum();
    let ss_res: f64 = y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| (t - p).powi(2))
        .sum();

    if ss_tot > 1e-10 {
        1.0 - (ss_res / ss_tot)
    } else {
        0.0
    }
}

/// Adjusted R-squared (accounts for number of features)
pub fn adjusted_r2(y_true: &[f64], y_pred: &[f64], num_features: usize) -> f64 {
    let r2_value = r2(y_true, y_pred);
    let n = y_true.len() as f64;
    let p = num_features as f64;

    1.0 - (1.0 - r2_value) * (n - 1.0) / (n - p - 1.0)
}

/// Mean Absolute Scaled Error (scale-independent metric)
pub fn mean_absolute_scaled_error(y_true: &[f64], y_pred: &[f64], y_train: &[f64]) -> f64 {
    // Calculate MAE of predictions
    let mae = mean_absolute_error(y_true, y_pred);

    // Calculate MAE of naive forecast (persistence) on training set
    let naive_mae = if y_train.len() > 1 {
        y_train
            .windows(2)
            .map(|window| (window[1] - window[0]).abs())
            .sum::<f64>()
            / (y_train.len() - 1) as f64
    } else {
        1.0
    };

    if naive_mae > 1e-10 {
        mae / naive_mae
    } else {
        mae
    }
}

/// Quantile Score (for probabilistic forecasts)
pub fn quantile_score(y_true: &[f64], y_pred: &[f64], quantile: f64) -> f64 {
    y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| {
            let error = t - p;
            if error >= 0.0 {
                quantile * error
            } else {
                (quantile - 1.0) * error
            }
        })
        .sum::<f64>()
        / y_true.len() as f64
}

/// Continuous Ranked Probability Score (for probabilistic forecasts)
pub fn crps(y_true: &[f64], forecasts: &[Vec<f64>]) -> f64 {
    // Simplified CRPS calculation
    y_true
        .iter()
        .zip(forecasts.iter())
        .map(|(t, forecast_dist)| {
            let mut sorted = forecast_dist.clone();
            sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

            // Approximate CRPS using sample forecasts
            let n = sorted.len() as f64;
            let sum: f64 = sorted.iter().enumerate().map(|(i, &p)| {
                let indicator = if *t < p { 0.0 } else { 1.0 };
                let prob = (i + 1) as f64 / n;
                (prob - indicator).powi(2) * (p - t).abs()
            }).sum();

            sum / n
        })
        .sum::<f64>()
        / y_true.len() as f64
}

/// Coverage of prediction intervals
pub fn interval_coverage(
    y_true: &[f64],
    lower_bounds: &[f64],
    upper_bounds: &[f64],
) -> f64 {
    let count: usize = y_true
        .iter()
        .zip(lower_bounds.iter())
        .zip(upper_bounds.iter())
        .filter(|((&t, &l), &u)| t >= l && t <= u)
        .count();

    count as f64 / y_true.len() as f64
}

/// Directional accuracy (for trading)
pub fn directional_accuracy(y_true: &[f64], y_pred: &[f64]) -> f64 {
    if y_true.len() < 2 {
        return 0.0;
    }

    let correct_directions = y_true
        .windows(2)
        .zip(y_pred.windows(2))
        .filter(|(true_window, pred_window)| {
            let true_direction = true_window[1] - true_window[0];
            let pred_direction = pred_window[1] - pred_window[0];
            (true_direction * pred_direction) > 0.0
        })
        .count();

    correct_directions as f64 / (y_true.len() - 1) as f64
}

/// Maximum Error
pub fn max_error(y_true: &[f64], y_pred: &[f64]) -> f64 {
    y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| (t - p).abs())
        .fold(0.0, f64::max)
}

/// Explained Variance Score
pub fn explained_variance_score(y_true: &[f64], y_pred: &[f64]) -> f64 {
    let mean = y_true.iter().sum::<f64>() / y_true.len() as f64;

    let var: f64 = y_true.iter().map(|t| (t - mean).powi(2)).sum();
    let residual_var: f64 = y_true
        .iter()
        .zip(y_pred.iter())
        .map(|(t, p)| (t - p).powi(2))
        .sum();

    if var > 1e-10 {
        1.0 - (residual_var / var)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mae() {
        let y_true = vec![1.0, 2.0, 3.0, 4.0];
        let y_pred = vec![1.1, 2.1, 2.9, 4.2];

        let mae = mean_absolute_error(&y_true, &y_pred);
        assert!((mae - 0.125).abs() < 1e-10);
    }

    #[test]
    fn test_rmse() {
        let y_true = vec![1.0, 2.0, 3.0, 4.0];
        let y_pred = vec![1.0, 2.0, 3.0, 4.0];

        let rmse = root_mean_squared_error(&y_true, &y_pred);
        assert!(rmse.abs() < 1e-10);
    }

    #[test]
    fn test_r2_perfect() {
        let y_true = vec![1.0, 2.0, 3.0, 4.0];
        let y_pred = vec![1.0, 2.0, 3.0, 4.0];

        let r2_score = r2(&y_true, &y_pred);
        assert!((r2_score - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_mape() {
        let y_true = vec![100.0, 200.0, 300.0];
        let y_pred = vec![110.0, 190.0, 310.0];

        let mape = mean_absolute_percentage_error(&y_true, &y_pred);
        // (10% + 5% + 3.33%) / 3 = 6.11%
        assert!((mape - 6.11).abs() < 0.1);
    }

    #[test]
    fn test_directional_accuracy() {
        let y_true = vec![1.0, 2.0, 3.0, 2.5, 3.5];
        let y_pred = vec![1.1, 2.1, 3.1, 2.6, 3.6];

        let da = directional_accuracy(&y_true, &y_pred);
        assert_eq!(da, 1.0); // All directions correct
    }

    #[test]
    fn test_interval_coverage() {
        let y_true = vec![1.0, 2.0, 3.0, 4.0];
        let lower = vec![0.5, 1.5, 2.5, 3.5];
        let upper = vec![1.5, 2.5, 3.5, 4.5];

        let coverage = interval_coverage(&y_true, &lower, &upper);
        assert_eq!(coverage, 1.0); // All within bounds
    }
}

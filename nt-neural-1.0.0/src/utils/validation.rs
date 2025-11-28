//! Cross-validation and model selection utilities

use crate::error::{NeuralError, Result};
use crate::utils::metrics::EvaluationMetrics;
use rand::seq::SliceRandom;
use serde::{Deserialize, Serialize};

/// Cross-validation strategy
#[derive(Debug, Clone, Copy)]
pub enum CVStrategy {
    /// K-fold cross-validation
    KFold(usize),
    /// Time series split (preserves temporal order)
    TimeSeriesSplit { n_splits: usize, test_size: usize },
    /// Expanding window (walk-forward)
    ExpandingWindow { initial_train_size: usize, step_size: usize },
    /// Rolling window (fixed train size)
    RollingWindow { train_size: usize, test_size: usize },
}

/// Cross-validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CVResult {
    pub fold: usize,
    pub train_indices: Vec<usize>,
    pub test_indices: Vec<usize>,
    pub metrics: EvaluationMetrics,
}

/// Cross-validation splits
pub struct CVSplits {
    pub splits: Vec<(Vec<usize>, Vec<usize>)>,
}

impl CVSplits {
    /// Generate cross-validation splits
    pub fn generate(data_len: usize, strategy: CVStrategy) -> Result<Self> {
        let splits = match strategy {
            CVStrategy::KFold(k) => Self::k_fold_splits(data_len, k)?,
            CVStrategy::TimeSeriesSplit { n_splits, test_size } => {
                Self::time_series_splits(data_len, n_splits, test_size)?
            }
            CVStrategy::ExpandingWindow { initial_train_size, step_size } => {
                Self::expanding_window_splits(data_len, initial_train_size, step_size)?
            }
            CVStrategy::RollingWindow { train_size, test_size } => {
                Self::rolling_window_splits(data_len, train_size, test_size)?
            }
        };

        Ok(Self { splits })
    }

    /// K-fold cross-validation splits
    fn k_fold_splits(data_len: usize, k: usize) -> Result<Vec<(Vec<usize>, Vec<usize>)>> {
        if k < 2 {
            return Err(NeuralError::config("k must be at least 2"));
        }

        let fold_size = data_len / k;
        let mut indices: Vec<usize> = (0..data_len).collect();
        indices.shuffle(&mut rand::thread_rng());

        let mut splits = Vec::new();

        for fold in 0..k {
            let test_start = fold * fold_size;
            let test_end = if fold == k - 1 { data_len } else { (fold + 1) * fold_size };

            let test_indices: Vec<usize> = indices[test_start..test_end].to_vec();
            let train_indices: Vec<usize> = indices[..test_start]
                .iter()
                .chain(&indices[test_end..])
                .copied()
                .collect();

            splits.push((train_indices, test_indices));
        }

        Ok(splits)
    }

    /// Time series cross-validation (preserves temporal order)
    fn time_series_splits(
        data_len: usize,
        n_splits: usize,
        test_size: usize,
    ) -> Result<Vec<(Vec<usize>, Vec<usize>)>> {
        if test_size >= data_len {
            return Err(NeuralError::config("test_size must be less than data length"));
        }

        let mut splits = Vec::new();
        let total_size = data_len - test_size;
        let step_size = total_size / (n_splits + 1);

        for split in 1..=n_splits {
            let train_end = step_size * split;
            let test_start = train_end;
            let test_end = test_start + test_size;

            if test_end > data_len {
                break;
            }

            let train_indices: Vec<usize> = (0..train_end).collect();
            let test_indices: Vec<usize> = (test_start..test_end).collect();

            splits.push((train_indices, test_indices));
        }

        Ok(splits)
    }

    /// Expanding window validation
    fn expanding_window_splits(
        data_len: usize,
        initial_train_size: usize,
        step_size: usize,
    ) -> Result<Vec<(Vec<usize>, Vec<usize>)>> {
        if initial_train_size >= data_len {
            return Err(NeuralError::config("initial_train_size must be less than data length"));
        }

        let mut splits = Vec::new();
        let mut train_end = initial_train_size;

        while train_end + step_size <= data_len {
            let test_start = train_end;
            let test_end = (train_end + step_size).min(data_len);

            let train_indices: Vec<usize> = (0..train_end).collect();
            let test_indices: Vec<usize> = (test_start..test_end).collect();

            splits.push((train_indices, test_indices));

            train_end += step_size;
        }

        Ok(splits)
    }

    /// Rolling window validation (fixed train size)
    fn rolling_window_splits(
        data_len: usize,
        train_size: usize,
        test_size: usize,
    ) -> Result<Vec<(Vec<usize>, Vec<usize>)>> {
        if train_size + test_size > data_len {
            return Err(NeuralError::config("train_size + test_size must be <= data length"));
        }

        let mut splits = Vec::new();
        let mut start = 0;

        while start + train_size + test_size <= data_len {
            let train_start = start;
            let train_end = start + train_size;
            let test_start = train_end;
            let test_end = test_start + test_size;

            let train_indices: Vec<usize> = (train_start..train_end).collect();
            let test_indices: Vec<usize> = (test_start..test_end).collect();

            splits.push((train_indices, test_indices));

            start += test_size; // Slide by test_size
        }

        Ok(splits)
    }

    /// Get number of splits
    pub fn len(&self) -> usize {
        self.splits.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.splits.is_empty()
    }
}

/// Hyperparameter search grid
#[derive(Debug, Clone)]
pub struct GridSearchCV {
    pub param_grid: Vec<(String, Vec<f64>)>,
}

impl GridSearchCV {
    /// Create a new grid search
    pub fn new() -> Self {
        Self {
            param_grid: Vec::new(),
        }
    }

    /// Add a parameter to the grid
    pub fn add_param(mut self, name: String, values: Vec<f64>) -> Self {
        self.param_grid.push((name, values));
        self
    }

    /// Generate all parameter combinations
    pub fn generate_combinations(&self) -> Vec<Vec<(String, f64)>> {
        if self.param_grid.is_empty() {
            return vec![Vec::new()];
        }

        let mut combinations = vec![Vec::new()];

        for (param_name, param_values) in &self.param_grid {
            let mut new_combinations = Vec::new();

            for combination in &combinations {
                for &value in param_values {
                    let mut new_combo = combination.clone();
                    new_combo.push((param_name.clone(), value));
                    new_combinations.push(new_combo);
                }
            }

            combinations = new_combinations;
        }

        combinations
    }
}

impl Default for GridSearchCV {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_k_fold_splits() {
        let splits = CVSplits::generate(100, CVStrategy::KFold(5)).unwrap();

        assert_eq!(splits.len(), 5);

        // Check that all indices are covered
        let mut all_test_indices: Vec<usize> = Vec::new();
        for (_, test_indices) in &splits.splits {
            all_test_indices.extend(test_indices.iter().copied());
        }

        all_test_indices.sort();
        assert_eq!(all_test_indices.len(), 100);
    }

    #[test]
    fn test_time_series_splits() {
        let splits = CVSplits::generate(
            100,
            CVStrategy::TimeSeriesSplit {
                n_splits: 3,
                test_size: 20,
            },
        )
        .unwrap();

        assert!(splits.len() > 0);

        // Check temporal ordering
        for (train_indices, test_indices) in &splits.splits {
            let max_train = train_indices.iter().max().unwrap();
            let min_test = test_indices.iter().min().unwrap();

            assert!(max_train < min_test);
        }
    }

    #[test]
    fn test_expanding_window() {
        let splits = CVSplits::generate(
            100,
            CVStrategy::ExpandingWindow {
                initial_train_size: 50,
                step_size: 10,
            },
        )
        .unwrap();

        assert!(splits.len() > 0);

        // Check that train size increases
        let train_sizes: Vec<_> = splits
            .splits
            .iter()
            .map(|(train, _)| train.len())
            .collect();

        for i in 1..train_sizes.len() {
            assert!(train_sizes[i] > train_sizes[i - 1]);
        }
    }

    #[test]
    fn test_rolling_window() {
        let splits = CVSplits::generate(
            100,
            CVStrategy::RollingWindow {
                train_size: 50,
                test_size: 10,
            },
        )
        .unwrap();

        assert!(splits.len() > 0);

        // Check that all train sizes are the same
        for (train, test) in &splits.splits {
            assert_eq!(train.len(), 50);
            assert_eq!(test.len(), 10);
        }
    }

    #[test]
    fn test_grid_search() {
        let grid = GridSearchCV::new()
            .add_param("learning_rate".to_string(), vec![0.001, 0.01, 0.1])
            .add_param("hidden_size".to_string(), vec![128.0, 256.0]);

        let combinations = grid.generate_combinations();

        assert_eq!(combinations.len(), 6); // 3 * 2
    }
}

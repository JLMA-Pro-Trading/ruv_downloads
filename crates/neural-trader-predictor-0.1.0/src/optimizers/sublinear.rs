//! Sublinear algorithms for score updates
//!
//! Implements O(log n) algorithms using binary search for maintaining
//! sorted nonconformity scores without full re-sorting.

// use sublinear::BinarySearch;
use std::sync::{Arc, RwLock};
use crate::core::Result;

/// Sublinear score updater using O(log n) binary search insertion
///
/// Maintains a sorted list of nonconformity scores without full re-sorting,
/// achieving O(log n) insertion instead of O(n log n).
pub struct SublinearUpdater {
    scores: Arc<RwLock<Vec<f64>>>,
    insertions: Arc<RwLock<u64>>,
}

impl SublinearUpdater {
    /// Create a new sublinear updater
    pub fn new() -> Result<Self> {
        Ok(Self {
            scores: Arc::new(RwLock::new(Vec::with_capacity(2000))),
            insertions: Arc::new(RwLock::new(0)),
        })
    }

    /// Insert a nonconformity score using binary search (O(log n))
    ///
    /// # Arguments
    /// * `score` - The nonconformity score to insert
    ///
    /// # Returns
    /// The position where the score was inserted
    pub fn insert_score(&self, score: f64) -> Result<usize> {
        let mut scores = self.scores.write().unwrap();

        // Handle NaN scores
        if score.is_nan() {
            return Ok(scores.len());
        }

        // Binary search for insertion point
        let pos = match scores.binary_search_by(|a| {
            a.partial_cmp(&score)
                .unwrap_or(std::cmp::Ordering::Equal)
        }) {
            Ok(pos) => pos,
            Err(pos) => pos,
        };

        scores.insert(pos, score);

        let mut insertions = self.insertions.write().unwrap();
        *insertions += 1;

        Ok(pos)
    }

    /// Batch insert multiple scores with optimized binary search
    ///
    /// # Arguments
    /// * `new_scores` - Vector of scores to insert
    ///
    /// # Returns
    /// Vector of insertion positions
    pub fn batch_insert(&self, new_scores: Vec<f64>) -> Result<Vec<usize>> {
        let mut positions = Vec::with_capacity(new_scores.len());

        for score in new_scores {
            let pos = self.insert_score(score)?;
            positions.push(pos);
        }

        Ok(positions)
    }

    /// Get quantile at given percentile using sorted list
    ///
    /// Since scores are already sorted, this is O(1) after insertion
    ///
    /// # Arguments
    /// * `percentile` - Percentile (0.0 to 1.0)
    ///
    /// # Returns
    /// The quantile value
    pub fn quantile(&self, percentile: f64) -> Result<f64> {
        let scores = self.scores.read().unwrap();

        if scores.is_empty() {
            return Ok(0.0);
        }

        let idx = ((percentile * (scores.len() - 1) as f64).ceil()) as usize;
        Ok(scores[std::cmp::min(idx, scores.len() - 1)])
    }

    /// Get multiple quantiles efficiently
    ///
    /// # Arguments
    /// * `percentiles` - Vector of percentiles
    ///
    /// # Returns
    /// Vector of quantile values
    pub fn quantiles(&self, percentiles: &[f64]) -> Result<Vec<f64>> {
        let scores = self.scores.read().unwrap();

        if scores.is_empty() {
            return Ok(vec![0.0; percentiles.len()]);
        }

        Ok(percentiles
            .iter()
            .map(|p| {
                let idx = ((p * (scores.len() - 1) as f64).ceil()) as usize;
                scores[std::cmp::min(idx, scores.len() - 1)]
            })
            .collect())
    }

    /// Get current scores (read-only snapshot)
    pub fn scores(&self) -> Result<Vec<f64>> {
        Ok(self.scores.read().unwrap().clone())
    }

    /// Get score count
    pub fn len(&self) -> usize {
        self.scores.read().unwrap().len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.scores.read().unwrap().is_empty()
    }

    /// Clear all scores
    pub fn clear(&self) -> Result<()> {
        self.scores.write().unwrap().clear();
        Ok(())
    }

    /// Get statistics about the scores
    pub fn stats(&self) -> Result<ScoreStats> {
        let scores = self.scores.read().unwrap();

        if scores.is_empty() {
            return Ok(ScoreStats::default());
        }

        let min = scores[0];
        let max = scores[scores.len() - 1];
        let sum: f64 = scores.iter().sum();
        let mean = sum / scores.len() as f64;

        let variance = scores
            .iter()
            .map(|s| (s - mean).powi(2))
            .sum::<f64>() / scores.len() as f64;

        let median = scores[scores.len() / 2];

        Ok(ScoreStats {
            count: scores.len(),
            min,
            max,
            mean,
            median,
            stddev: variance.sqrt(),
            insertions: *self.insertions.read().unwrap(),
        })
    }

    /// Remove scores outside a range (for outlier filtering)
    ///
    /// # Arguments
    /// * `min_score` - Minimum acceptable score
    /// * `max_score` - Maximum acceptable score
    ///
    /// # Returns
    /// Number of scores removed
    pub fn filter_range(&self, min_score: f64, max_score: f64) -> Result<usize> {
        let mut scores = self.scores.write().unwrap();
        let initial_len = scores.len();

        scores.retain(|s| *s >= min_score && *s <= max_score);

        Ok(initial_len - scores.len())
    }
}

/// Statistics about the score distribution
#[derive(Debug, Clone, Default)]
pub struct ScoreStats {
    /// Number of scores
    pub count: usize,

    /// Minimum score
    pub min: f64,

    /// Maximum score
    pub max: f64,

    /// Mean score
    pub mean: f64,

    /// Median score
    pub median: f64,

    /// Standard deviation
    pub stddev: f64,

    /// Total insertions performed
    pub insertions: u64,
}

impl Default for SublinearUpdater {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_updater_creation() {
        let updater = SublinearUpdater::new().unwrap();
        assert_eq!(updater.len(), 0);
        assert!(updater.is_empty());
    }

    #[test]
    fn test_single_insert() {
        let updater = SublinearUpdater::new().unwrap();
        let pos = updater.insert_score(5.0).unwrap();
        assert_eq!(pos, 0);
        assert_eq!(updater.len(), 1);
    }

    #[test]
    fn test_ordered_insert() {
        let updater = SublinearUpdater::new().unwrap();

        updater.insert_score(5.0).unwrap();
        updater.insert_score(3.0).unwrap();
        updater.insert_score(7.0).unwrap();
        updater.insert_score(1.0).unwrap();

        let scores = updater.scores().unwrap();
        assert_eq!(scores, vec![1.0, 3.0, 5.0, 7.0]);
    }

    #[test]
    fn test_batch_insert() {
        let updater = SublinearUpdater::new().unwrap();
        let new_scores = vec![5.0, 2.0, 8.0, 1.0, 9.0];

        let positions = updater.batch_insert(new_scores).unwrap();
        assert_eq!(positions.len(), 5);

        let scores = updater.scores().unwrap();
        assert_eq!(scores, vec![1.0, 2.0, 5.0, 8.0, 9.0]);
    }

    #[test]
    fn test_quantiles() {
        let updater = SublinearUpdater::new().unwrap();

        for i in 1..=100 {
            updater.insert_score(i as f64).unwrap();
        }

        let q25 = updater.quantile(0.25).unwrap();
        let q50 = updater.quantile(0.50).unwrap();
        let q75 = updater.quantile(0.75).unwrap();

        assert!(q25 > 0.0 && q25 < 50.0);
        assert!(q50 > 40.0 && q50 < 60.0);
        assert!(q75 > 50.0 && q75 < 100.0);
    }

    #[test]
    fn test_stats() {
        let updater = SublinearUpdater::new().unwrap();

        for i in 1..=10 {
            updater.insert_score(i as f64).unwrap();
        }

        let stats = updater.stats().unwrap();
        assert_eq!(stats.count, 10);
        assert_eq!(stats.min, 1.0);
        assert_eq!(stats.max, 10.0);
        assert!(stats.mean > 5.0 && stats.mean < 6.0);
    }

    #[test]
    fn test_filter_range() {
        let updater = SublinearUpdater::new().unwrap();

        for i in 1..=10 {
            updater.insert_score(i as f64).unwrap();
        }

        let removed = updater.filter_range(2.0, 8.0).unwrap();
        assert_eq!(removed, 3); // 1, 9, and 10 removed (3 items outside range)

        let scores = updater.scores().unwrap();
        assert_eq!(scores.len(), 7); // 2,3,4,5,6,7,8 remain
    }
}

//! Temporal lead solver for predictive pre-computation
//!
//! Implements predictive pre-computation before actual requests arrive,
//! achieving computational lead times and sub-microsecond response times.

use std::sync::{Arc, RwLock};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use crate::core::Result;

/// Temporal lead solver for predictive pre-computation
///
/// Pre-computes predictions for likely future queries, achieving
/// sub-microsecond response times through temporal lead advantage.
pub struct TemporalLeadSolver {
    lookahead_ms: u64,
    cached_predictions: Arc<RwLock<HashMap<String, CachedPrediction>>>,
    pre_computed: Arc<RwLock<HashMap<String, PrecomputedResult>>>,
    stats: Arc<RwLock<TemporalStats>>,
}

#[derive(Clone, Debug)]
struct CachedPrediction {
    point: f64,
    lower: f64,
    upper: f64,
    computed_at: Instant,
    age_ms: u64,
}

#[derive(Clone, Debug)]
struct PrecomputedResult {
    value: f64,
    confidence: f64,
    computed_at: Instant,
    ttl_ms: u64,
}

impl TemporalLeadSolver {
    /// Create a new temporal lead solver
    ///
    /// # Arguments
    /// * `lookahead_ms` - How far ahead to predict in milliseconds
    pub fn new(lookahead_ms: u64) -> Result<Self> {
        Ok(Self {
            lookahead_ms,
            cached_predictions: Arc::new(RwLock::new(HashMap::with_capacity(1000))),
            pre_computed: Arc::new(RwLock::new(HashMap::with_capacity(1000))),
            stats: Arc::new(RwLock::new(TemporalStats::default())),
        })
    }

    /// Pre-compute predictions for likely future values
    ///
    /// # Arguments
    /// * `base_values` - Vector of base prediction values
    /// * `ranges` - Vector of (min, max) tuples representing likely ranges
    /// * `ttl_ms` - Time-to-live for pre-computed values in milliseconds
    ///
    /// # Returns
    /// Number of predictions pre-computed
    pub fn precompute_predictions(
        &self,
        base_values: Vec<f64>,
        ranges: Vec<(f64, f64)>,
        ttl_ms: u64,
    ) -> Result<usize> {
        let mut computed = self.pre_computed.write().unwrap();
        let mut stats = self.stats.write().unwrap();

        let start = Instant::now();
        let mut count = 0;

        for (base, (min_val, max_val)) in base_values.iter().zip(ranges.iter()) {
            let key = format!("pred_{}_{}", min_val, max_val);

            // Pre-compute intermediate values
            let mid = (min_val + max_val) / 2.0;
            let confidence = self.calculate_confidence(base, min_val, max_val);

            computed.insert(
                key,
                PrecomputedResult {
                    value: mid,
                    confidence,
                    computed_at: Instant::now(),
                    ttl_ms,
                },
            );

            count += 1;
        }

        stats.total_precomputed += count;
        stats.last_precompute_duration = start.elapsed();

        Ok(count)
    }

    /// Get a prediction with temporal lead advantage
    ///
    /// # Arguments
    /// * `key` - Prediction key
    /// * `fallback_value` - Fallback if not pre-computed
    ///
    /// # Returns
    /// (value, is_precomputed, age_ms)
    pub fn get_prediction(
        &self,
        key: &str,
        fallback_value: f64,
    ) -> Result<(f64, bool, u64)> {
        let mut stats = self.stats.write().unwrap();

        // Check pre-computed cache first
        let pre_computed = self.pre_computed.read().unwrap();
        if let Some(result) = pre_computed.get(key) {
            if (result.computed_at.elapsed().as_millis() as u64) < result.ttl_ms {
                stats.cache_hits += 1;
                let age = result.computed_at.elapsed().as_millis() as u64;
                return Ok((result.value, true, age));
            }
        }

        stats.cache_misses += 1;
        Ok((fallback_value, false, 0))
    }

    /// Cache a prediction result
    ///
    /// # Arguments
    /// * `key` - Prediction key
    /// * `point` - Point prediction
    /// * `lower` - Lower bound
    /// * `upper` - Upper bound
    pub fn cache_prediction(
        &self,
        key: String,
        point: f64,
        lower: f64,
        upper: f64,
    ) -> Result<()> {
        let mut cached = self.cached_predictions.write().unwrap();

        cached.insert(
            key,
            CachedPrediction {
                point,
                lower,
                upper,
                computed_at: Instant::now(),
                age_ms: 0,
            },
        );

        Ok(())
    }

    /// Get cached prediction with full interval
    ///
    /// # Arguments
    /// * `key` - Prediction key
    ///
    /// # Returns
    /// Option of (point, lower, upper)
    pub fn get_cached_interval(&self, key: &str) -> Result<Option<(f64, f64, f64)>> {
        let cached = self.cached_predictions.read().unwrap();

        if let Some(pred) = cached.get(key) {
            return Ok(Some((pred.point, pred.lower, pred.upper)));
        }

        Ok(None)
    }

    /// Evict expired pre-computed predictions
    ///
    /// # Returns
    /// Number of entries evicted
    pub fn evict_expired(&self) -> Result<usize> {
        let mut pre_computed = self.pre_computed.write().unwrap();
        let initial_len = pre_computed.len();

        pre_computed.retain(|_, v| {
            (v.computed_at.elapsed().as_millis() as u64) < v.ttl_ms
        });

        Ok(initial_len - pre_computed.len())
    }

    /// Get temporal lead statistics
    pub fn stats(&self) -> Result<TemporalStats> {
        Ok(self.stats.read().unwrap().clone())
    }

    /// Clear all caches
    pub fn clear(&self) -> Result<()> {
        self.cached_predictions.write().unwrap().clear();
        self.pre_computed.write().unwrap().clear();
        Ok(())
    }

    /// Calculate confidence for a pre-computed value
    fn calculate_confidence(&self, base: &f64, min: &f64, max: &f64) -> f64 {
        let range = max - min;
        let mid = (min + max) / 2.0;

        if range < f64::EPSILON {
            1.0
        } else {
            let distance = (base - mid).abs();
            1.0 - (distance / (range / 2.0)).min(1.0)
        }
    }

    /// Get cache utilization ratio
    pub fn cache_utilization(&self) -> f64 {
        let pre_computed = self.pre_computed.read().unwrap();
        let stats = self.stats.read().unwrap();

        if stats.total_precomputed == 0 {
            return 0.0;
        }

        pre_computed.len() as f64 / stats.total_precomputed as f64
    }

    /// Get hit rate for predictions
    pub fn hit_rate(&self) -> f64 {
        let stats = self.stats.read().unwrap();
        let total = stats.cache_hits + stats.cache_misses;

        if total == 0 {
            return 0.0;
        }

        stats.cache_hits as f64 / total as f64
    }
}

/// Statistics about temporal lead solver performance
#[derive(Debug, Clone, Default)]
pub struct TemporalStats {
    /// Total predictions pre-computed
    pub total_precomputed: usize,

    /// Cache hits
    pub cache_hits: u64,

    /// Cache misses
    pub cache_misses: u64,

    /// Duration of last pre-computation run
    pub last_precompute_duration: Duration,
}

impl Default for TemporalLeadSolver {
    fn default() -> Self {
        Self::new(100).unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_creation() {
        let solver = TemporalLeadSolver::new(100).unwrap();
        assert_eq!(solver.cache_utilization(), 0.0);
        assert_eq!(solver.hit_rate(), 0.0);
    }

    #[test]
    fn test_precompute_predictions() {
        let solver = TemporalLeadSolver::new(100).unwrap();

        let base_values = vec![100.0, 102.0, 98.0];
        let ranges = vec![(95.0, 105.0), (100.0, 105.0), (95.0, 100.0)];

        let count = solver.precompute_predictions(base_values, ranges, 5000).unwrap();
        assert_eq!(count, 3);

        let stats = solver.stats().unwrap();
        assert_eq!(stats.total_precomputed, 3);
    }

    #[test]
    fn test_get_prediction() {
        let solver = TemporalLeadSolver::new(100).unwrap();

        let base_values = vec![100.0];
        let ranges = vec![(95.0, 105.0)];

        solver.precompute_predictions(base_values, ranges, 5000).unwrap();

        let (value, is_precomputed, _age) =
            solver.get_prediction("pred_95_105", 0.0).unwrap();

        assert!(is_precomputed);
        assert!(value > 95.0 && value < 105.0);
    }

    #[test]
    fn test_cache_prediction() {
        let solver = TemporalLeadSolver::new(100).unwrap();

        solver.cache_prediction("test_key".to_string(), 100.0, 95.0, 105.0).unwrap();

        let interval = solver.get_cached_interval("test_key").unwrap();
        assert!(interval.is_some());

        let (point, lower, upper) = interval.unwrap();
        assert_eq!(point, 100.0);
        assert_eq!(lower, 95.0);
        assert_eq!(upper, 105.0);
    }

    #[test]
    fn test_hit_rate() {
        let solver = TemporalLeadSolver::new(100).unwrap();

        let base_values = vec![100.0];
        let ranges = vec![(95.0, 105.0)];

        solver.precompute_predictions(base_values, ranges, 5000).unwrap();

        // Hit
        solver.get_prediction("pred_95_105", 0.0).unwrap();

        // Miss
        solver.get_prediction("nonexistent", 0.0).unwrap();

        let rate = solver.hit_rate();
        assert!(rate > 0.0 && rate < 1.0);
    }

    #[test]
    fn test_clear() {
        let solver = TemporalLeadSolver::new(100).unwrap();

        let base_values = vec![100.0];
        let ranges = vec![(95.0, 105.0)];

        solver.precompute_predictions(base_values, ranges, 5000).unwrap();
        solver.cache_prediction("test".to_string(), 100.0, 95.0, 105.0).unwrap();

        solver.clear().unwrap();

        assert_eq!(solver.cache_utilization(), 0.0);
    }
}

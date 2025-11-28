//! Memory-optimized preprocessing utilities with reduced allocations
//!
//! This module provides optimized versions of preprocessing functions that:
//! - Use memory pooling for buffer reuse
//! - Minimize clones and allocations
//! - Support in-place operations where possible
//! - Use stack allocation for small buffers

use super::memory_pool::TensorPool;
use super::preprocessing::NormalizationParams;

/// Optimized normalization with memory pool
///
/// Reduces allocations by reusing buffers from a pool.
///
/// # Arguments
/// * `data` - Input data
/// * `pool` - Optional memory pool for buffer reuse
///
/// # Returns
/// Tuple of (normalized_data, params)
pub fn normalize_pooled(
    data: &[f64],
    pool: Option<&TensorPool>,
) -> (Vec<f64>, NormalizationParams) {
    let params = NormalizationParams::from_data(data);

    let mut normalized = if let Some(p) = pool {
        p.get(data.len())
    } else {
        vec![0.0; data.len()]
    };

    // In-place normalization
    for (i, &x) in data.iter().enumerate() {
        normalized[i] = (x - params.mean) / params.std;
    }

    (normalized, params)
}

/// In-place normalization (mutates input)
///
/// Most efficient option - no allocations.
///
/// # Arguments
/// * `data` - Input data (mutated in-place)
///
/// # Returns
/// Normalization parameters for denormalization
pub fn normalize_in_place(data: &mut [f64]) -> NormalizationParams {
    let params = NormalizationParams::from_data(data);

    for x in data.iter_mut() {
        *x = (*x - params.mean) / params.std;
    }

    params
}

/// Denormalize in-place (mutates input)
pub fn denormalize_in_place(data: &mut [f64], params: &NormalizationParams) {
    for x in data.iter_mut() {
        *x = *x * params.std + params.mean;
    }
}

/// Optimized difference calculation with minimal allocations
pub fn difference_optimized(data: &[f64], lag: usize, pool: Option<&TensorPool>) -> Vec<f64> {
    if lag >= data.len() {
        return Vec::new();
    }

    let result_len = data.len() - lag;
    let mut result = if let Some(p) = pool {
        p.get(result_len)
    } else {
        vec![0.0; result_len]
    };

    for i in 0..result_len {
        result[i] = data[i + lag] - data[i];
    }

    result
}

/// Robust scaling with reduced allocations
pub fn robust_scale_optimized(
    data: &[f64],
    pool: Option<&TensorPool>,
) -> (Vec<f64>, f64, f64) {
    // Use small buffer for sorted data if possible
    let mut sorted = if let Some(p) = pool {
        p.get(data.len())
    } else {
        data.to_vec()
    };

    sorted.copy_from_slice(data);
    sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

    let median = sorted[sorted.len() / 2];
    let q1 = sorted[sorted.len() / 4];
    let q3 = sorted[(sorted.len() * 3) / 4];
    let iqr = q3 - q1;

    let scaled = if iqr > 1e-10 {
        let mut result = if let Some(p) = pool {
            p.get(data.len())
        } else {
            vec![0.0; data.len()]
        };

        for (i, &x) in data.iter().enumerate() {
            result[i] = (x - median) / iqr;
        }
        result
    } else {
        vec![0.0; data.len()]
    };

    // Return sorted buffer to pool
    if let Some(p) = pool {
        p.return_buffer(sorted);
    }

    (scaled, median, iqr)
}

/// Batch normalization for multiple time series
///
/// Optimized for processing many sequences with shared statistics.
///
/// # Arguments
/// * `batch` - Vector of time series
/// * `pool` - Memory pool for buffer reuse
///
/// # Returns
/// Normalized batch and shared parameters
pub fn normalize_batch(
    batch: &[Vec<f64>],
    pool: &TensorPool,
) -> (Vec<Vec<f64>>, NormalizationParams) {
    // Calculate global statistics across all series
    let total_len: usize = batch.iter().map(|s| s.len()).sum();
    let mut all_data = pool.get(total_len);

    let mut idx = 0;
    for series in batch {
        all_data[idx..idx + series.len()].copy_from_slice(series);
        idx += series.len();
    }

    let params = NormalizationParams::from_data(&all_data);

    // Normalize each series in parallel
    let normalized: Vec<Vec<f64>> = batch
        .iter()
        .map(|series| {
            let mut normalized = pool.get(series.len());
            for (i, &x) in series.iter().enumerate() {
                normalized[i] = (x - params.mean) / params.std;
            }
            normalized
        })
        .collect();

    pool.return_buffer(all_data);

    (normalized, params)
}

/// Window-based preprocessing with minimal allocations
///
/// Useful for sliding window operations where buffers can be reused.
pub struct WindowPreprocessor {
    pool: TensorPool,
    window_size: usize,
    stride: usize,
}

impl WindowPreprocessor {
    /// Create a new window preprocessor
    pub fn new(window_size: usize, stride: usize) -> Self {
        Self {
            pool: TensorPool::new(64), // Larger pool for windows
            window_size,
            stride,
        }
    }

    /// Extract windows with normalization
    pub fn process_windows(&self, data: &[f64]) -> Vec<(Vec<f64>, NormalizationParams)> {
        let num_windows = (data.len() - self.window_size) / self.stride + 1;
        let mut results = Vec::with_capacity(num_windows);

        for i in 0..num_windows {
            let start = i * self.stride;
            let end = start + self.window_size;
            let window = &data[start..end];

            let (normalized, params) = normalize_pooled(window, Some(&self.pool));
            results.push((normalized, params));
        }

        results
    }

    /// Get pool statistics
    pub fn pool_stats(&self) -> super::memory_pool::PoolStats {
        self.pool.stats()
    }
}

/// Zero-copy preprocessing operations using Cow (Copy-on-Write)
pub mod zero_copy {
    use std::borrow::Cow;

    /// Normalize with zero-copy if data doesn't need modification
    pub fn maybe_normalize(data: &[f64]) -> Cow<'_, [f64]> {
        // Check if already normalized (mean ~0, std ~1)
        let mean = data.iter().sum::<f64>() / data.len() as f64;
        let variance = data.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / data.len() as f64;
        let std = variance.sqrt();

        if (mean.abs() < 0.1) && ((std - 1.0).abs() < 0.1) {
            // Already normalized, return borrowed
            Cow::Borrowed(data)
        } else {
            // Need to normalize, return owned
            let normalized: Vec<f64> = data
                .iter()
                .map(|x| (x - mean) / std)
                .collect();
            Cow::Owned(normalized)
        }
    }

    /// Apply transformation only if needed
    pub fn maybe_transform<F>(data: &[f64], predicate: F) -> Cow<'_, [f64]>
    where
        F: Fn(&[f64]) -> bool,
    {
        if predicate(data) {
            // Need transformation
            Cow::Owned(data.to_vec())
        } else {
            // No transformation needed
            Cow::Borrowed(data)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::borrow::Cow;

    #[test]
    fn test_normalize_pooled() {
        let data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let pool = TensorPool::new(10);

        let (normalized, _params) = normalize_pooled(&data, Some(&pool));

        let stats = pool.stats();
        assert_eq!(stats.misses, 1); // First allocation

        // Second call should reuse buffer
        pool.return_buffer(normalized);
        let (_normalized2, _) = normalize_pooled(&data, Some(&pool));

        let stats = pool.stats();
        assert_eq!(stats.hits, 1); // Buffer reused
    }

    #[test]
    fn test_normalize_in_place() {
        let mut data = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let params = normalize_in_place(&mut data);

        // Check normalized
        let mean = data.iter().sum::<f64>() / data.len() as f64;
        assert!(mean.abs() < 1e-10);

        // Denormalize
        denormalize_in_place(&mut data, &params);
        assert!((data[0] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_window_preprocessor() {
        let data: Vec<f64> = (0..100).map(|x| x as f64).collect();
        let processor = WindowPreprocessor::new(10, 5);

        let windows = processor.process_windows(&data);
        assert!(windows.len() > 0);

        let _stats = processor.pool_stats();
        println!("Pool hit rate: {:.2}%", processor.pool.hit_rate() * 100.0);
    }

    #[test]
    fn test_zero_copy_maybe_normalize() {
        // Data with mean = 0 and std = 1.0 (already normalized)
        // Values: mean = 0, variance = (2.25 + 0.25 + 0 + 0.25 + 2.25)/5 = 1.0
        let normalized = vec![-1.5, -0.5, 0.0, 0.5, 1.5]; // std = 1.0 exactly
        let result = zero_copy::maybe_normalize(&normalized);

        // Should be borrowed (zero-copy) since already normalized
        assert!(matches!(result, Cow::Borrowed(_)));

        // Test data that needs normalization
        let unnormalized = vec![10.0, 20.0, 30.0, 40.0, 50.0];
        let result2 = zero_copy::maybe_normalize(&unnormalized);

        // Should be owned (needs normalization)
        assert!(matches!(result2, Cow::Owned(_)));
    }

    #[test]
    fn test_normalize_batch() {
        let batch = vec![
            vec![1.0, 2.0, 3.0],
            vec![4.0, 5.0, 6.0],
            vec![7.0, 8.0, 9.0],
        ];
        let pool = TensorPool::new(10);

        let (normalized, _params) = normalize_batch(&batch, &pool);
        assert_eq!(normalized.len(), 3);

        let stats = pool.stats();
        println!("Batch normalization pool stats: {:?}", stats);
    }
}

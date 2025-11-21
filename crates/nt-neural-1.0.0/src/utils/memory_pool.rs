//! Memory pool for efficient buffer reuse and reduced allocations
//!
//! This module provides memory pooling utilities to minimize heap allocations
//! in hot paths, particularly for vector operations in preprocessing and inference.

use std::sync::{Arc, Mutex};

/// Thread-safe memory pool for Vec<f64> buffers
///
/// Reduces allocation overhead by reusing pre-allocated buffers.
/// Particularly useful for normalization, preprocessing, and batch operations.
pub struct TensorPool {
    /// Pool of reusable buffers
    pool: Arc<Mutex<Vec<Vec<f64>>>>,
    /// Maximum number of buffers to cache
    max_size: usize,
    /// Statistics for monitoring
    stats: Arc<Mutex<PoolStats>>,
}

/// Pool statistics for monitoring performance
#[derive(Debug, Default, Clone)]
pub struct PoolStats {
    /// Number of times a buffer was reused
    pub hits: usize,
    /// Number of times a new buffer was allocated
    pub misses: usize,
    /// Number of buffers returned to pool
    pub returns: usize,
    /// Current pool size
    pub current_size: usize,
}

impl TensorPool {
    /// Create a new tensor pool
    ///
    /// # Arguments
    /// * `max_size` - Maximum number of buffers to cache (default: 32)
    pub fn new(max_size: usize) -> Self {
        Self {
            pool: Arc::new(Mutex::new(Vec::with_capacity(max_size))),
            max_size,
            stats: Arc::new(Mutex::new(PoolStats::default())),
        }
    }

    /// Get a buffer from the pool or allocate a new one
    ///
    /// The returned buffer is cleared and resized to the requested size.
    ///
    /// # Arguments
    /// * `size` - Size of the buffer needed
    ///
    /// # Returns
    /// A Vec<f64> of the requested size, either from the pool or newly allocated
    pub fn get(&self, size: usize) -> Vec<f64> {
        let mut pool = self.pool.lock().unwrap();
        let mut stats = self.stats.lock().unwrap();

        if let Some(mut buffer) = pool.pop() {
            stats.hits += 1;
            stats.current_size = pool.len();
            drop(pool);
            drop(stats);

            // Reuse buffer: clear and resize
            buffer.clear();
            buffer.resize(size, 0.0);
            buffer
        } else {
            stats.misses += 1;
            drop(pool);
            drop(stats);

            // Allocate new buffer
            vec![0.0; size]
        }
    }

    /// Return a buffer to the pool for reuse
    ///
    /// The buffer is only added if the pool hasn't reached max_size.
    ///
    /// # Arguments
    /// * `buffer` - Buffer to return to the pool
    pub fn return_buffer(&self, buffer: Vec<f64>) {
        let mut pool = self.pool.lock().unwrap();
        let mut stats = self.stats.lock().unwrap();

        if pool.len() < self.max_size {
            pool.push(buffer);
            stats.returns += 1;
            stats.current_size = pool.len();
        }
        // Otherwise drop buffer (let it be deallocated)
    }

    /// Get pool statistics
    pub fn stats(&self) -> PoolStats {
        self.stats.lock().unwrap().clone()
    }

    /// Clear all buffers from the pool
    pub fn clear(&self) {
        let mut pool = self.pool.lock().unwrap();
        let mut stats = self.stats.lock().unwrap();
        pool.clear();
        stats.current_size = 0;
    }

    /// Get pool hit rate (percentage of reuses vs allocations)
    pub fn hit_rate(&self) -> f64 {
        let stats = self.stats.lock().unwrap();
        let total = stats.hits + stats.misses;
        if total == 0 {
            0.0
        } else {
            stats.hits as f64 / total as f64
        }
    }

    /// Get current pool size
    pub fn size(&self) -> usize {
        self.pool.lock().unwrap().len()
    }
}

impl Default for TensorPool {
    fn default() -> Self {
        Self::new(32)
    }
}

/// RAII guard for automatic buffer return to pool
///
/// Ensures buffers are automatically returned to the pool when dropped.
pub struct PooledBuffer {
    buffer: Option<Vec<f64>>,
    pool: Arc<Mutex<Vec<Vec<f64>>>>,
}

impl PooledBuffer {
    /// Create a new pooled buffer
    pub fn new(buffer: Vec<f64>, pool: Arc<Mutex<Vec<Vec<f64>>>>) -> Self {
        Self {
            buffer: Some(buffer),
            pool,
        }
    }

    /// Get a reference to the buffer
    pub fn as_slice(&self) -> &[f64] {
        self.buffer.as_ref().unwrap().as_slice()
    }

    /// Get a mutable reference to the buffer
    pub fn as_mut_slice(&mut self) -> &mut [f64] {
        self.buffer.as_mut().unwrap().as_mut_slice()
    }

    /// Take ownership of the buffer (prevents return to pool)
    pub fn take(mut self) -> Vec<f64> {
        self.buffer.take().unwrap()
    }
}

impl Drop for PooledBuffer {
    fn drop(&mut self) {
        if let Some(buffer) = self.buffer.take() {
            let mut pool = self.pool.lock().unwrap();
            pool.push(buffer);
        }
    }
}

impl std::ops::Deref for PooledBuffer {
    type Target = [f64];

    fn deref(&self) -> &Self::Target {
        self.as_slice()
    }
}

impl std::ops::DerefMut for PooledBuffer {
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.as_mut_slice()
    }
}

/// Small buffer optimization using stack allocation
///
/// For small arrays (< 32 elements), use stack allocation instead of heap.
/// This is particularly useful for short sequences or small batches.
pub struct SmallBuffer<const N: usize> {
    data: smallvec::SmallVec<[f64; N]>,
}

impl<const N: usize> SmallBuffer<N> {
    /// Create a new small buffer with capacity
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            data: smallvec::SmallVec::with_capacity(capacity),
        }
    }

    /// Create from slice
    pub fn from_slice(slice: &[f64]) -> Self {
        Self {
            data: smallvec::SmallVec::from_slice(slice),
        }
    }

    /// Get the underlying data
    pub fn as_slice(&self) -> &[f64] {
        &self.data
    }

    /// Get mutable slice
    pub fn as_mut_slice(&mut self) -> &mut [f64] {
        &mut self.data
    }

    /// Convert to Vec (may allocate if not already on heap)
    pub fn to_vec(self) -> Vec<f64> {
        self.data.to_vec()
    }

    /// Push a value
    pub fn push(&mut self, value: f64) {
        self.data.push(value);
    }

    /// Length of buffer
    pub fn len(&self) -> usize {
        self.data.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    /// Check if data is on stack (inline)
    pub fn is_inline(&self) -> bool {
        self.data.spilled()
    }
}

impl<const N: usize> Default for SmallBuffer<N> {
    fn default() -> Self {
        Self {
            data: smallvec::SmallVec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_reuse() {
        let pool = TensorPool::new(10);

        // First get - should miss (allocate)
        let buf1 = pool.get(100);
        assert_eq!(buf1.len(), 100);

        let stats = pool.stats();
        assert_eq!(stats.misses, 1);
        assert_eq!(stats.hits, 0);

        // Return buffer
        pool.return_buffer(buf1);
        assert_eq!(pool.size(), 1);

        // Second get - should hit (reuse)
        let buf2 = pool.get(100);
        assert_eq!(buf2.len(), 100);

        let stats = pool.stats();
        assert_eq!(stats.hits, 1);
        assert_eq!(stats.misses, 1);
    }

    #[test]
    fn test_pool_max_size() {
        let pool = TensorPool::new(2);

        // Return 3 buffers
        pool.return_buffer(vec![0.0; 10]);
        pool.return_buffer(vec![0.0; 10]);
        pool.return_buffer(vec![0.0; 10]);

        // Only 2 should be kept
        assert_eq!(pool.size(), 2);
    }

    #[test]
    fn test_pool_hit_rate() {
        let pool = TensorPool::new(10);

        pool.return_buffer(vec![0.0; 100]);

        pool.get(100); // Hit
        pool.get(100); // Miss

        let hit_rate = pool.hit_rate();
        assert!((hit_rate - 0.5).abs() < 0.01);
    }

    #[test]
    fn test_pooled_buffer_auto_return() {
        let pool = TensorPool::new(10);
        let pool_ref = pool.pool.clone();

        {
            let buffer = pool.get(100);
            let _pooled = PooledBuffer::new(buffer, pool_ref.clone());
            // Pooled buffer dropped here
        }

        // Buffer should be back in pool
        assert_eq!(pool_ref.lock().unwrap().len(), 1);
    }

    #[test]
    fn test_small_buffer_inline() {
        // Small buffer should be inline (stack allocated)
        let mut buf: SmallBuffer<32> = SmallBuffer::with_capacity(16);
        for i in 0..16 {
            buf.push(i as f64);
        }

        assert_eq!(buf.len(), 16);
        assert!(!buf.is_inline()); // Not spilled yet
    }

    #[test]
    fn test_small_buffer_spills() {
        // Buffer should spill to heap when exceeding inline capacity
        let mut buf: SmallBuffer<8> = SmallBuffer::default();
        for i in 0..16 {
            buf.push(i as f64);
        }

        assert_eq!(buf.len(), 16);
        assert!(buf.is_inline()); // Should have spilled
    }

    #[test]
    fn test_pool_clear() {
        let pool = TensorPool::new(10);
        pool.return_buffer(vec![0.0; 100]);
        pool.return_buffer(vec![0.0; 100]);

        assert_eq!(pool.size(), 2);

        pool.clear();
        assert_eq!(pool.size(), 0);
    }
}

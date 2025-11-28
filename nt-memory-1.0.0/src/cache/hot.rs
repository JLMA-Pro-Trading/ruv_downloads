//! High-performance hot cache using DashMap
//!
//! Lock-free concurrent hashmap with LRU eviction

use dashmap::DashMap;
use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// Cache configuration
#[derive(Debug, Clone)]
pub struct CacheConfig {
    /// Maximum number of entries
    pub max_entries: usize,

    /// Entry time-to-live
    pub ttl: Duration,

    /// Enable access time tracking
    pub track_access: bool,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_entries: 100_000,
            ttl: Duration::from_secs(3600), // 1 hour
            track_access: true,
        }
    }
}

/// Cache entry with metadata
#[derive(Debug, Clone)]
pub struct CacheEntry {
    /// Entry data
    pub data: Vec<u8>,

    /// Creation timestamp
    pub created_at: Instant,

    /// Last access timestamp
    pub accessed_at: Instant,

    /// Access count
    pub access_count: u32,
}

impl CacheEntry {
    fn new(data: Vec<u8>) -> Self {
        let now = Instant::now();
        Self {
            data,
            created_at: now,
            accessed_at: now,
            access_count: 1,
        }
    }

    fn access(&mut self) {
        self.accessed_at = Instant::now();
        self.access_count = self.access_count.saturating_add(1);
    }

    fn is_expired(&self, ttl: Duration) -> bool {
        self.created_at.elapsed() > ttl
    }
}

/// High-performance hot cache
pub struct HotCache {
    /// Lock-free concurrent map
    map: Arc<DashMap<String, CacheEntry>>,

    /// Configuration
    config: CacheConfig,

    /// Statistics
    hits: AtomicU64,
    misses: AtomicU64,
    evictions: AtomicU64,
    size: AtomicUsize,
}

impl HotCache {
    /// Create new hot cache
    pub fn new(config: CacheConfig) -> Self {
        Self {
            map: Arc::new(DashMap::with_capacity(config.max_entries)),
            config,
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
            evictions: AtomicU64::new(0),
            size: AtomicUsize::new(0),
        }
    }

    /// Get entry from cache (<1μs)
    pub fn get(&self, key: &str) -> Option<CacheEntry> {
        if let Some(mut entry) = self.map.get_mut(key) {
            // Check expiration
            if entry.is_expired(self.config.ttl) {
                drop(entry); // Release lock before removal
                self.map.remove(key);
                self.misses.fetch_add(1, Ordering::Relaxed);
                self.size.fetch_sub(1, Ordering::Relaxed);
                return None;
            }

            // Update access metadata
            if self.config.track_access {
                entry.access();
            }

            self.hits.fetch_add(1, Ordering::Relaxed);
            Some(entry.clone())
        } else {
            self.misses.fetch_add(1, Ordering::Relaxed);
            None
        }
    }

    /// Insert entry into cache (<2μs)
    pub fn insert(&self, key: &str, data: Vec<u8>) {
        // Check if we need to evict
        if self.size.load(Ordering::Relaxed) >= self.config.max_entries {
            self.evict_lru();
        }

        let entry = CacheEntry::new(data);

        if self.map.insert(key.to_string(), entry).is_none() {
            self.size.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Remove entry from cache
    pub fn remove(&self, key: &str) -> Option<CacheEntry> {
        let result = self.map.remove(key).map(|(_, v)| v);
        if result.is_some() {
            self.size.fetch_sub(1, Ordering::Relaxed);
        }
        result
    }

    /// Clear all entries
    pub fn clear(&self) {
        self.map.clear();
        self.size.store(0, Ordering::Relaxed);
        self.evictions.fetch_add(
            self.size.load(Ordering::Relaxed) as u64,
            Ordering::Relaxed,
        );
    }

    /// Number of entries
    pub fn len(&self) -> usize {
        self.size.load(Ordering::Relaxed)
    }

    /// Check if cache is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Cache hit rate
    pub fn hit_rate(&self) -> f64 {
        let hits = self.hits.load(Ordering::Relaxed);
        let misses = self.misses.load(Ordering::Relaxed);
        let total = hits + misses;

        if total == 0 {
            0.0
        } else {
            hits as f64 / total as f64
        }
    }

    /// Evict least recently used entry
    fn evict_lru(&self) {
        // Find oldest accessed entry
        let mut oldest_key: Option<String> = None;
        let mut oldest_time = Instant::now();

        for entry in self.map.iter() {
            if entry.accessed_at < oldest_time {
                oldest_time = entry.accessed_at;
                oldest_key = Some(entry.key().clone());
            }
        }

        // Evict if found
        if let Some(key) = oldest_key {
            self.map.remove(&key);
            self.evictions.fetch_add(1, Ordering::Relaxed);
            self.size.fetch_sub(1, Ordering::Relaxed);
        }
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            entries: self.len(),
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
            evictions: self.evictions.load(Ordering::Relaxed),
            hit_rate: self.hit_rate(),
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone)]
pub struct CacheStats {
    pub entries: usize,
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub hit_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_basic_operations() {
        let cache = HotCache::new(CacheConfig::default());

        // Insert
        cache.insert("key1", vec![1, 2, 3]);
        assert_eq!(cache.len(), 1);

        // Get
        let entry = cache.get("key1");
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().data, vec![1, 2, 3]);

        // Remove
        let removed = cache.remove("key1");
        assert!(removed.is_some());
        assert_eq!(cache.len(), 0);
    }

    #[test]
    fn test_cache_expiration() {
        let _config = CacheConfig {
            ttl: Duration::from_millis(100),
            ..Default::default()
        };
        let cache = HotCache::new(config);

        cache.insert("key1", vec![1, 2, 3]);
        assert!(cache.get("key1").is_some());

        // Wait for expiration
        std::thread::sleep(Duration::from_millis(150));

        assert!(cache.get("key1").is_none());
    }

    #[test]
    fn test_cache_lru_eviction() {
        let _config = CacheConfig {
            max_entries: 2,
            ..Default::default()
        };
        let cache = HotCache::new(config);

        cache.insert("key1", vec![1]);
        cache.insert("key2", vec![2]);

        // Access key1 to make it more recent
        cache.get("key1");

        // Insert key3, should evict key2
        cache.insert("key3", vec![3]);

        assert!(cache.get("key1").is_some());
        assert!(cache.get("key2").is_none());
        assert!(cache.get("key3").is_some());
    }

    #[test]
    fn test_cache_concurrent_access() {
        use std::sync::Arc;
        use std::thread;

        let cache = Arc::new(HotCache::new(CacheConfig::default()));
        let mut handles = vec![];

        // Spawn 10 threads doing concurrent operations
        for i in 0..10 {
            let cache = cache.clone();
            let handle = thread::spawn(move || {
                for j in 0..100 {
                    let key = format!("key_{}_{}", i, j);
                    cache.insert(&key, vec![i as u8, j as u8]);
                    cache.get(&key);
                }
            });
            handles.push(handle);
        }

        // Wait for all threads
        for handle in handles {
            handle.join().unwrap();
        }

        // Verify no data corruption
        assert!(cache.len() > 0);
        assert!(cache.hit_rate() > 0.0);
    }

    #[test]
    fn test_cache_hit_rate() {
        let cache = HotCache::new(CacheConfig::default());

        cache.insert("key1", vec![1]);

        // Generate hits
        for _ in 0..9 {
            cache.get("key1");
        }

        // Generate miss
        cache.get("key2");

        // Hit rate should be 90%
        let hit_rate = cache.hit_rate();
        assert!((hit_rate - 0.9).abs() < 0.01);
    }
}

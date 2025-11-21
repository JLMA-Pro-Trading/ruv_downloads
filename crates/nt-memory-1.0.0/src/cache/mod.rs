//! L1 Hot Cache - Sub-microsecond lookup with DashMap
//!
//! Performance targets:
//! - Lookup: <1μs (p99)
//! - Insert: <2μs (p99)
//! - Thread-safe without locks (lock-free)

pub mod hot;

pub use hot::{HotCache, CacheConfig, CacheEntry};

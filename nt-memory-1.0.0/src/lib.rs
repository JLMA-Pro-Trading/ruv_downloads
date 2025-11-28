//! Neural Trader Memory Systems
//!
//! Three-tier memory hierarchy for high-performance agent coordination:
//!
//! - **L1 Cache**: Hot cache with DashMap (<1μs lookup)
//! - **L2 Vector DB**: AgentDB for semantic search (<1ms p95)
//! - **L3 Cold Storage**: Sled embedded database (>10ms)
//!
//! ## Features
//!
//! - Vector embeddings and semantic search
//! - ReasoningBank trajectory tracking
//! - Cross-agent coordination with pub/sub
//! - Distributed locks and consensus
//! - Memory distillation and compression
//! - Session persistence
//!
//! ## Performance Targets
//!
//! - L1 cache: <1μs lookup
//! - Vector search: <1ms (p95)
//! - Position lookup: <100ns (p99)
//! - Memory footprint: <1GB for 1M observations
//! - Cross-agent latency: <5ms

pub mod cache;
pub mod agentdb;
pub mod reasoningbank;
pub mod coordination;

// Re-exports for convenient access
pub use cache::{HotCache, CacheConfig, CacheEntry};
pub use agentdb::{VectorStore, EmbeddingProvider};
pub use reasoningbank::{
    TrajectoryTracker,
    VerdictJudge,
    MemoryDistiller,
    Trajectory,
    Verdict,
};
pub use coordination::{
    PubSubBroker,
    DistributedLock,
    ConsensusEngine,
    Namespace,
};

use thiserror::Error;

/// Memory system errors
#[derive(Debug, Error)]
pub enum MemoryError {
    #[error("Cache error: {0}")]
    Cache(String),

    #[error("Vector database error: {0}")]
    VectorDB(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("Coordination error: {0}")]
    Coordination(String),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Lock acquisition timeout")]
    LockTimeout,

    #[error("Consensus not reached")]
    ConsensusFailure,

    #[error("Invalid namespace: {0}")]
    InvalidNamespace(String),
}

pub type Result<T> = std::result::Result<T, MemoryError>;

/// Memory system configuration
#[derive(Debug, Clone)]
pub struct MemoryConfig {
    /// L1 cache configuration
    pub cache_config: CacheConfig,

    /// AgentDB base URL
    pub agentdb_url: String,

    /// Cold storage path
    pub storage_path: String,

    /// Enable compression for distillation
    pub enable_compression: bool,

    /// Maximum memory footprint (bytes)
    pub max_memory_bytes: usize,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            cache_config: CacheConfig::default(),
            agentdb_url: "http://localhost:3000".to_string(),
            storage_path: "./data/memory".to_string(),
            enable_compression: true,
            max_memory_bytes: 1_073_741_824, // 1GB
        }
    }
}

/// Unified memory system interface
pub struct MemorySystem {
    /// L1: Hot cache
    cache: HotCache,

    /// L2: Vector database
    vector_store: VectorStore,

    /// L3: Cold storage
    cold_storage: sled::Db,

    /// ReasoningBank components
    trajectory_tracker: TrajectoryTracker,
    verdict_judge: VerdictJudge,
    distiller: MemoryDistiller,

    /// Coordination components
    pubsub: PubSubBroker,
    locks: DistributedLock,
    consensus: ConsensusEngine,

    /// Configuration
    config: MemoryConfig,
}

impl MemorySystem {
    /// Create new memory system
    pub async fn new(config: MemoryConfig) -> Result<Self> {
        // Initialize L1 cache
        let cache = HotCache::new(config.cache_config.clone());

        // Initialize L2 vector store
        let vector_store = VectorStore::new(&config.agentdb_url)
            .await
            .map_err(|e| MemoryError::VectorDB(e.to_string()))?;

        // Initialize L3 cold storage
        let cold_storage = sled::open(&config.storage_path)
            .map_err(|e| MemoryError::Storage(e.to_string()))?;

        // Initialize ReasoningBank
        let trajectory_tracker = TrajectoryTracker::new();
        let verdict_judge = VerdictJudge::new();
        let distiller = MemoryDistiller::new(config.enable_compression);

        // Initialize coordination
        let pubsub = PubSubBroker::new();
        let locks = DistributedLock::new();
        let consensus = ConsensusEngine::new();

        Ok(Self {
            cache,
            vector_store,
            cold_storage,
            trajectory_tracker,
            verdict_judge,
            distiller,
            pubsub,
            locks,
            consensus,
            config,
        })
    }

    /// Get from memory (tries L1 -> L2 -> L3)
    pub async fn get(&self, namespace: &str, key: &str) -> Result<Option<Vec<u8>>> {
        let full_key = format!("{}/{}", namespace, key);

        // Try L1 cache
        if let Some(entry) = self.cache.get(&full_key) {
            tracing::debug!("L1 cache hit: {}", full_key);
            return Ok(Some(entry.data));
        }

        // Try L3 cold storage
        if let Some(data) = self.cold_storage
            .get(full_key.as_bytes())
            .map_err(|e| MemoryError::Storage(e.to_string()))?
        {
            tracing::debug!("L3 storage hit: {}", full_key);

            // Promote to L1
            self.cache.insert(&full_key, data.to_vec());

            return Ok(Some(data.to_vec()));
        }

        tracing::debug!("Cache miss: {}", full_key);
        Ok(None)
    }

    /// Store in memory (writes to all tiers)
    pub async fn put(&self, namespace: &str, key: &str, value: Vec<u8>) -> Result<()> {
        let full_key = format!("{}/{}", namespace, key);

        // Write to L1
        self.cache.insert(&full_key, value.clone());

        // Write to L3 (async)
        self.cold_storage
            .insert(full_key.as_bytes(), value.as_slice())
            .map_err(|e| MemoryError::Storage(e.to_string()))?;

        tracing::debug!("Stored: {}", full_key);
        Ok(())
    }

    /// Semantic search using L2 vector store
    pub async fn search_similar(
        &self,
        namespace: &str,
        query_embedding: Vec<f32>,
        top_k: usize,
    ) -> Result<Vec<(String, f32)>> {
        self.vector_store
            .search(namespace, query_embedding, top_k)
            .await
            .map_err(|e| MemoryError::VectorDB(e.to_string()))
    }

    /// Track agent trajectory
    pub async fn track_trajectory(&self, trajectory: Trajectory) -> Result<()> {
        self.trajectory_tracker
            .track(trajectory)
            .await
            .map_err(|e| MemoryError::Storage(e.to_string()))
    }

    /// Subscribe to agent messages
    pub async fn subscribe(&self, topic: &str) -> Result<tokio::sync::mpsc::Receiver<Vec<u8>>> {
        self.pubsub
            .subscribe(topic)
            .await
            .map_err(|e| MemoryError::Coordination(e.to_string()))
    }

    /// Publish message to agents
    pub async fn publish(&self, topic: &str, message: Vec<u8>) -> Result<()> {
        self.pubsub
            .publish(topic, message)
            .await
            .map_err(|e| MemoryError::Coordination(e.to_string()))
    }

    /// Acquire distributed lock
    pub async fn acquire_lock(
        &self,
        resource: &str,
        timeout: std::time::Duration,
    ) -> Result<String> {
        self.locks
            .acquire(resource, timeout)
            .await
            .map_err(|e| MemoryError::Coordination(e.to_string()))
    }

    /// Release distributed lock
    pub async fn release_lock(&self, token: &str) -> Result<()> {
        self.locks
            .release(token)
            .await
            .map_err(|e| MemoryError::Coordination(e.to_string()))
    }

    /// Get memory statistics
    pub fn stats(&self) -> MemoryStats {
        MemoryStats {
            l1_entries: self.cache.len(),
            l1_hit_rate: self.cache.hit_rate(),
            l3_size_bytes: self.cold_storage.size_on_disk().unwrap_or(0),
            total_trajectories: self.trajectory_tracker.count(),
        }
    }
}

/// Memory system statistics
#[derive(Debug, Clone)]
pub struct MemoryStats {
    pub l1_entries: usize,
    pub l1_hit_rate: f64,
    pub l3_size_bytes: u64,
    pub total_trajectories: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_memory_system_creation() {
        let mem_config = MemoryConfig {
            storage_path: tempfile::tempdir().unwrap().path().to_str().unwrap().to_string(),
            ..Default::default()
        };

        let memory = MemorySystem::new(mem_config).await;
        assert!(memory.is_ok());
    }
}

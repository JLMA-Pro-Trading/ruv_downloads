//! System builder for fluent API configuration

use super::{
    AgentPool, AgenticVerificationSystem, MeshTopology, SystemHealth, SystemMetrics, Topology,
};
use crate::agents::{BasicVerificationAgent, VerificationAgent};
use crate::consensus::{ConsensusConfig, ConsensusEngine};
use crate::error::{Error, Result};
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Fluent builder for AgenticVerificationSystem
pub struct SystemBuilder {
    pool_size: usize,
    consensus_threshold: f64,
    consensus_timeout_ms: u64,
    max_pool_size: usize,
}

impl SystemBuilder {
    /// Create a new system builder
    pub fn new() -> Self {
        Self {
            pool_size: 5,
            consensus_threshold: 0.67,
            consensus_timeout_ms: 100,
            max_pool_size: 100,
        }
    }

    /// Set the agent pool size
    pub fn pool_size(mut self, size: usize) -> Self {
        self.pool_size = size;
        self
    }

    /// Set the consensus threshold (0.0-1.0)
    pub fn consensus_threshold(mut self, threshold: f64) -> Self {
        self.consensus_threshold = threshold;
        self
    }

    /// Set the consensus timeout in milliseconds
    pub fn consensus_timeout_ms(mut self, timeout_ms: u64) -> Self {
        self.consensus_timeout_ms = timeout_ms;
        self
    }

    /// Set the maximum pool size
    pub fn max_pool_size(mut self, max_size: usize) -> Self {
        self.max_pool_size = max_size;
        self
    }

    /// Build the AgenticVerificationSystem
    pub async fn build(self) -> Result<AgenticVerificationSystem> {
        // Validate configuration
        if self.pool_size < 3 {
            return Err(Error::config("Pool size must be at least 3 for BFT consensus"));
        }

        if self.pool_size > self.max_pool_size {
            return Err(Error::config(format!(
                "Pool size {} exceeds maximum {}",
                self.pool_size, self.max_pool_size
            )));
        }

        if !(0.0..=1.0).contains(&self.consensus_threshold) {
            return Err(Error::config("Consensus threshold must be between 0.0 and 1.0"));
        }

        // Create consensus configuration
        let consensus_config = ConsensusConfig::new(
            self.consensus_threshold,
            self.consensus_timeout_ms,
        )?;

        // Create agent pool
        let mut pool = AgentPool::new(self.max_pool_size);

        // Spawn initial agents
        for _ in 0..self.pool_size {
            let agent = BasicVerificationAgent::new()?;
            pool.add_agent(Arc::new(agent) as Arc<dyn VerificationAgent>)
                .await?;
        }

        // Create mesh topology
        let topology: Arc<dyn Topology + Send + Sync> = Arc::new(MeshTopology::new());

        // Create consensus engine
        let consensus_engine = ConsensusEngine::new(consensus_config);

        // Create metrics and health
        let metrics = SystemMetrics::new();
        let health = SystemHealth::new();

        Ok(AgenticVerificationSystem {
            id: Uuid::new_v4(),
            pool: Arc::new(RwLock::new(pool)),
            topology,
            consensus_engine: Arc::new(consensus_engine),
            metrics: Arc::new(RwLock::new(metrics)),
            health: Arc::new(RwLock::new(health)),
        })
    }
}

impl Default for SystemBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_builder_default() {
        let system = SystemBuilder::new().build().await.unwrap();
        assert_eq!(system.pool_size().await, 5);
    }

    #[tokio::test]
    async fn test_builder_custom_pool_size() {
        let system = SystemBuilder::new()
            .pool_size(10)
            .build()
            .await
            .unwrap();
        assert_eq!(system.pool_size().await, 10);
    }

    #[tokio::test]
    async fn test_builder_invalid_pool_size() {
        let result = SystemBuilder::new().pool_size(1).build().await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_builder_custom_threshold() {
        let system = SystemBuilder::new()
            .consensus_threshold(0.75)
            .pool_size(4)
            .build()
            .await
            .unwrap();
        assert_eq!(system.pool_size().await, 4);
    }

    #[tokio::test]
    async fn test_builder_invalid_threshold() {
        let result = SystemBuilder::new()
            .consensus_threshold(1.5)
            .build()
            .await;
        assert!(result.is_err());
    }
}
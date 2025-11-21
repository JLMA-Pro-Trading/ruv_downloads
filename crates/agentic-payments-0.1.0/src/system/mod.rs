//! System module for agent coordination and verification
//!
//! This module provides the main `AgenticVerificationSystem` that orchestrates
//! multi-agent signature verification with Byzantine fault tolerance.

mod builder;
mod health;
mod metrics;
mod pool;
mod topology;

pub use builder::SystemBuilder;
pub use health::{HealthCheck, HealthStatus, SystemHealth};
pub use metrics::{Metrics, SystemMetrics};
pub use pool::AgentPool;
pub use topology::{MeshTopology, Topology};

use crate::agents::VerificationAgent;
use crate::consensus::{ConsensusEngine, ConsensusResult};
use crate::crypto::Signature;
use crate::error::{Error, Result};
use ed25519_dalek::VerifyingKey;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Main agentic verification system with multi-agent consensus
pub struct AgenticVerificationSystem {
    pub(crate) id: Uuid,
    pub(crate) pool: Arc<RwLock<AgentPool>>,
    pub(crate) topology: Arc<dyn Topology + Send + Sync>,
    pub(crate) consensus_engine: Arc<ConsensusEngine>,
    pub(crate) metrics: Arc<RwLock<SystemMetrics>>,
    pub(crate) health: Arc<RwLock<SystemHealth>>,
}

impl Clone for AgenticVerificationSystem {
    fn clone(&self) -> Self {
        Self {
            id: self.id,
            pool: Arc::clone(&self.pool),
            topology: Arc::clone(&self.topology),
            consensus_engine: Arc::clone(&self.consensus_engine),
            metrics: Arc::clone(&self.metrics),
            health: Arc::clone(&self.health),
        }
    }
}

impl AgenticVerificationSystem {
    /// Create a new system builder
    pub fn builder() -> SystemBuilder {
        SystemBuilder::new()
    }

    /// Get system ID
    pub fn id(&self) -> Uuid {
        self.id
    }

    /// Get current pool size
    pub async fn pool_size(&self) -> usize {
        self.pool.read().await.size()
    }

    /// Scale the agent pool to target size
    pub async fn scale_pool(&self, target_size: usize) -> Result<()> {
        self.pool.write().await.scale(target_size).await
    }

    /// Verify signature with multi-agent consensus
    pub async fn verify_with_consensus(
        &self,
        signature: Signature,
        message: &[u8],
        public_key: &VerifyingKey,
    ) -> Result<ConsensusResult> {
        let start = std::time::Instant::now();

        // Record verification attempt
        self.metrics.read().await.record_verification();

        // Get all agents from pool
        let pool = self.pool.read().await;
        let agents = pool.get_all_agents();

        if agents.is_empty() {
            self.metrics.read().await.record_failure();
            return Err(Error::agent_pool("No agents available for verification"));
        }

        // Verify with consensus
        let result = self
            .consensus_engine
            .verify_with_consensus(agents, signature.clone(), message, public_key)
            .await?;

        // Record results
        if result.is_valid() {
            self.metrics.read().await.record_success();
        } else {
            self.metrics.read().await.record_failure();
        }

        let duration_us = start.elapsed().as_micros() as u64;
        self.metrics
            .read()
            .await
            .record_verification_time(duration_us);

        Ok(result)
    }

    /// Perform system health check
    pub async fn health_check(&self) -> Result<HealthCheck> {
        let pool = self.pool.read().await;
        self.health.write().await.check_agent_pool(&pool).await
    }

    /// Get current health status
    pub async fn health_status(&self) -> HealthStatus {
        self.health.read().await.status()
    }

    /// Get current metrics snapshot
    pub async fn metrics(&self) -> Metrics {
        self.metrics.read().await.snapshot()
    }

    /// Shutdown the system
    pub async fn shutdown(&self) -> Result<()> {
        tracing::info!("Shutting down AgenticVerificationSystem {}", self.id);
        self.pool.write().await.shutdown().await?;
        tracing::info!("AgenticVerificationSystem {} shutdown complete", self.id);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::AgentIdentity;

    #[tokio::test]
    async fn test_system_creation() {
        let system = AgenticVerificationSystem::builder()
            .pool_size(5)
            .build()
            .await
            .unwrap();

        assert_eq!(system.pool_size().await, 5);
    }

    #[tokio::test]
    async fn test_system_verification() {
        let system = AgenticVerificationSystem::builder()
            .pool_size(5)
            .build()
            .await
            .unwrap();

        let identity = AgentIdentity::generate().unwrap();
        let message = b"test message";
        let signature = identity.sign(message).unwrap();

        let result = system
            .verify_with_consensus(signature, message, identity.verifying_key())
            .await
            .unwrap();

        assert!(result.is_valid());
    }

    #[tokio::test]
    async fn test_system_scaling() {
        let system = AgenticVerificationSystem::builder()
            .pool_size(5)
            .build()
            .await
            .unwrap();

        system.scale_pool(10).await.unwrap();
        assert_eq!(system.pool_size().await, 10);

        system.scale_pool(3).await.unwrap();
        assert_eq!(system.pool_size().await, 3);
    }
}

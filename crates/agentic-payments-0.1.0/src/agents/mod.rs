//! Autonomous agent implementations

use crate::error::{Error, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use uuid::Uuid;

// pub mod pool; // Deprecated - use system::AgentPool instead
pub mod recovery;
pub mod verification;

// pub use pool::*; // Deprecated
pub use recovery::*;
pub use verification::*;

/// Agent status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentStatus {
    /// Agent is healthy and ready
    Healthy,
    /// Agent is busy processing
    Busy,
    /// Agent encountered an error
    Error,
    /// Agent is recovering
    Recovering,
    /// Agent is quarantined
    Quarantined,
}

/// Agent health metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentHealth {
    /// Agent ID
    pub agent_id: Uuid,
    /// Current status
    pub status: AgentStatus,
    /// Total verifications performed
    pub total_verifications: usize,
    /// Successful verifications
    pub successful_verifications: usize,
    /// Failed verifications
    pub failed_verifications: usize,
    /// Average response time in milliseconds
    pub avg_response_time_ms: f64,
    /// Last heartbeat timestamp
    pub last_heartbeat: DateTime<Utc>,
    /// Uptime in seconds
    pub uptime_secs: u64,
}

impl AgentHealth {
    /// Create new agent health metrics
    pub fn new(agent_id: Uuid) -> Self {
        Self {
            agent_id,
            status: AgentStatus::Healthy,
            total_verifications: 0,
            successful_verifications: 0,
            failed_verifications: 0,
            avg_response_time_ms: 0.0,
            last_heartbeat: Utc::now(),
            uptime_secs: 0,
        }
    }

    /// Update heartbeat
    pub fn heartbeat(&mut self) {
        self.last_heartbeat = Utc::now();
    }

    /// Record a verification
    pub fn record_verification(&mut self, success: bool, duration: Duration) {
        self.total_verifications += 1;
        if success {
            self.successful_verifications += 1;
        } else {
            self.failed_verifications += 1;
        }

        // Update rolling average
        let new_time = duration.as_millis() as f64;
        if self.total_verifications == 1 {
            self.avg_response_time_ms = new_time;
        } else {
            self.avg_response_time_ms =
                (self.avg_response_time_ms * (self.total_verifications - 1) as f64 + new_time)
                / self.total_verifications as f64;
        }
    }

    /// Get success rate
    pub fn success_rate(&self) -> f64 {
        if self.total_verifications == 0 {
            1.0
        } else {
            self.successful_verifications as f64 / self.total_verifications as f64
        }
    }

    /// Check if agent is healthy
    pub fn is_healthy(&self) -> bool {
        self.status == AgentStatus::Healthy && self.success_rate() >= 0.95
    }
}

/// Trait for verification agents
#[async_trait::async_trait]
pub trait VerificationAgent: Send + Sync {
    /// Get agent ID
    fn id(&self) -> Uuid;

    /// Check if agent is healthy
    fn is_healthy(&self) -> bool;

    /// Perform health check
    async fn health_check(&self) -> Result<()> {
        if self.is_healthy() {
            Ok(())
        } else {
            Err(Error::agent_pool(format!(
                "Agent {} is unhealthy",
                self.id()
            )))
        }
    }

    /// Verify a signature
    async fn verify(
        &self,
        message: &[u8],
        signature: &[u8],
        public_key: &ed25519_dalek::VerifyingKey,
    ) -> Result<bool>;
}

/// Basic verification agent implementation
#[derive(Debug)]
pub struct BasicVerificationAgent {
    /// Agent ID
    pub id: Uuid,
    /// Agent health metrics
    pub health: std::sync::Arc<std::sync::Mutex<AgentHealth>>,
}

impl BasicVerificationAgent {
    /// Create a new verification agent
    pub fn new() -> Result<Self> {
        let id = Uuid::new_v4();
        Ok(Self {
            id,
            health: std::sync::Arc::new(std::sync::Mutex::new(AgentHealth::new(id))),
        })
    }
}

#[async_trait::async_trait]
impl VerificationAgent for BasicVerificationAgent {
    fn id(&self) -> Uuid {
        self.id
    }

    fn is_healthy(&self) -> bool {
        self.health.lock().unwrap().is_healthy()
    }

    async fn verify(
        &self,
        message: &[u8],
        signature: &[u8],
        public_key: &ed25519_dalek::VerifyingKey,
    ) -> Result<bool> {
        use ed25519_dalek::{Signature, Verifier};

        let sig = Signature::from_bytes(signature.try_into().map_err(|_| {
            Error::verification("Invalid signature length")
        })?);

        let start = std::time::Instant::now();
        let result = public_key.verify(message, &sig).is_ok();

        // Update health
        let mut health = self.health.lock().unwrap();
        health.record_verification(result, start.elapsed());
        health.heartbeat();

        Ok(result)
    }
}

impl Default for BasicVerificationAgent {
    fn default() -> Self {
        Self::new().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_creation() {
        let agent = BasicVerificationAgent::new().unwrap();
        assert!(agent.is_healthy());
        // Verify agent has initialized health metrics
        let health = agent.health.lock().unwrap();
        assert_eq!(health.status, AgentStatus::Healthy);
        assert_eq!(health.total_verifications, 0);
    }

    #[test]
    fn test_health_metrics() {
        let mut health = AgentHealth::new(Uuid::new_v4());

        health.record_verification(true, Duration::from_millis(10));
        assert_eq!(health.total_verifications, 1);
        assert_eq!(health.successful_verifications, 1);
        assert_eq!(health.success_rate(), 1.0);

        health.record_verification(false, Duration::from_millis(20));
        assert_eq!(health.total_verifications, 2);
        assert_eq!(health.successful_verifications, 1);
        assert_eq!(health.success_rate(), 0.5);
    }
}
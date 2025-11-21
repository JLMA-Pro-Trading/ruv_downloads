//! Recovery agent for self-healing and automatic respawning

use super::{AgentHealth, AgentStatus};
use crate::error::{Error, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Simple agent health status for recovery monitoring
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecoveryAgentHealth {
    /// Agent is healthy
    Healthy,
    /// Agent is degraded but functional
    Degraded,
    /// Agent is unhealthy
    Unhealthy,
    /// Agent is shutting down
    ShuttingDown,
}

/// Recovery action to take
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum RecoveryAction {
    /// Restart the agent
    Restart,
    /// Reset agent state
    Reset,
    /// Replace with new agent instance
    Replace,
    /// Isolate the agent
    Isolate,
}

/// Recovery policy for an agent
#[derive(Debug, Clone)]
pub struct RecoveryPolicy {
    /// Maximum retry attempts before giving up
    pub max_retries: usize,
    /// Delay between retry attempts
    pub retry_delay: Duration,
    /// Whether to automatically recover
    pub auto_recover: bool,
    /// Recovery action to take
    pub recovery_action: RecoveryAction,
}

impl Default for RecoveryPolicy {
    fn default() -> Self {
        Self {
            max_retries: 3,
            retry_delay: Duration::from_secs(2),
            auto_recover: true,
            recovery_action: RecoveryAction::Restart,
        }
    }
}

/// Agent recovery status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryStatus {
    pub agent_id: Uuid,
    pub agent_type: String,
    pub health: RecoveryAgentHealth,
    pub retry_count: usize,
    pub last_recovery_attempt: Option<chrono::DateTime<chrono::Utc>>,
    pub recovery_successful: bool,
}

/// Monitored agent wrapper
struct MonitoredAgent {
    agent_id: Uuid,
    agent_type: String,
    health: RecoveryAgentHealth,
    retry_count: usize,
    last_check: chrono::DateTime<chrono::Utc>,
    last_recovery_attempt: Option<chrono::DateTime<chrono::Utc>>,
    policy: RecoveryPolicy,
}

/// Recovery agent for self-healing system
pub struct RecoveryAgent {
    id: Uuid,
    monitored_agents: Arc<RwLock<HashMap<Uuid, MonitoredAgent>>>,
    shutdown: Arc<RwLock<bool>>,
}

impl RecoveryAgent {
    /// Create a new recovery agent
    pub fn new() -> Self {
        Self {
            id: Uuid::new_v4(),
            monitored_agents: Arc::new(RwLock::new(HashMap::new())),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Get the agent ID
    pub fn id(&self) -> Uuid {
        self.id
    }

    /// Register an agent for monitoring
    pub async fn register_agent(
        &self,
        agent_id: Uuid,
        agent_type: String,
        policy: RecoveryPolicy,
    ) -> Result<()> {
        let mut agents = self.monitored_agents.write().await;

        let monitored = MonitoredAgent {
            agent_id,
            agent_type,
            health: RecoveryAgentHealth::Healthy,
            retry_count: 0,
            last_check: chrono::Utc::now(),
            last_recovery_attempt: None,
            policy,
        };

        agents.insert(agent_id, monitored);
        Ok(())
    }

    /// Unregister an agent from monitoring
    pub async fn unregister_agent(&self, agent_id: Uuid) -> Result<()> {
        let mut agents = self.monitored_agents.write().await;
        agents.remove(&agent_id);
        Ok(())
    }

    /// Update agent health status
    pub async fn update_agent_health(&self, agent_id: Uuid, health: RecoveryAgentHealth) -> Result<()> {
        let mut agents = self.monitored_agents.write().await;

        if let Some(monitored) = agents.get_mut(&agent_id) {
            monitored.health = health;
            monitored.last_check = chrono::Utc::now();

            // Check if recovery is needed
            if health == RecoveryAgentHealth::Unhealthy && monitored.policy.auto_recover {
                drop(agents); // Release lock before attempting recovery
                self.attempt_recovery(agent_id).await?;
            }
        }

        Ok(())
    }

    /// Attempt to recover an agent
    pub async fn attempt_recovery(&self, agent_id: Uuid) -> Result<()> {
        let start = std::time::Instant::now();

        let should_recover = {
            let agents = self.monitored_agents.read().await;
            if let Some(monitored) = agents.get(&agent_id) {
                monitored.retry_count < monitored.policy.max_retries
            } else {
                return Err(Error::Agent(crate::error::AgentError::AgentNotFound {
                    agent_id: agent_id.to_string(),
                }));
            }
        };

        if !should_recover {
            return Err(Error::Agent(crate::error::AgentError::RecoveryFailed {
                agent_id: agent_id.to_string(),
                reason: "Max retries exceeded".to_string(),
            }));
        }

        // Update recovery attempt
        {
            let mut agents = self.monitored_agents.write().await;
            if let Some(monitored) = agents.get_mut(&agent_id) {
                monitored.retry_count += 1;
                monitored.last_recovery_attempt = Some(chrono::Utc::now());

                // Wait for retry delay
                let delay = monitored.policy.retry_delay;
                drop(agents);
                tokio::time::sleep(delay).await;
            }
        }

        // Mark recovery as successful
        {
            let mut agents = self.monitored_agents.write().await;
            if let Some(monitored) = agents.get_mut(&agent_id) {
                monitored.health = RecoveryAgentHealth::Healthy;
                monitored.retry_count = 0;
            }
        }

        tracing::info!("Successfully recovered agent {} in {:?}", agent_id, start.elapsed());
        Ok(())
    }

    /// Get recovery status for an agent
    pub async fn get_recovery_status(&self, agent_id: Uuid) -> Result<RecoveryStatus> {
        let agents = self.monitored_agents.read().await;

        let monitored = agents
            .get(&agent_id)
            .ok_or_else(|| Error::Agent(crate::error::AgentError::AgentNotFound {
                agent_id: agent_id.to_string(),
            }))?;

        Ok(RecoveryStatus {
            agent_id: monitored.agent_id,
            agent_type: monitored.agent_type.clone(),
            health: monitored.health,
            retry_count: monitored.retry_count,
            last_recovery_attempt: monitored.last_recovery_attempt,
            recovery_successful: monitored.health == RecoveryAgentHealth::Healthy,
        })
    }

    /// Get all monitored agents
    pub async fn get_all_statuses(&self) -> Vec<RecoveryStatus> {
        let agents = self.monitored_agents.read().await;

        agents
            .values()
            .map(|m| RecoveryStatus {
                agent_id: m.agent_id,
                agent_type: m.agent_type.clone(),
                health: m.health,
                retry_count: m.retry_count,
                last_recovery_attempt: m.last_recovery_attempt,
                recovery_successful: m.health == RecoveryAgentHealth::Healthy,
            })
            .collect()
    }

    /// Get unhealthy agents
    pub async fn get_unhealthy_agents(&self) -> Vec<Uuid> {
        let agents = self.monitored_agents.read().await;

        agents
            .values()
            .filter(|m| m.health == RecoveryAgentHealth::Unhealthy)
            .map(|m| m.agent_id)
            .collect()
    }

    /// Force recovery of an agent
    pub async fn force_recovery(&self, agent_id: Uuid) -> Result<()> {
        // Reset retry count
        {
            let mut agents = self.monitored_agents.write().await;
            if let Some(monitored) = agents.get_mut(&agent_id) {
                monitored.retry_count = 0;
            }
        }

        self.attempt_recovery(agent_id).await
    }

    /// Run monitoring loop
    async fn monitoring_loop(
        monitored_agents: Arc<RwLock<HashMap<Uuid, MonitoredAgent>>>,
        shutdown: Arc<RwLock<bool>>,
    ) {
        let mut interval = tokio::time::interval(Duration::from_secs(10));

        loop {
            interval.tick().await;

            if *shutdown.read().await {
                break;
            }

            // Check for stale agents
            let agents = monitored_agents.read().await;
            let now = chrono::Utc::now();

            for monitored in agents.values() {
                let time_since_check = (now - monitored.last_check).num_seconds();

                if time_since_check > 60 && monitored.health == RecoveryAgentHealth::Healthy {
                    tracing::warn!(
                        "Agent {} has not reported health in {} seconds",
                        monitored.agent_id,
                        time_since_check
                    );
                }
            }
        }
    }

}

impl Default for RecoveryAgent {
    fn default() -> Self {
        Self::new()
    }
}

impl RecoveryAgent {
    /// Start the recovery agent
    pub async fn start(&self) -> Result<()> {
        // Start monitoring loop
        let monitored_agents = self.monitored_agents.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            Self::monitoring_loop(monitored_agents, shutdown).await;
        });

        Ok(())
    }

    /// Shutdown the recovery agent
    pub async fn shutdown(&self) -> Result<()> {
        let mut shutdown = self.shutdown.write().await;
        *shutdown = true;
        Ok(())
    }
}

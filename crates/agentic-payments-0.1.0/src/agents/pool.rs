//! Agent pool management

use super::{AgentHealth, AgentStatus, VerificationAgent};
use crate::error::{AgentError, Error, Result};
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Agent pool for managing verification agents
#[derive(Clone)]
pub struct AgentPool {
    agents: Arc<DashMap<Uuid, VerificationAgent>>,
    max_size: usize,
}

impl AgentPool {
    /// Create a new agent pool
    pub fn new(size: usize) -> Self {
        let agents = Arc::new(DashMap::new());

        // Initialize agents
        for _ in 0..size {
            let agent = VerificationAgent::new();
            agents.insert(agent.id(), agent);
        }

        Self {
            agents,
            max_size: size,
        }
    }

    /// Get pool size
    pub fn size(&self) -> usize {
        self.agents.len()
    }

    /// Get max pool size
    pub fn max_size(&self) -> usize {
        self.max_size
    }

    /// Get an agent by ID
    pub fn get_agent(&self, id: &Uuid) -> Option<dashmap::mapref::one::Ref<'_, Uuid, VerificationAgent>> {
        self.agents.get(id)
    }

    /// Get a healthy agent
    pub fn get_healthy_agent(&self) -> Result<Uuid> {
        for entry in self.agents.iter() {
            if entry.value().health().is_healthy() {
                return Ok(*entry.key());
            }
        }
        Err(Error::PoolExhausted)
    }

    /// Get all healthy agents
    pub fn get_healthy_agents(&self) -> Vec<Uuid> {
        self.agents
            .iter()
            .filter(|entry| entry.value().health().is_healthy())
            .map(|entry| *entry.key())
            .collect()
    }

    /// Update agent status
    pub fn update_status(&self, agent_id: &Uuid, status: AgentStatus) -> Result<()> {
        self.agents
            .get_mut(agent_id)
            .ok_or_else(|| Error::Agent(AgentError::AgentNotFound {
                agent_id: agent_id.to_string(),
            }))?
            .set_status(status);
        Ok(())
    }

    /// Get agent health
    pub fn get_health(&self, agent_id: &Uuid) -> Result<AgentHealth> {
        Ok(self
            .agents
            .get(agent_id)
            .ok_or_else(|| Error::Agent(AgentError::AgentNotFound {
                agent_id: agent_id.to_string(),
            }))?
            .health()
            .clone())
    }

    /// Add a new agent to the pool
    pub fn add_agent(&self, agent: VerificationAgent) -> Result<()> {
        if self.agents.len() >= self.max_size {
            return Err(Error::Config("Agent pool is at maximum capacity".to_string()));
        }
        self.agents.insert(agent.id(), agent);
        Ok(())
    }

    /// Remove an agent from the pool
    pub fn remove_agent(&self, agent_id: &Uuid) -> Result<VerificationAgent> {
        self.agents
            .remove(agent_id)
            .map(|(_, agent)| agent)
            .ok_or_else(|| Error::Agent(AgentError::AgentNotFound {
                agent_id: agent_id.to_string(),
            }))
    }

    /// Get pool health summary
    pub fn health_summary(&self) -> PoolHealthSummary {
        let total = self.agents.len();
        let mut healthy = 0;
        let mut busy = 0;
        let mut error = 0;
        let mut recovering = 0;
        let mut quarantined = 0;

        for entry in self.agents.iter() {
            match entry.value().health().status {
                AgentStatus::Healthy => healthy += 1,
                AgentStatus::Busy => busy += 1,
                AgentStatus::Error => error += 1,
                AgentStatus::Recovering => recovering += 1,
                AgentStatus::Quarantined => quarantined += 1,
            }
        }

        PoolHealthSummary {
            total,
            healthy,
            busy,
            error,
            recovering,
            quarantined,
        }
    }
}

/// Pool health summary
#[derive(Debug, Clone)]
pub struct PoolHealthSummary {
    /// Total agents
    pub total: usize,
    /// Healthy agents
    pub healthy: usize,
    /// Busy agents
    pub busy: usize,
    /// Agents in error state
    pub error: usize,
    /// Recovering agents
    pub recovering: usize,
    /// Quarantined agents
    pub quarantined: usize,
}

impl PoolHealthSummary {
    /// Get the percentage of healthy agents
    pub fn health_percentage(&self) -> f64 {
        if self.total == 0 {
            0.0
        } else {
            self.healthy as f64 / self.total as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pool_creation() {
        let pool = AgentPool::new(5);
        assert_eq!(pool.size(), 5);
        assert_eq!(pool.max_size(), 5);
    }

    #[test]
    fn test_get_healthy_agent() {
        let pool = AgentPool::new(5);
        let agent_id = pool.get_healthy_agent().unwrap();
        assert!(pool.get_agent(&agent_id).is_some());
    }

    #[test]
    fn test_pool_health_summary() {
        let pool = AgentPool::new(5);
        let summary = pool.health_summary();
        assert_eq!(summary.total, 5);
        assert_eq!(summary.healthy, 5);
        assert_eq!(summary.health_percentage(), 1.0);
    }
}
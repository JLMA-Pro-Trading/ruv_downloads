//! Agent pool management

use crate::agents::{BasicVerificationAgent, VerificationAgent};
use crate::error::{Error, Result};
use dashmap::DashMap;
use std::sync::Arc;
use uuid::Uuid;

/// Agent pool for managing verification agents
pub struct AgentPool {
    agents: DashMap<Uuid, Arc<dyn VerificationAgent>>,
    max_size: usize,
}

impl AgentPool {
    /// Create a new agent pool
    pub fn new(max_size: usize) -> Self {
        Self {
            agents: DashMap::new(),
            max_size,
        }
    }

    /// Add an agent to the pool
    pub async fn add_agent(&mut self, agent: Arc<dyn VerificationAgent>) -> Result<()> {
        if self.agents.len() >= self.max_size {
            return Err(Error::agent_pool(format!(
                "Pool is full (max: {})",
                self.max_size
            )));
        }

        let agent_id = agent.id();

        // Perform health check before adding
        agent.health_check().await?;

        self.agents.insert(agent_id, agent);
        tracing::info!("Added agent {} to pool", agent_id);

        Ok(())
    }

    /// Remove an agent from the pool
    pub async fn remove_agent(&mut self, agent_id: Uuid) -> Result<()> {
        self.agents
            .remove(&agent_id)
            .ok_or_else(|| Error::agent_pool(format!("Agent {} not found in pool", agent_id)))?;

        tracing::info!("Removed agent {} from pool", agent_id);
        Ok(())
    }

    /// Get an agent by ID
    pub fn get_agent(&self, agent_id: Uuid) -> Option<Arc<dyn VerificationAgent>> {
        self.agents.get(&agent_id).map(|r| Arc::clone(&r))
    }

    /// Get all agents
    pub fn get_all_agents(&self) -> Vec<Arc<dyn VerificationAgent>> {
        self.agents.iter().map(|r| Arc::clone(&r)).collect()
    }

    /// Get pool size
    pub fn size(&self) -> usize {
        self.agents.len()
    }

    /// Check if pool is empty
    pub fn is_empty(&self) -> bool {
        self.agents.is_empty()
    }

    /// Scale the pool to target size
    pub async fn scale(&mut self, target_size: usize) -> Result<()> {
        if target_size > self.max_size {
            return Err(Error::agent_pool(format!(
                "Target size {} exceeds maximum {}",
                target_size, self.max_size
            )));
        }

        let current_size = self.size();

        if target_size > current_size {
            // Scale up - add agents
            let agents_to_add = target_size - current_size;
            for _ in 0..agents_to_add {
                let agent = BasicVerificationAgent::new()?;
                self.add_agent(Arc::new(agent) as Arc<dyn VerificationAgent>)
                    .await?;
            }
            tracing::info!("Scaled pool up from {} to {} agents", current_size, target_size);
        } else if target_size < current_size {
            // Scale down - remove agents
            let agents_to_remove = current_size - target_size;
            let agent_ids: Vec<Uuid> = self.agents.iter().take(agents_to_remove).map(|r| *r.key()).collect();

            for agent_id in agent_ids {
                self.remove_agent(agent_id).await?;
            }
            tracing::info!("Scaled pool down from {} to {} agents", current_size, target_size);
        }

        Ok(())
    }

    /// Perform health check on all agents
    pub async fn health_check_all(&self) -> Result<()> {
        let mut unhealthy_agents = Vec::new();

        for entry in self.agents.iter() {
            let agent_id = *entry.key();
            let agent = entry.value();

            if let Err(e) = agent.health_check().await {
                tracing::warn!("Agent {} failed health check: {}", agent_id, e);
                unhealthy_agents.push(agent_id);
            }
        }

        if !unhealthy_agents.is_empty() {
            return Err(Error::health_check(format!(
                "{} agents failed health check: {:?}",
                unhealthy_agents.len(),
                unhealthy_agents
            )));
        }

        Ok(())
    }

    /// Shutdown all agents and clear the pool
    pub async fn shutdown(&mut self) -> Result<()> {
        tracing::info!("Shutting down agent pool with {} agents", self.size());
        self.agents.clear();
        tracing::info!("Agent pool shutdown complete");
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pool_creation() {
        let pool = AgentPool::new(10);
        assert_eq!(pool.size(), 0);
        assert!(pool.is_empty());
    }

    #[tokio::test]
    async fn test_add_agent() {
        let mut pool = AgentPool::new(10);
        let agent = BasicVerificationAgent::new().unwrap();
        let agent_id = agent.id();

        pool.add_agent(Arc::new(agent) as Arc<dyn VerificationAgent>)
            .await
            .unwrap();

        assert_eq!(pool.size(), 1);
        assert!(pool.get_agent(agent_id).is_some());
    }

    #[tokio::test]
    async fn test_remove_agent() {
        let mut pool = AgentPool::new(10);
        let agent = BasicVerificationAgent::new().unwrap();
        let agent_id = agent.id();

        pool.add_agent(Arc::new(agent) as Arc<dyn VerificationAgent>)
            .await
            .unwrap();
        pool.remove_agent(agent_id).await.unwrap();

        assert_eq!(pool.size(), 0);
    }

    #[tokio::test]
    async fn test_scale_up() {
        let mut pool = AgentPool::new(10);
        pool.scale(5).await.unwrap();
        assert_eq!(pool.size(), 5);
    }

    #[tokio::test]
    async fn test_scale_down() {
        let mut pool = AgentPool::new(10);
        pool.scale(5).await.unwrap();
        pool.scale(3).await.unwrap();
        assert_eq!(pool.size(), 3);
    }

    #[tokio::test]
    async fn test_pool_max_size() {
        let mut pool = AgentPool::new(3);
        pool.scale(3).await.unwrap();

        let agent = BasicVerificationAgent::new().unwrap();
        let result = pool.add_agent(Arc::new(agent) as Arc<dyn VerificationAgent>).await;
        assert!(result.is_err());
    }
}
//! Authority coordinator for multi-issuer quorum management

use super::{Agent, AgentHealth, AgentMetrics, AgentState};
use crate::error::{Error, Result};
use async_trait::async_trait;
use ed25519_dalek::VerifyingKey;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Authority (certificate issuer) information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Authority {
    pub id: Uuid,
    pub name: String,
    pub public_key: Vec<u8>,
    pub trust_level: TrustLevel,
    pub active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

/// Trust level of an authority
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum TrustLevel {
    /// Untrusted authority
    Untrusted = 0,
    /// Low trust
    Low = 1,
    /// Medium trust
    Medium = 2,
    /// High trust
    High = 3,
    /// Maximum trust (root CA)
    Root = 4,
}

impl TrustLevel {
    /// Get numeric value
    pub fn value(&self) -> u8 {
        *self as u8
    }

    /// Check if trust level meets minimum requirement
    pub fn meets_requirement(&self, required: TrustLevel) -> bool {
        self.value() >= required.value()
    }
}

/// Quorum policy for multi-issuer decisions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuorumPolicy {
    /// Minimum number of authorities required
    pub min_authorities: usize,
    /// Minimum trust level required
    pub min_trust_level: TrustLevel,
    /// Minimum percentage of authorities that must agree (0.0 to 1.0)
    pub agreement_threshold: f64,
}

impl Default for QuorumPolicy {
    fn default() -> Self {
        Self {
            min_authorities: 3,
            min_trust_level: TrustLevel::Medium,
            agreement_threshold: 0.67,
        }
    }
}

/// Quorum decision result
#[derive(Debug, Clone)]
pub struct QuorumResult {
    pub approved: bool,
    pub approving_authorities: Vec<Uuid>,
    pub rejecting_authorities: Vec<Uuid>,
    pub total_authorities: usize,
    pub agreement_percentage: f64,
}

/// Authority coordinator agent
pub struct AuthorityCoordinator {
    state: AgentState,
    authorities: Arc<RwLock<HashMap<Uuid, Authority>>>,
    policies: Arc<RwLock<HashMap<String, QuorumPolicy>>>,
    shutdown: Arc<RwLock<bool>>,
}

impl AuthorityCoordinator {
    /// Create a new authority coordinator
    pub fn new() -> Self {
        let mut policies = HashMap::new();
        policies.insert("default".to_string(), QuorumPolicy::default());

        Self {
            state: AgentState::new(),
            authorities: Arc::new(RwLock::new(HashMap::new())),
            policies: Arc::new(RwLock::new(policies)),
            shutdown: Arc::new(RwLock::new(false)),
        }
    }

    /// Register a new authority
    pub async fn register_authority(&self, authority: Authority) -> Result<()> {
        let mut authorities = self.authorities.write().await;
        authorities.insert(authority.id, authority);
        Ok(())
    }

    /// Unregister an authority
    pub async fn unregister_authority(&self, authority_id: Uuid) -> Result<()> {
        let mut authorities = self.authorities.write().await;
        authorities.remove(&authority_id);
        Ok(())
    }

    /// Update authority trust level
    pub async fn update_trust_level(&self, authority_id: Uuid, trust_level: TrustLevel) -> Result<()> {
        let mut authorities = self.authorities.write().await;
        if let Some(authority) = authorities.get_mut(&authority_id) {
            authority.trust_level = trust_level;
            Ok(())
        } else {
            Err(Error::Authority(format!("Authority not found: {}", authority_id)))
        }
    }

    /// Deactivate an authority
    pub async fn deactivate_authority(&self, authority_id: Uuid) -> Result<()> {
        let mut authorities = self.authorities.write().await;
        if let Some(authority) = authorities.get_mut(&authority_id) {
            authority.active = false;
            Ok(())
        } else {
            Err(Error::Authority(format!("Authority not found: {}", authority_id)))
        }
    }

    /// Set quorum policy for a category
    pub async fn set_policy(&self, category: String, policy: QuorumPolicy) -> Result<()> {
        let mut policies = self.policies.write().await;
        policies.insert(category, policy);
        Ok(())
    }

    /// Evaluate quorum decision
    pub async fn evaluate_quorum(
        &self,
        category: &str,
        approving_authority_ids: &[Uuid],
    ) -> Result<QuorumResult> {
        let start = std::time::Instant::now();

        let authorities = self.authorities.read().await;
        let policies = self.policies.read().await;

        // Get policy (use default if category not found)
        let policy = policies.get(category)
            .or_else(|| policies.get("default"))
            .ok_or_else(|| Error::Authority("No policy found".to_string()))?;

        // Filter active authorities with sufficient trust level
        let eligible_authorities: Vec<&Authority> = authorities
            .values()
            .filter(|a| a.active && a.trust_level.meets_requirement(policy.min_trust_level))
            .collect();

        if eligible_authorities.len() < policy.min_authorities {
            return Err(Error::Authority(format!(
                "Not enough eligible authorities: {} < {}",
                eligible_authorities.len(),
                policy.min_authorities
            )));
        }

        // Count approvals
        let mut approving = Vec::new();
        let mut rejecting = Vec::new();

        for authority in &eligible_authorities {
            if approving_authority_ids.contains(&authority.id) {
                approving.push(authority.id);
            } else {
                rejecting.push(authority.id);
            }
        }

        let agreement_percentage = approving.len() as f64 / eligible_authorities.len() as f64;
        let approved = agreement_percentage >= policy.agreement_threshold;

        let processing_time = start.elapsed().as_secs_f64() * 1000.0;
        self.state.record_task(approved, processing_time).await;

        Ok(QuorumResult {
            approved,
            approving_authorities: approving,
            rejecting_authorities: rejecting,
            total_authorities: eligible_authorities.len(),
            agreement_percentage,
        })
    }

    /// Get all active authorities
    pub async fn get_active_authorities(&self) -> Vec<Authority> {
        let authorities = self.authorities.read().await;
        authorities
            .values()
            .filter(|a| a.active)
            .cloned()
            .collect()
    }

    /// Get authorities by trust level
    pub async fn get_authorities_by_trust_level(&self, min_level: TrustLevel) -> Vec<Authority> {
        let authorities = self.authorities.read().await;
        authorities
            .values()
            .filter(|a| a.active && a.trust_level.meets_requirement(min_level))
            .cloned()
            .collect()
    }

    /// Run heartbeat loop
    async fn heartbeat_loop(state: AgentState, shutdown: Arc<RwLock<bool>>) {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));

        loop {
            interval.tick().await;

            if *shutdown.read().await {
                break;
            }

            state.update_heartbeat().await;
            state.update_health(AgentHealth::Healthy).await;
        }
    }
}

impl Default for AuthorityCoordinator {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Agent for AuthorityCoordinator {
    fn agent_id(&self) -> Uuid {
        self.state.agent_id
    }

    fn agent_type(&self) -> &'static str {
        "AuthorityCoordinator"
    }

    async fn health_check(&self) -> Result<AgentHealth> {
        let health = self.state.health.read().await;
        Ok(*health)
    }

    async fn get_metrics(&self) -> Result<AgentMetrics> {
        let metrics = self.state.metrics.read().await;
        Ok(metrics.clone())
    }

    async fn start(&self) -> Result<()> {
        let state = self.state.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            Self::heartbeat_loop(state, shutdown).await;
        });

        Ok(())
    }

    async fn shutdown(&self) -> Result<()> {
        self.state.update_health(AgentHealth::ShuttingDown).await;
        let mut shutdown = self.shutdown.write().await;
        *shutdown = true;
        Ok(())
    }

    async fn heartbeat(&self) -> Result<()> {
        self.state.update_heartbeat().await;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_authority(name: &str, trust_level: TrustLevel) -> Authority {
        Authority {
            id: Uuid::new_v4(),
            name: name.to_string(),
            public_key: vec![0u8; 32],
            trust_level,
            active: true,
            created_at: chrono::Utc::now(),
        }
    }

    #[tokio::test]
    async fn test_authority_coordinator_creation() {
        let coordinator = AuthorityCoordinator::new();
        assert_eq!(coordinator.agent_type(), "AuthorityCoordinator");
    }

    #[tokio::test]
    async fn test_register_authority() {
        let coordinator = AuthorityCoordinator::new();
        let authority = create_test_authority("TestCA", TrustLevel::High);
        let id = authority.id;

        coordinator.register_authority(authority).await.unwrap();

        let authorities = coordinator.get_active_authorities().await;
        assert_eq!(authorities.len(), 1);
        assert_eq!(authorities[0].id, id);
    }

    #[tokio::test]
    async fn test_trust_level_comparison() {
        assert!(TrustLevel::High.meets_requirement(TrustLevel::Medium));
        assert!(!TrustLevel::Medium.meets_requirement(TrustLevel::High));
        assert!(TrustLevel::Root.meets_requirement(TrustLevel::Root));
    }

    #[tokio::test]
    async fn test_quorum_evaluation() {
        let coordinator = AuthorityCoordinator::new();
        coordinator.start().await.unwrap();

        // Register 5 authorities
        let mut authority_ids = Vec::new();
        for i in 0..5 {
            let authority = create_test_authority(
                &format!("CA{}", i),
                if i < 3 { TrustLevel::High } else { TrustLevel::Medium }
            );
            authority_ids.push(authority.id);
            coordinator.register_authority(authority).await.unwrap();
        }

        // 4 out of 5 approve
        let approving = &authority_ids[0..4];

        let result = coordinator.evaluate_quorum("default", approving).await.unwrap();
        assert!(result.approved);
        assert_eq!(result.approving_authorities.len(), 4);
        assert_eq!(result.total_authorities, 5);

        coordinator.shutdown().await.unwrap();
    }

    #[tokio::test]
    async fn test_quorum_not_met() {
        let coordinator = AuthorityCoordinator::new();

        // Register 5 authorities
        let mut authority_ids = Vec::new();
        for i in 0..5 {
            let authority = create_test_authority(&format!("CA{}", i), TrustLevel::High);
            authority_ids.push(authority.id);
            coordinator.register_authority(authority).await.unwrap();
        }

        // Only 2 out of 5 approve (below 67% threshold)
        let approving = &authority_ids[0..2];

        let result = coordinator.evaluate_quorum("default", approving).await.unwrap();
        assert!(!result.approved);
        assert_eq!(result.approving_authorities.len(), 2);
    }

    #[tokio::test]
    async fn test_deactivate_authority() {
        let coordinator = AuthorityCoordinator::new();
        let authority = create_test_authority("TestCA", TrustLevel::High);
        let id = authority.id;

        coordinator.register_authority(authority).await.unwrap();
        coordinator.deactivate_authority(id).await.unwrap();

        let active_authorities = coordinator.get_active_authorities().await;
        assert_eq!(active_authorities.len(), 0);
    }
}
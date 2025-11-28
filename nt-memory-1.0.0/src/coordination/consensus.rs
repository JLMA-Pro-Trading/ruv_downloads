//! Simple consensus engine (Raft-inspired)

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Proposal for consensus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proposal {
    /// Proposal ID
    pub id: String,

    /// Proposer agent ID
    pub proposer: String,

    /// Proposal data
    pub data: serde_json::Value,

    /// Required quorum (0.0 - 1.0)
    pub quorum: f64,
}

/// Vote on proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    /// Proposal ID
    pub proposal_id: String,

    /// Voter agent ID
    pub voter: String,

    /// Approve or reject
    pub approve: bool,

    /// Vote weight (default 1.0)
    pub weight: f64,
}

/// Consensus result
#[derive(Debug, Clone)]
pub enum ConsensusResult {
    /// Consensus reached
    Approved,

    /// Consensus failed
    Rejected,

    /// Still pending
    Pending {
        approval_rate: f64,
        votes_needed: usize,
    },
}

/// Proposal state
#[derive(Debug, Clone)]
struct ProposalState {
    proposal: Proposal,
    votes: Vec<Vote>,
    created_at: std::time::Instant,
}

impl ProposalState {
    fn calculate_result(&self, total_agents: usize) -> ConsensusResult {
        let total_weight: f64 = self.votes.iter().map(|v| v.weight).sum();
        let approval_weight: f64 = self
            .votes
            .iter()
            .filter(|v| v.approve)
            .map(|v| v.weight)
            .sum();

        let approval_rate = if total_weight > 0.0 {
            approval_weight / total_weight
        } else {
            0.0
        };

        let votes_received = self.votes.len();
        let quorum_votes = (total_agents as f64 * self.proposal.quorum).ceil() as usize;

        if votes_received >= quorum_votes {
            if approval_rate >= 0.5 {
                ConsensusResult::Approved
            } else {
                ConsensusResult::Rejected
            }
        } else {
            ConsensusResult::Pending {
                approval_rate,
                votes_needed: quorum_votes - votes_received,
            }
        }
    }
}

/// Consensus engine
pub struct ConsensusEngine {
    /// Active proposals
    proposals: Arc<RwLock<HashMap<String, ProposalState>>>,

    /// Registered agents
    agents: Arc<RwLock<HashMap<String, AgentInfo>>>,
}

#[derive(Debug, Clone)]
struct AgentInfo {
    id: String,
    weight: f64,
}

impl ConsensusEngine {
    /// Create new consensus engine
    pub fn new() -> Self {
        Self {
            proposals: Arc::new(RwLock::new(HashMap::new())),
            agents: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register agent
    pub async fn register_agent(&self, agent_id: String, weight: f64) {
        let mut agents = self.agents.write().await;
        agents.insert(
            agent_id.clone(),
            AgentInfo {
                id: agent_id,
                weight,
            },
        );
    }

    /// Submit proposal
    pub async fn submit_proposal(&self, proposal: Proposal) -> String {
        let id = Uuid::new_v4().to_string();

        let state = ProposalState {
            proposal: Proposal {
                id: id.clone(),
                ..proposal
            },
            votes: Vec::new(),
            created_at: std::time::Instant::now(),
        };

        let mut proposals = self.proposals.write().await;
        proposals.insert(id.clone(), state);

        tracing::debug!("Proposal submitted: {}", id);

        id
    }

    /// Vote on proposal
    pub async fn vote(&self, vote: Vote) -> anyhow::Result<ConsensusResult> {
        let mut proposals = self.proposals.write().await;

        let state = proposals
            .get_mut(&vote.proposal_id)
            .ok_or_else(|| anyhow::anyhow!("Proposal not found"))?;

        // Check if agent already voted
        if state.votes.iter().any(|v| v.voter == vote.voter) {
            return Err(anyhow::anyhow!("Agent already voted"));
        }

        state.votes.push(vote);

        // Calculate result
        let agents = self.agents.read().await;
        let result = state.calculate_result(agents.len());

        Ok(result)
    }

    /// Get proposal result
    pub async fn get_result(&self, proposal_id: &str) -> Option<ConsensusResult> {
        let proposals = self.proposals.read().await;
        let agents = self.agents.read().await;

        proposals
            .get(proposal_id)
            .map(|state| state.calculate_result(agents.len()))
    }

    /// Get proposal details
    pub async fn get_proposal(&self, proposal_id: &str) -> Option<Proposal> {
        let proposals = self.proposals.read().await;
        proposals.get(proposal_id).map(|s| s.proposal.clone())
    }

    /// List all proposals
    pub async fn list_proposals(&self) -> Vec<Proposal> {
        let proposals = self.proposals.read().await;
        proposals.values().map(|s| s.proposal.clone()).collect()
    }

    /// Cleanup old proposals
    pub async fn cleanup_old(&self, max_age: std::time::Duration) {
        let mut proposals = self.proposals.write().await;
        proposals.retain(|_, state| state.created_at.elapsed() < max_age);
    }

    /// Get agent count
    pub async fn agent_count(&self) -> usize {
        self.agents.read().await.len()
    }
}

impl Default for ConsensusEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_consensus_approval() {
        let engine = ConsensusEngine::new();

        // Register agents
        engine.register_agent("agent1".to_string(), 1.0).await;
        engine.register_agent("agent2".to_string(), 1.0).await;
        engine.register_agent("agent3".to_string(), 1.0).await;

        // Submit proposal
        let proposal = Proposal {
            id: String::new(),
            proposer: "agent1".to_string(),
            data: serde_json::json!({"action": "test"}),
            quorum: 0.67, // Need 2/3 agents
        };

        let proposal_id = engine.submit_proposal(proposal).await;

        // Vote (2 approve, quorum reached)
        let result1 = engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent1".to_string(),
                approve: true,
                weight: 1.0,
            })
            .await
            .unwrap();

        assert!(matches!(result1, ConsensusResult::Pending { .. }));

        let result2 = engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent2".to_string(),
                approve: true,
                weight: 1.0,
            })
            .await
            .unwrap();

        assert!(matches!(result2, ConsensusResult::Approved));
    }

    #[tokio::test]
    async fn test_consensus_rejection() {
        let engine = ConsensusEngine::new();

        // Register 3 agents
        for i in 1..=3 {
            engine
                .register_agent(format!("agent{}", i), 1.0)
                .await;
        }

        // Submit proposal
        let proposal = Proposal {
            id: String::new(),
            proposer: "agent1".to_string(),
            data: serde_json::json!({"action": "test"}),
            quorum: 0.67,
        };

        let proposal_id = engine.submit_proposal(proposal).await;

        // Vote (1 approve, 2 reject)
        engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent1".to_string(),
                approve: true,
                weight: 1.0,
            })
            .await
            .unwrap();

        engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent2".to_string(),
                approve: false,
                weight: 1.0,
            })
            .await
            .unwrap();

        let result = engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent3".to_string(),
                approve: false,
                weight: 1.0,
            })
            .await
            .unwrap();

        assert!(matches!(result, ConsensusResult::Rejected));
    }

    #[tokio::test]
    async fn test_duplicate_vote() {
        let engine = ConsensusEngine::new();

        engine.register_agent("agent1".to_string(), 1.0).await;

        let proposal = Proposal {
            id: String::new(),
            proposer: "agent1".to_string(),
            data: serde_json::json!({}),
            quorum: 0.5,
        };

        let proposal_id = engine.submit_proposal(proposal).await;

        // First vote
        engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent1".to_string(),
                approve: true,
                weight: 1.0,
            })
            .await
            .unwrap();

        // Duplicate vote should fail
        let result = engine
            .vote(Vote {
                proposal_id: proposal_id.clone(),
                voter: "agent1".to_string(),
                approve: false,
                weight: 1.0,
            })
            .await;

        assert!(result.is_err());
    }
}

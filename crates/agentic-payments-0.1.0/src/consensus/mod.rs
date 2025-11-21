//! Byzantine Fault Tolerant consensus mechanisms
//!
//! Implements Practical Byzantine Fault Tolerance (PBFT) consensus protocol
//! with reputation-based weighted voting and CRDT state synchronization.

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fmt;
use uuid::Uuid;

pub mod bft;
pub mod quorum;
pub mod reputation;
pub mod voting;

pub use bft::{BftConfig, BftConsensus};
pub use quorum::{Quorum, QuorumConfig};
pub use reputation::{ReputationConfig, ReputationEntry, ReputationSystem};
pub use voting::{VoteCollector, VotingConfig};

use crate::agents::VerificationAgent;
use crate::crypto::Signature;
use ed25519_dalek::VerifyingKey;
use std::sync::Arc;

/// Unique identifier for consensus rounds
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RoundId(pub u64);

impl fmt::Display for RoundId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Round({})", self.0)
    }
}

impl RoundId {
    pub fn next(self) -> Self {
        RoundId(self.0 + 1)
    }
}

/// Consensus authority identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AuthorityId(pub String);

impl fmt::Display for AuthorityId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl From<String> for AuthorityId {
    fn from(s: String) -> Self {
        AuthorityId(s)
    }
}

impl From<&str> for AuthorityId {
    fn from(s: &str) -> Self {
        AuthorityId(s.to_string())
    }
}

impl From<Uuid> for AuthorityId {
    fn from(uuid: Uuid) -> Self {
        AuthorityId(uuid.to_string())
    }
}

/// Vote value for consensus
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct VoteValue(pub Vec<u8>);

impl VoteValue {
    pub fn new(data: Vec<u8>) -> Self {
        VoteValue(data)
    }

    pub fn from_string(s: &str) -> Self {
        VoteValue(s.as_bytes().to_vec())
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

/// Individual vote in consensus
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Vote {
    pub round_id: RoundId,
    pub authority: AuthorityId,
    pub value: VoteValue,
    pub weight: u64,
    pub timestamp: u64,
    pub signature: Vec<u8>,
}

impl Vote {
    pub fn new(round_id: RoundId, authority: AuthorityId, value: VoteValue, weight: u64) -> Self {
        Vote {
            round_id,
            authority,
            value,
            weight,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            signature: Vec::new(),
        }
    }

    pub fn with_signature(mut self, signature: Vec<u8>) -> Self {
        self.signature = signature;
        self
    }
}

/// Authority information
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Authority {
    pub id: AuthorityId,
    pub weight: u64,
    pub reputation: f64,
    pub is_byzantine: bool,
}

impl Authority {
    pub fn new(id: AuthorityId, weight: u64) -> Self {
        Authority {
            id,
            weight,
            reputation: 1.0,
            is_byzantine: false,
        }
    }

    pub fn with_reputation(mut self, reputation: f64) -> Self {
        self.reputation = reputation;
        self
    }
}

/// Consensus phase in PBFT protocol
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConsensusPhase {
    Idle,
    PrePrepare,
    Prepare,
    Commit,
    Decided,
    ViewChange,
}

/// BFT Consensus result
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BftConsensusResult {
    pub round_id: RoundId,
    pub value: VoteValue,
    pub total_weight: u64,
    pub participating_authorities: HashSet<AuthorityId>,
    pub phase: ConsensusPhase,
}

/// Legacy consensus result (for backward compatibility)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusResult {
    /// Whether consensus was reached
    pub reached: bool,
    /// Number of votes in favor
    pub votes_for: usize,
    /// Total number of votes
    pub total_votes: usize,
    /// Required threshold
    pub threshold: f64,
    /// Participating agent IDs
    pub agents: Vec<Uuid>,
}

impl ConsensusResult {
    /// Check if consensus was reached
    pub fn is_valid(&self) -> bool {
        self.reached
    }

    /// Get the consensus percentage
    pub fn percentage(&self) -> f64 {
        if self.total_votes == 0 {
            0.0
        } else {
            self.votes_for as f64 / self.total_votes as f64
        }
    }
}

/// Consensus trait for different consensus implementations
pub trait Consensus: Send + Sync {
    /// Submit a vote for the current round
    fn submit_vote(&mut self, vote: Vote) -> Result<()>;

    /// Check if consensus has been reached
    fn has_consensus(&self) -> bool;

    /// Get the consensus result if reached
    fn get_result(&self) -> Option<BftConsensusResult>;

    /// Get current consensus phase
    fn get_phase(&self) -> ConsensusPhase;

    /// Start a new consensus round
    fn start_round(&mut self, round_id: RoundId, value: VoteValue) -> Result<()>;

    /// Get current round ID
    fn current_round(&self) -> RoundId;

    /// Get participating authorities
    fn authorities(&self) -> Vec<Authority>;

    /// Handle timeout for current round
    fn handle_timeout(&mut self) -> Result<()>;
}

/// Vote from an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentVote {
    /// Agent ID
    pub agent_id: Uuid,
    /// Vote result (true = valid, false = invalid)
    pub vote: bool,
    /// Optional reasoning/error message
    pub message: Option<String>,
}

impl AgentVote {
    /// Create a positive vote
    pub fn approve(agent_id: Uuid) -> Self {
        Self {
            agent_id,
            vote: true,
            message: None,
        }
    }

    /// Create a negative vote
    pub fn reject(agent_id: Uuid, message: String) -> Self {
        Self {
            agent_id,
            vote: false,
            message: Some(message),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_consensus_result() {
        let result = ConsensusResult {
            reached: true,
            votes_for: 7,
            total_votes: 10,
            threshold: 0.67,
            agents: vec![Uuid::new_v4(); 10],
        };

        assert!(result.is_valid());
        assert_eq!(result.percentage(), 0.7);
    }

    #[test]
    fn test_agent_vote() {
        let approve = AgentVote::approve(Uuid::new_v4());
        assert!(approve.vote);
        assert!(approve.message.is_none());

        let reject = AgentVote::reject(Uuid::new_v4(), "Invalid signature".to_string());
        assert!(!reject.vote);
        assert!(reject.message.is_some());
    }
}

/// Consensus configuration
#[derive(Debug, Clone)]
pub struct ConsensusConfig {
    /// Threshold for consensus (0.0-1.0)
    pub threshold: f64,
    /// Timeout in milliseconds
    pub timeout_ms: u64,
}

impl ConsensusConfig {
    /// Create a new consensus configuration
    pub fn new(threshold: f64, timeout_ms: u64) -> Result<Self> {
        if !(0.0..=1.0).contains(&threshold) {
            return Err(Error::config("Consensus threshold must be between 0.0 and 1.0"));
        }
        Ok(Self {
            threshold,
            timeout_ms,
        })
    }
}

/// Consensus engine for multi-agent verification
pub struct ConsensusEngine {
    config: ConsensusConfig,
}

impl ConsensusEngine {
    /// Create a new consensus engine
    pub fn new(config: ConsensusConfig) -> Self {
        Self { config }
    }

    /// Verify with consensus across multiple agents
    pub async fn verify_with_consensus(
        &self,
        agents: Vec<Arc<dyn VerificationAgent>>,
        signature: Signature,
        message: &[u8],
        public_key: &VerifyingKey,
    ) -> Result<ConsensusResult> {
        if agents.is_empty() {
            return Err(Error::agent_pool("No agents available for consensus"));
        }

        let total_votes = agents.len();
        let mut votes_for = 0;
        let mut agent_ids = Vec::with_capacity(total_votes);

        // Collect votes from all agents
        let sig_bytes = signature.to_bytes();
        for agent in &agents {
            agent_ids.push(agent.id());
            match agent.verify(message, &sig_bytes, public_key).await {
                Ok(true) => votes_for += 1,
                Ok(false) => {
                    tracing::debug!("Agent {} voted invalid", agent.id());
                }
                Err(e) => {
                    tracing::warn!("Agent {} verification error: {}", agent.id(), e);
                }
            }
        }

        let reached = (votes_for as f64 / total_votes as f64) >= self.config.threshold;

        Ok(ConsensusResult {
            reached,
            votes_for,
            total_votes,
            threshold: self.config.threshold,
            agents: agent_ids,
        })
    }
}
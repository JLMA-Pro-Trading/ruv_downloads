use crate::error::{GovernanceError, Result};
use crate::types::{ProposalState, ProposalType, Vote, VotingResults};
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Proposal in the governance system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Proposal {
    pub id: String,
    pub title: String,
    pub description: String,
    pub proposal_type: ProposalType,
    pub proposer: String,
    pub state: ProposalState,
    pub created_at: DateTime<Utc>,
    pub voting_starts_at: DateTime<Utc>,
    pub voting_ends_at: DateTime<Utc>,
    pub votes: Vec<Vote>,
    pub results: VotingResults,
    pub execution_time: Option<DateTime<Utc>>,
    pub executed_at: Option<DateTime<Utc>>,
    pub vetoed_by: Option<String>,
    pub veto_reason: Option<String>,
}

impl Proposal {
    pub fn new(
        title: String,
        description: String,
        proposal_type: ProposalType,
        proposer: String,
        voting_period_seconds: i64,
    ) -> Self {
        let now = Utc::now();
        let voting_ends_at = now + chrono::Duration::seconds(voting_period_seconds);

        Self {
            id: Uuid::new_v4().to_string(),
            title,
            description,
            proposal_type,
            proposer,
            state: ProposalState::Active,
            created_at: now,
            voting_starts_at: now,
            voting_ends_at,
            votes: Vec::new(),
            results: VotingResults::new(),
            execution_time: None,
            executed_at: None,
            vetoed_by: None,
            veto_reason: None,
        }
    }

    /// Check if voting period is active
    pub fn is_voting_active(&self) -> bool {
        let now = Utc::now();
        self.state == ProposalState::Active
            && now >= self.voting_starts_at
            && now <= self.voting_ends_at
    }

    /// Check if voting period has ended
    pub fn has_voting_ended(&self) -> bool {
        Utc::now() > self.voting_ends_at
    }

    /// Check if member has already voted
    pub fn has_voted(&self, member_id: &str) -> bool {
        self.votes.iter().any(|v| v.voter_id == member_id)
    }

    /// Add a vote
    pub fn add_vote(&mut self, vote: Vote) -> Result<()> {
        if !self.is_voting_active() {
            return Err(GovernanceError::VotingPeriodEnded);
        }

        if self.has_voted(&vote.voter_id) {
            return Err(GovernanceError::AlreadyVoted);
        }

        self.votes.push(vote);
        Ok(())
    }

    /// Calculate results
    pub fn calculate_results(&mut self, total_voting_power: Decimal, quorum: Decimal, threshold: Decimal) {
        self.results = VotingResults::new();
        self.results.total_voting_power = total_voting_power;

        for vote in &self.votes {
            match vote.vote_type {
                crate::types::VoteType::For => {
                    self.results.votes_for += vote.voting_power;
                }
                crate::types::VoteType::Against => {
                    self.results.votes_against += vote.voting_power;
                }
                crate::types::VoteType::Abstain => {
                    self.results.votes_abstain += vote.voting_power;
                }
            }
        }

        self.results.calculate(quorum, threshold);
    }

    /// Finalize proposal after voting
    pub fn finalize(&mut self) -> Result<()> {
        if !self.has_voting_ended() {
            return Err(GovernanceError::VotingPeriodNotEnded);
        }

        if self.state != ProposalState::Active {
            return Err(GovernanceError::InvalidProposalState {
                expected: ProposalState::Active.to_string(),
                actual: self.state.to_string(),
            });
        }

        self.state = if self.results.passed {
            ProposalState::Passed
        } else if !self.results.quorum_reached {
            ProposalState::Expired
        } else {
            ProposalState::Rejected
        };

        Ok(())
    }

    /// Mark as executed
    pub fn mark_executed(&mut self) -> Result<()> {
        if self.state != ProposalState::Passed {
            return Err(GovernanceError::InvalidProposalState {
                expected: ProposalState::Passed.to_string(),
                actual: self.state.to_string(),
            });
        }

        self.state = ProposalState::Executed;
        self.executed_at = Some(Utc::now());
        Ok(())
    }

    /// Veto the proposal
    pub fn veto(&mut self, vetoer: String, reason: String) -> Result<()> {
        if self.state == ProposalState::Executed {
            return Err(GovernanceError::AlreadyExecuted);
        }

        self.state = ProposalState::Vetoed;
        self.vetoed_by = Some(vetoer);
        self.veto_reason = Some(reason);
        Ok(())
    }

    /// Set execution time (timelock)
    pub fn set_execution_time(&mut self, execution_time: DateTime<Utc>) {
        self.execution_time = Some(execution_time);
    }

    /// Check if ready for execution
    pub fn is_ready_for_execution(&self) -> bool {
        if self.state != ProposalState::Passed {
            return false;
        }

        if let Some(execution_time) = self.execution_time {
            Utc::now() >= execution_time
        } else {
            true
        }
    }
}

/// Proposal manager
pub struct ProposalManager {
    proposals: Arc<DashMap<String, Proposal>>,
}

impl ProposalManager {
    pub fn new() -> Self {
        Self {
            proposals: Arc::new(DashMap::new()),
        }
    }

    /// Create a new proposal
    pub fn create_proposal(
        &self,
        title: String,
        description: String,
        proposal_type: ProposalType,
        proposer: String,
        voting_period_seconds: i64,
    ) -> Result<String> {
        let proposal = Proposal::new(title, description, proposal_type, proposer, voting_period_seconds);
        let id = proposal.id.clone();
        self.proposals.insert(id.clone(), proposal);
        Ok(id)
    }

    /// Get a proposal
    pub fn get_proposal(&self, id: &str) -> Result<Proposal> {
        self.proposals
            .get(id)
            .map(|r| r.value().clone())
            .ok_or_else(|| GovernanceError::ProposalNotFound(id.to_string()))
    }

    /// Add a vote to a proposal
    pub fn add_vote(&self, proposal_id: &str, vote: Vote) -> Result<()> {
        let mut proposal = self.proposals
            .get_mut(proposal_id)
            .ok_or_else(|| GovernanceError::ProposalNotFound(proposal_id.to_string()))?;
        proposal.add_vote(vote)
    }

    /// Calculate results for a proposal
    pub fn calculate_results(
        &self,
        proposal_id: &str,
        total_voting_power: Decimal,
        quorum: Decimal,
        threshold: Decimal,
    ) -> Result<()> {
        let mut proposal = self.proposals
            .get_mut(proposal_id)
            .ok_or_else(|| GovernanceError::ProposalNotFound(proposal_id.to_string()))?;
        proposal.calculate_results(total_voting_power, quorum, threshold);
        Ok(())
    }

    /// Finalize a proposal
    pub fn finalize_proposal(&self, proposal_id: &str) -> Result<()> {
        let mut proposal = self.proposals
            .get_mut(proposal_id)
            .ok_or_else(|| GovernanceError::ProposalNotFound(proposal_id.to_string()))?;
        proposal.finalize()
    }

    /// Mark proposal as executed
    pub fn mark_executed(&self, proposal_id: &str) -> Result<()> {
        let mut proposal = self.proposals
            .get_mut(proposal_id)
            .ok_or_else(|| GovernanceError::ProposalNotFound(proposal_id.to_string()))?;
        proposal.mark_executed()
    }

    /// Veto a proposal
    pub fn veto_proposal(&self, proposal_id: &str, vetoer: String, reason: String) -> Result<()> {
        let mut proposal = self.proposals
            .get_mut(proposal_id)
            .ok_or_else(|| GovernanceError::ProposalNotFound(proposal_id.to_string()))?;
        proposal.veto(vetoer, reason)
    }

    /// Set execution time for a proposal
    pub fn set_execution_time(&self, proposal_id: &str, execution_time: DateTime<Utc>) -> Result<()> {
        let mut proposal = self.proposals
            .get_mut(proposal_id)
            .ok_or_else(|| GovernanceError::ProposalNotFound(proposal_id.to_string()))?;
        proposal.set_execution_time(execution_time);
        Ok(())
    }

    /// Get all proposals
    pub fn get_all_proposals(&self) -> Vec<Proposal> {
        self.proposals.iter().map(|r| r.value().clone()).collect()
    }

    /// Get proposals by state
    pub fn get_proposals_by_state(&self, state: ProposalState) -> Vec<Proposal> {
        self.proposals
            .iter()
            .filter(|r| r.value().state == state)
            .map(|r| r.value().clone())
            .collect()
    }

    /// Get active proposals
    pub fn get_active_proposals(&self) -> Vec<Proposal> {
        self.get_proposals_by_state(ProposalState::Active)
    }

    /// Get proposals ready for execution
    pub fn get_executable_proposals(&self) -> Vec<Proposal> {
        self.proposals
            .iter()
            .filter(|r| r.value().is_ready_for_execution())
            .map(|r| r.value().clone())
            .collect()
    }

    /// Get proposal count
    pub fn proposal_count(&self) -> usize {
        self.proposals.len()
    }
}

impl Default for ProposalManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::VoteType;

    #[test]
    fn test_proposal_creation() {
        let proposal = Proposal::new(
            "Test Proposal".to_string(),
            "Description".to_string(),
            ProposalType::EmergencyAction {
                action: "Pause trading".to_string(),
                reason: "Security issue".to_string(),
            },
            "proposer1".to_string(),
            3600,
        );

        assert_eq!(proposal.title, "Test Proposal");
        assert_eq!(proposal.state, ProposalState::Active);
        assert!(proposal.is_voting_active());
    }

    #[test]
    fn test_add_vote() {
        let mut proposal = Proposal::new(
            "Test".to_string(),
            "Desc".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Test".to_string(),
            },
            "proposer1".to_string(),
            3600,
        );

        let vote = Vote {
            voter_id: "voter1".to_string(),
            vote_type: VoteType::For,
            voting_power: Decimal::from(100),
            timestamp: Utc::now(),
            reason: None,
        };

        assert!(proposal.add_vote(vote).is_ok());
        assert_eq!(proposal.votes.len(), 1);
    }

    #[test]
    fn test_duplicate_vote() {
        let mut proposal = Proposal::new(
            "Test".to_string(),
            "Desc".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Test".to_string(),
            },
            "proposer1".to_string(),
            3600,
        );

        let vote1 = Vote {
            voter_id: "voter1".to_string(),
            vote_type: VoteType::For,
            voting_power: Decimal::from(100),
            timestamp: Utc::now(),
            reason: None,
        };

        let vote2 = Vote {
            voter_id: "voter1".to_string(),
            vote_type: VoteType::Against,
            voting_power: Decimal::from(100),
            timestamp: Utc::now(),
            reason: None,
        };

        proposal.add_vote(vote1).unwrap();
        assert!(proposal.add_vote(vote2).is_err());
    }
}

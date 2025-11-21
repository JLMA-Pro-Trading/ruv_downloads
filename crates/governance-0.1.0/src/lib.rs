//! # Governance Crate
//!
//! A comprehensive governance system for decentralized decision-making in the Neural Trader platform.
//!
//! ## Features
//!
//! - **Proposal Management**: Create, submit, and manage proposals with various types
//! - **Weighted Voting**: Vote on proposals with weighted voting power based on stake/reputation
//! - **Execution System**: Automatic execution with time-locks and veto mechanisms
//! - **Member Management**: Register members with roles and voting power
//! - **Treasury Integration**: Budget allocation and fund management through governance
//!
//! ## Example
//!
//! ```rust
//! use governance::{GovernanceSystem, types::*};
//! use rust_decimal::Decimal;
//!
//! # fn main() -> Result<(), Box<dyn std::error::Error>> {
//! // Create governance system
//! let governance = GovernanceSystem::new(GovernanceConfig::default());
//!
//! // Register members
//! governance.register_member("alice".to_string(), Role::Member, Decimal::from(100))?;
//! governance.register_member("bob".to_string(), Role::Member, Decimal::from(150))?;
//!
//! // Create a proposal
//! let proposal_id = governance.create_proposal(
//!     "Increase Risk Limit".to_string(),
//!     "Proposal to increase daily risk limit".to_string(),
//!     ProposalType::RiskLimitAdjustment {
//!         limit_type: "daily_var".to_string(),
//!         old_limit: Decimal::from(10000),
//!         new_limit: Decimal::from(15000),
//!     },
//!     "alice".to_string(),
//! )?;
//!
//! // Cast votes
//! governance.vote(&proposal_id, "alice", VoteType::For, None)?;
//! governance.vote(&proposal_id, "bob", VoteType::For, None)?;
//!
//! # Ok(())
//! # }
//! ```

pub mod error;
pub mod execution;
pub mod member;
pub mod proposal;
pub mod treasury;
pub mod types;
pub mod voting;

use crate::error::Result;
use crate::execution::ProposalExecutor;
use crate::member::MemberManager;
use crate::proposal::ProposalManager;
use crate::treasury::TreasuryManager;
use crate::types::*;
use crate::voting::VotingSystem;
use rust_decimal::Decimal;
use std::sync::Arc;

/// Main governance system
pub struct GovernanceSystem {
    config: GovernanceConfig,
    member_manager: Arc<MemberManager>,
    proposal_manager: Arc<ProposalManager>,
    voting_system: Arc<VotingSystem>,
    executor: Arc<ProposalExecutor>,
    treasury: Arc<TreasuryManager>,
}

impl GovernanceSystem {
    /// Create a new governance system
    pub fn new(config: GovernanceConfig) -> Self {
        let member_manager = Arc::new(MemberManager::new());
        let proposal_manager = Arc::new(ProposalManager::new());
        let voting_system = Arc::new(VotingSystem::new(
            proposal_manager.clone(),
            member_manager.clone(),
        ));
        let executor = Arc::new(ProposalExecutor::new(
            proposal_manager.clone(),
            member_manager.clone(),
            config.execution_config.clone(),
        ));
        let treasury = Arc::new(TreasuryManager::new(
            Decimal::ZERO,
            Decimal::from(100000),
        ));

        Self {
            config,
            member_manager,
            proposal_manager,
            voting_system,
            executor,
            treasury,
        }
    }

    /// Register a new member
    pub fn register_member(&self, id: String, role: Role, voting_power: Decimal) -> Result<()> {
        self.member_manager.register_member(id, role, voting_power)
    }

    /// Create a new proposal
    pub fn create_proposal(
        &self,
        title: String,
        description: String,
        proposal_type: ProposalType,
        proposer: String,
    ) -> Result<String> {
        // Verify proposer exists and has permission
        let member = self.member_manager.get_member(&proposer)?;
        if !member.role.can_propose() {
            return Err(error::GovernanceError::InsufficientPermissions {
                required: "Proposal rights".to_string(),
                actual: member.role.to_string(),
            });
        }

        // Create proposal
        let proposal_id = self.proposal_manager.create_proposal(
            title,
            description,
            proposal_type,
            proposer.clone(),
            self.config.voting_period_seconds,
        )?;

        // Record proposal creation
        self.member_manager.record_proposal(&proposer)?;

        Ok(proposal_id)
    }

    /// Cast a vote
    pub fn vote(
        &self,
        proposal_id: &str,
        voter_id: &str,
        vote_type: VoteType,
        reason: Option<String>,
    ) -> Result<()> {
        self.voting_system.cast_vote(proposal_id, voter_id, vote_type, reason)
    }

    /// Finalize voting on a proposal
    pub fn finalize_voting(&self, proposal_id: &str) -> Result<()> {
        self.voting_system.finalize_voting(
            proposal_id,
            self.config.quorum_percentage,
            self.config.passing_threshold,
        )?;

        // Set timelock if proposal passed
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        if proposal.state == ProposalState::Passed {
            self.executor.set_timelock(proposal_id)?;
        }

        Ok(())
    }

    /// Execute a proposal
    pub fn execute_proposal(
        &self,
        proposal_id: &str,
        executor_id: &str,
    ) -> Result<execution::ExecutionResult> {
        self.executor.execute_proposal(proposal_id, executor_id)
    }

    /// Veto a proposal
    pub fn veto_proposal(&self, proposal_id: &str, vetoer_id: &str, reason: String) -> Result<()> {
        self.executor.veto_proposal(proposal_id, vetoer_id, reason)
    }

    /// Get proposal
    pub fn get_proposal(&self, proposal_id: &str) -> Result<proposal::Proposal> {
        self.proposal_manager.get_proposal(proposal_id)
    }

    /// Get member
    pub fn get_member(&self, member_id: &str) -> Result<member::Member> {
        self.member_manager.get_member(member_id)
    }

    /// Get voting statistics
    pub fn get_voting_statistics(
        &self,
        proposal_id: &str,
    ) -> Result<voting::VotingStatistics> {
        self.voting_system.get_voting_statistics(proposal_id)
    }

    /// Get treasury statistics
    pub fn get_treasury_statistics(&self) -> treasury::TreasuryStatistics {
        self.treasury.get_statistics()
    }

    /// Delegate voting power
    pub fn delegate(&self, from: &str, to: &str) -> Result<()> {
        self.member_manager.delegate(from, to)
    }

    /// Get all active proposals
    pub fn get_active_proposals(&self) -> Vec<proposal::Proposal> {
        self.proposal_manager.get_active_proposals()
    }

    /// Get member count
    pub fn member_count(&self) -> usize {
        self.member_manager.member_count()
    }

    /// Get proposal count
    pub fn proposal_count(&self) -> usize {
        self.proposal_manager.proposal_count()
    }

    /// Get configuration
    pub fn get_config(&self) -> &GovernanceConfig {
        &self.config
    }

    /// Access treasury manager
    pub fn treasury(&self) -> &Arc<TreasuryManager> {
        &self.treasury
    }

    /// Access member manager
    pub fn members(&self) -> &Arc<MemberManager> {
        &self.member_manager
    }

    /// Access proposal manager
    pub fn proposals(&self) -> &Arc<ProposalManager> {
        &self.proposal_manager
    }
}

impl Default for GovernanceSystem {
    fn default() -> Self {
        Self::new(GovernanceConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_governance_system_creation() {
        let governance = GovernanceSystem::new(GovernanceConfig::default());
        assert_eq!(governance.member_count(), 0);
        assert_eq!(governance.proposal_count(), 0);
    }

    #[test]
    fn test_full_workflow() {
        let governance = GovernanceSystem::new(GovernanceConfig::default());

        // Register members
        governance.register_member("alice".to_string(), Role::Admin, Decimal::from(100)).unwrap();
        governance.register_member("bob".to_string(), Role::Member, Decimal::from(150)).unwrap();

        assert_eq!(governance.member_count(), 2);

        // Create proposal
        let proposal_id = governance.create_proposal(
            "Test Proposal".to_string(),
            "Test Description".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Testing".to_string(),
            },
            "alice".to_string(),
        ).unwrap();

        assert_eq!(governance.proposal_count(), 1);

        // Cast votes
        governance.vote(&proposal_id, "alice", VoteType::For, None).unwrap();
        governance.vote(&proposal_id, "bob", VoteType::For, None).unwrap();

        // Verify votes were recorded
        let proposal = governance.get_proposal(&proposal_id).unwrap();
        assert_eq!(proposal.votes.len(), 2);
    }
}

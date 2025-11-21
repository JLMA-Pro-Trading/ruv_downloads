use crate::error::{GovernanceError, Result};
use crate::member::MemberManager;
use crate::proposal::ProposalManager;
use crate::types::{Vote, VoteType};
use chrono::Utc;
use rust_decimal::Decimal;
use std::sync::Arc;

/// Voting system for governance
pub struct VotingSystem {
    proposal_manager: Arc<ProposalManager>,
    member_manager: Arc<MemberManager>,
}

impl VotingSystem {
    pub fn new(proposal_manager: Arc<ProposalManager>, member_manager: Arc<MemberManager>) -> Self {
        Self {
            proposal_manager,
            member_manager,
        }
    }

    /// Cast a vote on a proposal
    pub fn cast_vote(
        &self,
        proposal_id: &str,
        voter_id: &str,
        vote_type: VoteType,
        reason: Option<String>,
    ) -> Result<()> {
        // Get member and verify voting rights
        let member = self.member_manager.get_member(voter_id)?;
        if !member.role.can_vote() {
            return Err(GovernanceError::InsufficientPermissions {
                required: "Voting rights".to_string(),
                actual: member.role.to_string(),
            });
        }

        // Get proposal and verify it's active
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        if !proposal.is_voting_active() {
            return Err(GovernanceError::VotingPeriodEnded);
        }

        // Check if already voted
        if proposal.has_voted(voter_id) {
            return Err(GovernanceError::AlreadyVoted);
        }

        // Get effective voting power (considering delegation)
        let voting_power = self.get_effective_voting_power(voter_id)?;

        // Create and add vote
        let vote = Vote {
            voter_id: voter_id.to_string(),
            vote_type,
            voting_power,
            timestamp: Utc::now(),
            reason,
        };

        self.proposal_manager.add_vote(proposal_id, vote)?;

        // Record vote in member statistics
        self.member_manager.record_vote(voter_id)?;

        Ok(())
    }

    /// Get effective voting power including delegations
    fn get_effective_voting_power(&self, voter_id: &str) -> Result<Decimal> {
        let member = self.member_manager.get_member(voter_id)?;
        let mut total_power = member.effective_voting_power();

        // Add delegated voting power from others
        let all_members = self.member_manager.get_all_members();
        for other_member in all_members {
            if let Some(delegated_to) = &other_member.delegated_to {
                if delegated_to == voter_id {
                    total_power += other_member.effective_voting_power();
                }
            }
        }

        Ok(total_power)
    }

    /// Calculate and finalize voting results
    pub fn finalize_voting(&self, proposal_id: &str, quorum: Decimal, threshold: Decimal) -> Result<()> {
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;

        if !proposal.has_voting_ended() {
            return Err(GovernanceError::VotingPeriodNotEnded);
        }

        // Calculate total voting power
        let total_voting_power = self.member_manager.total_voting_power();

        // Calculate results
        self.proposal_manager.calculate_results(
            proposal_id,
            total_voting_power,
            quorum,
            threshold,
        )?;

        // Finalize proposal
        self.proposal_manager.finalize_proposal(proposal_id)?;

        Ok(())
    }

    /// Get voting statistics for a proposal
    pub fn get_voting_statistics(&self, proposal_id: &str) -> Result<VotingStatistics> {
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        let total_voting_power = self.member_manager.total_voting_power();
        let total_members = self.member_manager.member_count();

        Ok(VotingStatistics {
            total_votes: proposal.votes.len(),
            total_members,
            votes_for: proposal.results.votes_for,
            votes_against: proposal.results.votes_against,
            votes_abstain: proposal.results.votes_abstain,
            total_voting_power,
            participation_rate: proposal.results.participation_rate,
            approval_rate: proposal.results.approval_rate,
            quorum_reached: proposal.results.quorum_reached,
            passed: proposal.results.passed,
        })
    }

    /// Get vote details for a specific voter
    pub fn get_voter_vote(&self, proposal_id: &str, voter_id: &str) -> Result<Option<Vote>> {
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        Ok(proposal.votes.iter().find(|v| v.voter_id == voter_id).cloned())
    }

    /// Check if a member can vote on a proposal
    pub fn can_vote(&self, proposal_id: &str, voter_id: &str) -> Result<bool> {
        let member = self.member_manager.get_member(voter_id)?;
        if !member.role.can_vote() {
            return Ok(false);
        }

        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        if !proposal.is_voting_active() {
            return Ok(false);
        }

        if proposal.has_voted(voter_id) {
            return Ok(false);
        }

        Ok(true)
    }

    /// Get all votes for a proposal
    pub fn get_votes(&self, proposal_id: &str) -> Result<Vec<Vote>> {
        let proposal = self.proposal_manager.get_proposal(proposal_id)?;
        Ok(proposal.votes.clone())
    }
}

/// Voting statistics
#[derive(Debug, Clone)]
pub struct VotingStatistics {
    pub total_votes: usize,
    pub total_members: usize,
    pub votes_for: Decimal,
    pub votes_against: Decimal,
    pub votes_abstain: Decimal,
    pub total_voting_power: Decimal,
    pub participation_rate: Decimal,
    pub approval_rate: Decimal,
    pub quorum_reached: bool,
    pub passed: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{ProposalType, Role};

    #[test]
    fn test_voting_system_creation() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let _voting_system = VotingSystem::new(proposal_manager, member_manager);
    }

    #[test]
    fn test_cast_vote() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let voting_system = VotingSystem::new(proposal_manager.clone(), member_manager.clone());

        // Register member
        member_manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();

        // Create proposal
        let proposal_id = proposal_manager.create_proposal(
            "Test".to_string(),
            "Desc".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Test".to_string(),
            },
            "member1".to_string(),
            3600,
        ).unwrap();

        // Cast vote
        assert!(voting_system.cast_vote(&proposal_id, "member1", VoteType::For, None).is_ok());
    }

    #[test]
    fn test_duplicate_vote_prevention() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let voting_system = VotingSystem::new(proposal_manager.clone(), member_manager.clone());

        member_manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();

        let proposal_id = proposal_manager.create_proposal(
            "Test".to_string(),
            "Desc".to_string(),
            ProposalType::EmergencyAction {
                action: "Test".to_string(),
                reason: "Test".to_string(),
            },
            "member1".to_string(),
            3600,
        ).unwrap();

        voting_system.cast_vote(&proposal_id, "member1", VoteType::For, None).unwrap();
        assert!(voting_system.cast_vote(&proposal_id, "member1", VoteType::Against, None).is_err());
    }

    #[test]
    fn test_delegation_voting_power() {
        let proposal_manager = Arc::new(ProposalManager::new());
        let member_manager = Arc::new(MemberManager::new());
        let voting_system = VotingSystem::new(proposal_manager, member_manager.clone());

        member_manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();
        member_manager.register_member("member2".to_string(), Role::Member, Decimal::from(50)).unwrap();

        // Member2 delegates to member1
        member_manager.delegate("member2", "member1").unwrap();

        // Member1's effective power should be 150 (100 + 50)
        let power = voting_system.get_effective_voting_power("member1").unwrap();
        assert_eq!(power, Decimal::from(150));
    }
}

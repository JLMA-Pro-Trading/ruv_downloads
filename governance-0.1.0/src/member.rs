use crate::error::{GovernanceError, Result};
use crate::types::Role;
use chrono::{DateTime, Utc};
use dashmap::DashMap;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Member in the governance system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Member {
    pub id: String,
    pub role: Role,
    pub voting_power: Decimal,
    pub reputation: Decimal,
    pub stake: Decimal,
    pub joined_at: DateTime<Utc>,
    pub last_vote_at: Option<DateTime<Utc>>,
    pub proposals_created: usize,
    pub votes_cast: usize,
    pub delegated_to: Option<String>,
}

impl Member {
    pub fn new(id: String, role: Role, voting_power: Decimal) -> Self {
        Self {
            id,
            role,
            voting_power,
            reputation: Decimal::from(100), // Start with base reputation
            stake: Decimal::ZERO,
            joined_at: Utc::now(),
            last_vote_at: None,
            proposals_created: 0,
            votes_cast: 0,
            delegated_to: None,
        }
    }

    pub fn effective_voting_power(&self) -> Decimal {
        // Combine voting power with reputation multiplier
        let reputation_multiplier = self.reputation / Decimal::from(100);
        self.voting_power * reputation_multiplier
    }

    pub fn update_reputation(&mut self, delta: Decimal) {
        self.reputation = (self.reputation + delta).max(Decimal::ZERO).min(Decimal::from(200));
    }

    pub fn record_vote(&mut self) {
        self.last_vote_at = Some(Utc::now());
        self.votes_cast += 1;
        // Increase reputation for participation
        self.update_reputation(rust_decimal_macros::dec!(0.1));
    }

    pub fn record_proposal(&mut self) {
        self.proposals_created += 1;
        // Increase reputation for proposal creation
        self.update_reputation(rust_decimal_macros::dec!(0.5));
    }

    pub fn delegate(&mut self, to: String) {
        self.delegated_to = Some(to);
    }

    pub fn undelegate(&mut self) {
        self.delegated_to = None;
    }
}

/// Member manager for the governance system
pub struct MemberManager {
    members: Arc<DashMap<String, Member>>,
}

impl MemberManager {
    pub fn new() -> Self {
        Self {
            members: Arc::new(DashMap::new()),
        }
    }

    /// Register a new member
    pub fn register_member(&self, id: String, role: Role, voting_power: Decimal) -> Result<()> {
        if voting_power < Decimal::ZERO {
            return Err(GovernanceError::InvalidVotingWeight(
                "Voting power cannot be negative".to_string(),
            ));
        }

        if self.members.contains_key(&id) {
            return Err(GovernanceError::MemberAlreadyExists(id));
        }

        let member = Member::new(id.clone(), role, voting_power);
        self.members.insert(id, member);
        Ok(())
    }

    /// Get a member
    pub fn get_member(&self, id: &str) -> Result<Member> {
        self.members
            .get(id)
            .map(|r| r.value().clone())
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))
    }

    /// Update member role
    pub fn update_role(&self, id: &str, new_role: Role) -> Result<()> {
        let mut member = self.members
            .get_mut(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        member.role = new_role;
        Ok(())
    }

    /// Update member voting power
    pub fn update_voting_power(&self, id: &str, new_power: Decimal) -> Result<()> {
        if new_power < Decimal::ZERO {
            return Err(GovernanceError::InvalidVotingWeight(
                "Voting power cannot be negative".to_string(),
            ));
        }

        let mut member = self.members
            .get_mut(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        member.voting_power = new_power;
        Ok(())
    }

    /// Update member stake
    pub fn update_stake(&self, id: &str, stake: Decimal) -> Result<()> {
        let mut member = self.members
            .get_mut(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        member.stake = stake;
        Ok(())
    }

    /// Delegate voting power
    pub fn delegate(&self, from: &str, to: &str) -> Result<()> {
        if !self.members.contains_key(to) {
            return Err(GovernanceError::MemberNotFound(to.to_string()));
        }

        let mut member = self.members
            .get_mut(from)
            .ok_or_else(|| GovernanceError::MemberNotFound(from.to_string()))?;
        member.delegate(to.to_string());
        Ok(())
    }

    /// Undelegate voting power
    pub fn undelegate(&self, id: &str) -> Result<()> {
        let mut member = self.members
            .get_mut(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        member.undelegate();
        Ok(())
    }

    /// Remove a member
    pub fn remove_member(&self, id: &str) -> Result<()> {
        self.members
            .remove(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        Ok(())
    }

    /// Get total voting power
    pub fn total_voting_power(&self) -> Decimal {
        self.members
            .iter()
            .map(|r| r.value().effective_voting_power())
            .sum()
    }

    /// Get member count
    pub fn member_count(&self) -> usize {
        self.members.len()
    }

    /// Get all members
    pub fn get_all_members(&self) -> Vec<Member> {
        self.members.iter().map(|r| r.value().clone()).collect()
    }

    /// Get members by role
    pub fn get_members_by_role(&self, role: Role) -> Vec<Member> {
        self.members
            .iter()
            .filter(|r| r.value().role == role)
            .map(|r| r.value().clone())
            .collect()
    }

    /// Record a vote for a member
    pub fn record_vote(&self, id: &str) -> Result<()> {
        let mut member = self.members
            .get_mut(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        member.record_vote();
        Ok(())
    }

    /// Record a proposal for a member
    pub fn record_proposal(&self, id: &str) -> Result<()> {
        let mut member = self.members
            .get_mut(id)
            .ok_or_else(|| GovernanceError::MemberNotFound(id.to_string()))?;
        member.record_proposal();
        Ok(())
    }
}

impl Default for MemberManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_member_creation() {
        let member = Member::new("member1".to_string(), Role::Member, Decimal::from(100));
        assert_eq!(member.id, "member1");
        assert_eq!(member.role, Role::Member);
        assert_eq!(member.voting_power, Decimal::from(100));
        assert_eq!(member.reputation, Decimal::from(100));
    }

    #[test]
    fn test_effective_voting_power() {
        let mut member = Member::new("member1".to_string(), Role::Member, Decimal::from(100));
        assert_eq!(member.effective_voting_power(), Decimal::from(100));

        member.reputation = Decimal::from(150);
        assert_eq!(member.effective_voting_power(), Decimal::from(150));
    }

    #[test]
    fn test_member_manager_register() {
        let manager = MemberManager::new();
        assert!(manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).is_ok());
        assert!(manager.get_member("member1").is_ok());
    }

    #[test]
    fn test_member_manager_duplicate() {
        let manager = MemberManager::new();
        manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();
        assert!(manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).is_err());
    }

    #[test]
    fn test_delegation() {
        let manager = MemberManager::new();
        manager.register_member("member1".to_string(), Role::Member, Decimal::from(100)).unwrap();
        manager.register_member("member2".to_string(), Role::Member, Decimal::from(100)).unwrap();

        assert!(manager.delegate("member1", "member2").is_ok());
        let member = manager.get_member("member1").unwrap();
        assert_eq!(member.delegated_to, Some("member2".to_string()));
    }
}

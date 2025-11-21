//! Reputation System
//!
//! Manages authority reputation for weighted Byzantine Fault Tolerant consensus.
//! Reputation affects vote weights and Byzantine detection.

use super::AuthorityId;
use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Reputation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationConfig {
    /// Initial reputation for new authorities
    pub initial_reputation: f64,
    /// Minimum reputation before authority is excluded
    pub min_reputation: f64,
    /// Maximum reputation cap
    pub max_reputation: f64,
    /// Reputation increase for correct votes
    pub correct_vote_reward: f64,
    /// Reputation decrease for incorrect votes
    pub incorrect_vote_penalty: f64,
    /// Reputation decrease for timeouts
    pub timeout_penalty: f64,
    /// Reputation decrease for Byzantine behavior
    pub byzantine_penalty: f64,
    /// Decay rate per round (0.0 = no decay)
    pub decay_rate: f64,
}

impl Default for ReputationConfig {
    fn default() -> Self {
        ReputationConfig {
            initial_reputation: 1.0,
            min_reputation: 0.1,
            max_reputation: 2.0,
            correct_vote_reward: 0.01,
            incorrect_vote_penalty: 0.05,
            timeout_penalty: 0.02,
            byzantine_penalty: 0.5,
            decay_rate: 0.001,
        }
    }
}

/// Authority reputation entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationEntry {
    pub authority: AuthorityId,
    pub reputation: f64,
    pub correct_votes: u64,
    pub incorrect_votes: u64,
    pub timeouts: u64,
    pub byzantine_faults: u64,
    pub total_rounds: u64,
}

impl ReputationEntry {
    pub fn new(authority: AuthorityId, initial_reputation: f64) -> Self {
        ReputationEntry {
            authority,
            reputation: initial_reputation,
            correct_votes: 0,
            incorrect_votes: 0,
            timeouts: 0,
            byzantine_faults: 0,
            total_rounds: 0,
        }
    }

    /// Calculate accuracy rate
    pub fn accuracy(&self) -> f64 {
        let total = self.correct_votes + self.incorrect_votes;
        if total == 0 {
            1.0
        } else {
            self.correct_votes as f64 / total as f64
        }
    }

    /// Calculate reliability (considering timeouts)
    pub fn reliability(&self) -> f64 {
        if self.total_rounds == 0 {
            1.0
        } else {
            let participated = self.total_rounds - self.timeouts;
            participated as f64 / self.total_rounds as f64
        }
    }

    /// Check if authority is trustworthy
    pub fn is_trustworthy(&self, min_reputation: f64) -> bool {
        self.reputation >= min_reputation && self.byzantine_faults == 0
    }
}

/// Reputation system
pub struct ReputationSystem {
    config: ReputationConfig,
    reputations: HashMap<AuthorityId, ReputationEntry>,
}

impl ReputationSystem {
    pub fn new(config: ReputationConfig) -> Self {
        ReputationSystem {
            config,
            reputations: HashMap::new(),
        }
    }

    /// Register a new authority
    pub fn register_authority(&mut self, authority: AuthorityId) {
        if !self.reputations.contains_key(&authority) {
            self.reputations.insert(
                authority.clone(),
                ReputationEntry::new(authority, self.config.initial_reputation),
            );
        }
    }

    /// Get authority reputation
    pub fn get_reputation(&self, authority: &AuthorityId) -> Result<f64> {
        self.reputations
            .get(authority)
            .map(|e| e.reputation)
            .ok_or_else(|| Error::AuthorityNotFound {
                authority: authority.0.clone(),
            })
    }

    /// Get reputation entry
    pub fn get_entry(&self, authority: &AuthorityId) -> Result<&ReputationEntry> {
        self.reputations
            .get(authority)
            .ok_or_else(|| Error::AuthorityNotFound {
                authority: authority.0.clone(),
            })
    }

    /// Record correct vote
    pub fn record_correct_vote(&mut self, authority: &AuthorityId) -> Result<()> {
        let entry = self.reputations.get_mut(authority).ok_or_else(|| {
            Error::AuthorityNotFound {
                authority: authority.0.clone(),
            }
        })?;

        entry.correct_votes += 1;
        entry.total_rounds += 1;
        entry.reputation =
            (entry.reputation + self.config.correct_vote_reward).min(self.config.max_reputation);

        Ok(())
    }

    /// Record incorrect vote
    pub fn record_incorrect_vote(&mut self, authority: &AuthorityId) -> Result<()> {
        let entry = self.reputations.get_mut(authority).ok_or_else(|| {
            Error::AuthorityNotFound {
                authority: authority.0.clone(),
            }
        })?;

        entry.incorrect_votes += 1;
        entry.total_rounds += 1;
        entry.reputation =
            (entry.reputation - self.config.incorrect_vote_penalty).max(self.config.min_reputation);

        Ok(())
    }

    /// Record timeout
    pub fn record_timeout(&mut self, authority: &AuthorityId) -> Result<()> {
        let entry = self.reputations.get_mut(authority).ok_or_else(|| {
            Error::AuthorityNotFound {
                authority: authority.0.clone(),
            }
        })?;

        entry.timeouts += 1;
        entry.total_rounds += 1;
        entry.reputation =
            (entry.reputation - self.config.timeout_penalty).max(self.config.min_reputation);

        Ok(())
    }

    /// Record Byzantine fault
    pub fn record_byzantine_fault(&mut self, authority: &AuthorityId) -> Result<()> {
        let entry = self.reputations.get_mut(authority).ok_or_else(|| {
            Error::AuthorityNotFound {
                authority: authority.0.clone(),
            }
        })?;

        entry.byzantine_faults += 1;
        entry.reputation =
            (entry.reputation - self.config.byzantine_penalty).max(self.config.min_reputation);

        Ok(())
    }

    /// Apply reputation decay for all authorities
    pub fn apply_decay(&mut self) {
        for entry in self.reputations.values_mut() {
            let decay = entry.reputation * self.config.decay_rate;
            entry.reputation = (entry.reputation - decay).max(self.config.min_reputation);
        }
    }

    /// Get all trustworthy authorities
    pub fn get_trustworthy_authorities(&self) -> Vec<AuthorityId> {
        self.reputations
            .values()
            .filter(|e| e.is_trustworthy(self.config.min_reputation))
            .map(|e| e.authority.clone())
            .collect()
    }

    /// Calculate weighted reputation for authority
    pub fn calculate_weighted_reputation(&self, authority: &AuthorityId) -> Result<f64> {
        let entry = self.get_entry(authority)?;

        // Combine reputation with accuracy and reliability
        let base_reputation = entry.reputation;
        let accuracy_weight = entry.accuracy();
        let reliability_weight = entry.reliability();

        Ok(base_reputation * accuracy_weight * reliability_weight)
    }

    /// Get authorities ranked by reputation
    pub fn get_ranked_authorities(&self) -> Vec<(AuthorityId, f64)> {
        let mut ranked: Vec<_> = self
            .reputations
            .values()
            .map(|e| (e.authority.clone(), e.reputation))
            .collect();

        ranked.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        ranked
    }

    /// Get statistics
    pub fn get_statistics(&self) -> ReputationStatistics {
        let reputations: Vec<f64> = self.reputations.values().map(|e| e.reputation).collect();

        let avg_reputation = if reputations.is_empty() {
            0.0
        } else {
            reputations.iter().sum::<f64>() / reputations.len() as f64
        };

        let total_byzantine = self
            .reputations
            .values()
            .filter(|e| e.byzantine_faults > 0)
            .count();

        let total_trustworthy = self
            .reputations
            .values()
            .filter(|e| e.is_trustworthy(self.config.min_reputation))
            .count();

        ReputationStatistics {
            total_authorities: self.reputations.len(),
            avg_reputation,
            min_reputation: reputations.iter().cloned().fold(f64::INFINITY, f64::min),
            max_reputation: reputations.iter().cloned().fold(f64::NEG_INFINITY, f64::max),
            byzantine_count: total_byzantine,
            trustworthy_count: total_trustworthy,
        }
    }
}

/// Reputation statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationStatistics {
    pub total_authorities: usize,
    pub avg_reputation: f64,
    pub min_reputation: f64,
    pub max_reputation: f64,
    pub byzantine_count: usize,
    pub trustworthy_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_reputation_entry() {
        let entry = ReputationEntry::new(AuthorityId::from("auth-1"), 1.0);
        assert_eq!(entry.reputation, 1.0);
        assert_eq!(entry.accuracy(), 1.0);
        assert_eq!(entry.reliability(), 1.0);
    }

    #[test]
    fn test_accuracy_calculation() {
        let mut entry = ReputationEntry::new(AuthorityId::from("auth-1"), 1.0);
        entry.correct_votes = 8;
        entry.incorrect_votes = 2;
        assert_eq!(entry.accuracy(), 0.8);
    }

    #[test]
    fn test_reliability_calculation() {
        let mut entry = ReputationEntry::new(AuthorityId::from("auth-1"), 1.0);
        entry.total_rounds = 10;
        entry.timeouts = 2;
        assert_eq!(entry.reliability(), 0.8);
    }

    #[test]
    fn test_register_authority() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");

        system.register_authority(auth.clone());
        assert_eq!(system.get_reputation(&auth).unwrap(), 1.0);
    }

    #[test]
    fn test_record_correct_vote() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        system.record_correct_vote(&auth).unwrap();
        assert!(system.get_reputation(&auth).unwrap() > 1.0);

        let entry = system.get_entry(&auth).unwrap();
        assert_eq!(entry.correct_votes, 1);
        assert_eq!(entry.total_rounds, 1);
    }

    #[test]
    fn test_record_incorrect_vote() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        system.record_incorrect_vote(&auth).unwrap();
        assert!(system.get_reputation(&auth).unwrap() < 1.0);

        let entry = system.get_entry(&auth).unwrap();
        assert_eq!(entry.incorrect_votes, 1);
    }

    #[test]
    fn test_record_timeout() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        system.record_timeout(&auth).unwrap();
        assert!(system.get_reputation(&auth).unwrap() < 1.0);

        let entry = system.get_entry(&auth).unwrap();
        assert_eq!(entry.timeouts, 1);
    }

    #[test]
    fn test_record_byzantine_fault() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        let initial = system.get_reputation(&auth).unwrap();
        system.record_byzantine_fault(&auth).unwrap();

        assert!(system.get_reputation(&auth).unwrap() < initial);
        let entry = system.get_entry(&auth).unwrap();
        assert_eq!(entry.byzantine_faults, 1);
        assert!(!entry.is_trustworthy(0.1));
    }

    #[test]
    fn test_reputation_decay() {
        let config = ReputationConfig {
            decay_rate: 0.1,
            ..Default::default()
        };
        let mut system = ReputationSystem::new(config);
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        let initial = system.get_reputation(&auth).unwrap();
        system.apply_decay();

        assert!(system.get_reputation(&auth).unwrap() < initial);
    }

    #[test]
    fn test_reputation_bounds() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        // Test upper bound
        for _ in 0..100 {
            system.record_correct_vote(&auth).unwrap();
        }
        assert!(system.get_reputation(&auth).unwrap() <= 2.0);

        // Test lower bound
        for _ in 0..100 {
            system.record_incorrect_vote(&auth).unwrap();
        }
        assert!(system.get_reputation(&auth).unwrap() >= 0.1);
    }

    #[test]
    fn test_weighted_reputation() {
        let mut system = ReputationSystem::new(ReputationConfig::default());
        let auth = AuthorityId::from("auth-1");
        system.register_authority(auth.clone());

        system.record_correct_vote(&auth).unwrap();
        system.record_correct_vote(&auth).unwrap();
        system.record_timeout(&auth).unwrap();

        let weighted = system.calculate_weighted_reputation(&auth).unwrap();
        let base = system.get_reputation(&auth).unwrap();

        // Weighted should be lower due to timeout affecting reliability
        assert!(weighted < base);
    }

    #[test]
    fn test_ranked_authorities() {
        let mut system = ReputationSystem::new(ReputationConfig::default());

        for i in 0..3 {
            let auth = AuthorityId::from(format!("auth-{}", i));
            system.register_authority(auth.clone());

            for _ in 0..i {
                system.record_correct_vote(&auth).unwrap();
            }
        }

        let ranked = system.get_ranked_authorities();
        assert_eq!(ranked.len(), 3);

        // Should be sorted descending
        assert!(ranked[0].1 >= ranked[1].1);
        assert!(ranked[1].1 >= ranked[2].1);
    }

    #[test]
    fn test_statistics() {
        let mut system = ReputationSystem::new(ReputationConfig::default());

        for i in 0..5 {
            let auth = AuthorityId::from(format!("auth-{}", i));
            system.register_authority(auth.clone());
        }

        system.record_byzantine_fault(&AuthorityId::from("auth-0")).unwrap();

        let stats = system.get_statistics();
        assert_eq!(stats.total_authorities, 5);
        assert_eq!(stats.byzantine_count, 1);
        assert_eq!(stats.trustworthy_count, 4);
    }
}
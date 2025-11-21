//! Vote Collection and Aggregation
//!
//! Implements parallel vote collection with Byzantine fault detection
//! and weighted vote aggregation.

use super::{AuthorityId, RoundId, Vote, VoteValue};
use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

/// Voting configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotingConfig {
    /// Maximum time to collect votes
    pub vote_timeout: Duration,
    /// Allow duplicate votes (last one wins)
    pub allow_duplicate_votes: bool,
    /// Require vote signatures
    pub require_signatures: bool,
    /// Maximum votes per authority per round
    pub max_votes_per_authority: usize,
}

impl Default for VotingConfig {
    fn default() -> Self {
        VotingConfig {
            vote_timeout: Duration::from_secs(30),
            allow_duplicate_votes: false,
            require_signatures: true,
            max_votes_per_authority: 1,
        }
    }
}

/// Vote aggregation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteAggregation {
    pub value: VoteValue,
    pub total_weight: u64,
    pub vote_count: usize,
    pub authorities: HashSet<AuthorityId>,
}

/// Vote collector for a single consensus round
pub struct VoteCollector {
    round_id: RoundId,
    config: VotingConfig,
    votes: HashMap<AuthorityId, Vec<Vote>>,
    vote_by_value: HashMap<VoteValue, VoteAggregation>,
    start_time: Instant,
    total_votes: usize,
}

impl VoteCollector {
    pub fn new(round_id: RoundId, config: VotingConfig) -> Self {
        VoteCollector {
            round_id,
            config,
            votes: HashMap::new(),
            vote_by_value: HashMap::new(),
            start_time: Instant::now(),
            total_votes: 0,
        }
    }

    /// Add a vote to the collection
    pub fn add_vote(&mut self, vote: Vote) -> Result<()> {
        // Validate round ID
        if vote.round_id != self.round_id {
            return Err(Error::InvalidVote {
                authority: vote.authority.0.clone(),
                reason: format!(
                    "Wrong round: expected {}, got {}",
                    self.round_id, vote.round_id
                ),
            });
        }

        // Check timeout
        if self.start_time.elapsed() > self.config.vote_timeout {
            return Err(Error::Timeout {
                operation: "Vote collection".to_string(),
                duration: self.config.vote_timeout,
            });
        }

        // Validate signature if required
        if self.config.require_signatures && vote.signature.is_empty() {
            return Err(Error::InvalidVote {
                authority: vote.authority.0.clone(),
                reason: "Missing signature".to_string(),
            });
        }

        // Check for duplicate votes
        if let Some(existing_votes) = self.votes.get(&vote.authority) {
            if !self.config.allow_duplicate_votes && !existing_votes.is_empty() {
                return Err(Error::DuplicateVote {
                    authority: vote.authority.0.clone(),
                });
            }

            if existing_votes.len() >= self.config.max_votes_per_authority {
                return Err(Error::InvalidVote {
                    authority: vote.authority.0.clone(),
                    reason: format!(
                        "Exceeded max votes per authority: {}",
                        self.config.max_votes_per_authority
                    ),
                });
            }

            // Check for Byzantine behavior (voting for different values)
            if let Some(first_vote) = existing_votes.first() {
                if first_vote.value != vote.value {
                    return Err(Error::ByzantineFault {
                        message: format!(
                            "Authority {} voted for multiple values",
                            vote.authority
                        ),
                    });
                }
            }
        }

        // Update aggregation
        let aggregation = self
            .vote_by_value
            .entry(vote.value.clone())
            .or_insert_with(|| VoteAggregation {
                value: vote.value.clone(),
                total_weight: 0,
                vote_count: 0,
                authorities: HashSet::new(),
            });

        aggregation.total_weight += vote.weight;
        aggregation.vote_count += 1;
        aggregation.authorities.insert(vote.authority.clone());

        // Store vote
        self.votes
            .entry(vote.authority.clone())
            .or_insert_with(Vec::new)
            .push(vote);

        self.total_votes += 1;

        Ok(())
    }

    /// Get vote aggregation for a specific value
    pub fn get_aggregation(&self, value: &VoteValue) -> Option<&VoteAggregation> {
        self.vote_by_value.get(value)
    }

    /// Get all vote aggregations
    pub fn get_all_aggregations(&self) -> Vec<&VoteAggregation> {
        self.vote_by_value.values().collect()
    }

    /// Get leading vote value by weight
    pub fn get_leading_value(&self) -> Option<&VoteAggregation> {
        self.vote_by_value
            .values()
            .max_by_key(|agg| agg.total_weight)
    }

    /// Get votes from a specific authority
    pub fn get_authority_votes(&self, authority: &AuthorityId) -> Vec<&Vote> {
        self.votes
            .get(authority)
            .map(|votes| votes.iter().collect())
            .unwrap_or_default()
    }

    /// Get all authorities that voted
    pub fn get_voting_authorities(&self) -> HashSet<AuthorityId> {
        self.votes.keys().cloned().collect()
    }

    /// Get total vote weight
    pub fn get_total_weight(&self) -> u64 {
        self.vote_by_value
            .values()
            .map(|agg| agg.total_weight)
            .sum()
    }

    /// Get total number of votes
    pub fn get_vote_count(&self) -> usize {
        self.total_votes
    }

    /// Check if voting has timed out
    pub fn has_timed_out(&self) -> bool {
        self.start_time.elapsed() > self.config.vote_timeout
    }

    /// Get remaining time for voting
    pub fn remaining_time(&self) -> Duration {
        self.config
            .vote_timeout
            .saturating_sub(self.start_time.elapsed())
    }

    /// Detect potential Byzantine authorities
    pub fn detect_byzantine_authorities(&self) -> Vec<AuthorityId> {
        let mut byzantine = Vec::new();

        for (authority, votes) in &self.votes {
            // Check for multiple different votes
            if votes.len() > 1 {
                let unique_values: HashSet<_> = votes.iter().map(|v| &v.value).collect();
                if unique_values.len() > 1 {
                    byzantine.push(authority.clone());
                }
            }
        }

        byzantine
    }

    /// Get vote statistics
    pub fn get_statistics(&self) -> VoteStatistics {
        let unique_values = self.vote_by_value.len();
        let participating_authorities = self.votes.len();
        let leading = self.get_leading_value();

        VoteStatistics {
            round_id: self.round_id,
            total_votes: self.total_votes,
            unique_values,
            participating_authorities,
            total_weight: self.get_total_weight(),
            leading_value_weight: leading.map(|agg| agg.total_weight),
            elapsed_time: self.start_time.elapsed(),
            timed_out: self.has_timed_out(),
        }
    }
}

/// Vote statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteStatistics {
    pub round_id: RoundId,
    pub total_votes: usize,
    pub unique_values: usize,
    pub participating_authorities: usize,
    pub total_weight: u64,
    pub leading_value_weight: Option<u64>,
    pub elapsed_time: Duration,
    pub timed_out: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_vote(
        round: u64,
        authority: &str,
        value: &str,
        weight: u64,
    ) -> Vote {
        Vote::new(
            RoundId(round),
            AuthorityId::from(authority),
            VoteValue::from_string(value),
            weight,
        )
        .with_signature(vec![1, 2, 3]) // Dummy signature
    }

    #[test]
    fn test_add_vote() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        let vote = create_vote(1, "auth-1", "value-a", 100);
        assert!(collector.add_vote(vote).is_ok());
        assert_eq!(collector.get_vote_count(), 1);
    }

    #[test]
    fn test_wrong_round() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        let vote = create_vote(2, "auth-1", "value-a", 100);
        let result = collector.add_vote(vote);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::InvalidVote { .. }));
    }

    #[test]
    fn test_duplicate_vote_not_allowed() {
        let config = VotingConfig {
            allow_duplicate_votes: false,
            ..Default::default()
        };
        let mut collector = VoteCollector::new(RoundId(1), config);

        let vote1 = create_vote(1, "auth-1", "value-a", 100);
        let vote2 = create_vote(1, "auth-1", "value-a", 100);

        assert!(collector.add_vote(vote1).is_ok());
        let result = collector.add_vote(vote2);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::DuplicateVote { .. }));
    }

    #[test]
    fn test_byzantine_detection() {
        let config = VotingConfig {
            allow_duplicate_votes: true,
            max_votes_per_authority: 2,
            ..Default::default()
        };
        let mut collector = VoteCollector::new(RoundId(1), config);

        let vote1 = create_vote(1, "auth-1", "value-a", 100);
        let vote2 = create_vote(1, "auth-1", "value-b", 100);

        assert!(collector.add_vote(vote1).is_ok());
        let result = collector.add_vote(vote2);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), Error::ByzantineFault { .. }));
    }

    #[test]
    fn test_vote_aggregation() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        collector.add_vote(create_vote(1, "auth-1", "value-a", 100)).unwrap();
        collector.add_vote(create_vote(1, "auth-2", "value-a", 150)).unwrap();
        collector.add_vote(create_vote(1, "auth-3", "value-b", 200)).unwrap();

        let agg_a = collector
            .get_aggregation(&VoteValue::from_string("value-a"))
            .unwrap();
        assert_eq!(agg_a.total_weight, 250);
        assert_eq!(agg_a.vote_count, 2);

        let agg_b = collector
            .get_aggregation(&VoteValue::from_string("value-b"))
            .unwrap();
        assert_eq!(agg_b.total_weight, 200);
        assert_eq!(agg_b.vote_count, 1);
    }

    #[test]
    fn test_leading_value() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        collector.add_vote(create_vote(1, "auth-1", "value-a", 100)).unwrap();
        collector.add_vote(create_vote(1, "auth-2", "value-b", 200)).unwrap();
        collector.add_vote(create_vote(1, "auth-3", "value-b", 150)).unwrap();

        let leading = collector.get_leading_value().unwrap();
        assert_eq!(leading.value, VoteValue::from_string("value-b"));
        assert_eq!(leading.total_weight, 350);
    }

    #[test]
    fn test_voting_authorities() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        collector.add_vote(create_vote(1, "auth-1", "value-a", 100)).unwrap();
        collector.add_vote(create_vote(1, "auth-2", "value-a", 100)).unwrap();

        let authorities = collector.get_voting_authorities();
        assert_eq!(authorities.len(), 2);
        assert!(authorities.contains(&AuthorityId::from("auth-1")));
        assert!(authorities.contains(&AuthorityId::from("auth-2")));
    }

    #[test]
    fn test_statistics() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        collector.add_vote(create_vote(1, "auth-1", "value-a", 100)).unwrap();
        collector.add_vote(create_vote(1, "auth-2", "value-b", 200)).unwrap();

        let stats = collector.get_statistics();
        assert_eq!(stats.round_id, RoundId(1));
        assert_eq!(stats.total_votes, 2);
        assert_eq!(stats.unique_values, 2);
        assert_eq!(stats.participating_authorities, 2);
        assert_eq!(stats.total_weight, 300);
        assert_eq!(stats.leading_value_weight, Some(200));
    }

    #[test]
    fn test_missing_signature() {
        let config = VotingConfig {
            require_signatures: true,
            ..Default::default()
        };
        let mut collector = VoteCollector::new(RoundId(1), config);

        let vote = Vote::new(
            RoundId(1),
            AuthorityId::from("auth-1"),
            VoteValue::from_string("value-a"),
            100,
        );

        let result = collector.add_vote(vote);
        assert!(result.is_err());
    }

    #[test]
    fn test_get_authority_votes() {
        let config = VotingConfig::default();
        let mut collector = VoteCollector::new(RoundId(1), config);

        let vote = create_vote(1, "auth-1", "value-a", 100);
        collector.add_vote(vote).unwrap();

        let votes = collector.get_authority_votes(&AuthorityId::from("auth-1"));
        assert_eq!(votes.len(), 1);
        assert_eq!(votes[0].weight, 100);
    }
}
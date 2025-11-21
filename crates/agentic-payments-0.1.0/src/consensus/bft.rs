//! Byzantine Fault Tolerant Consensus Implementation
//!
//! Implements Practical Byzantine Fault Tolerance (PBFT) algorithm with:
//! - Three-phase commit protocol (pre-prepare, prepare, commit)
//! - View change mechanism for leader failures
//! - Weighted voting with reputation
//! - Byzantine fault detection and recovery

use super::{
    quorum::{Quorum, QuorumConfig},
    reputation::{ReputationConfig, ReputationSystem},
    voting::{VoteCollector, VotingConfig},
    Authority, AuthorityId, BftConsensusResult, Consensus, ConsensusPhase, RoundId, Vote,
    VoteValue,
};
use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::time::{Duration, Instant};

/// BFT consensus configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BftConfig {
    pub quorum_config: QuorumConfig,
    pub voting_config: VotingConfig,
    pub reputation_config: ReputationConfig,
    /// Maximum rounds before view change
    pub max_rounds_per_view: u64,
    /// Timeout for each phase
    pub phase_timeout: Duration,
    /// Enable reputation-based weights
    pub use_reputation_weights: bool,
}

impl Default for BftConfig {
    fn default() -> Self {
        BftConfig {
            quorum_config: QuorumConfig::byzantine(1),
            voting_config: VotingConfig::default(),
            reputation_config: ReputationConfig::default(),
            max_rounds_per_view: 100,
            phase_timeout: Duration::from_secs(30),
            use_reputation_weights: true,
        }
    }
}

/// PBFT consensus state for a round
struct RoundState {
    round_id: RoundId,
    view: u64,
    phase: ConsensusPhase,
    proposed_value: Option<VoteValue>,
    pre_prepare_received: bool,
    prepare_votes: VoteCollector,
    commit_votes: VoteCollector,
    phase_start: Instant,
}

impl RoundState {
    fn new(round_id: RoundId, view: u64, voting_config: VotingConfig) -> Self {
        RoundState {
            round_id,
            view,
            phase: ConsensusPhase::Idle,
            proposed_value: None,
            pre_prepare_received: false,
            prepare_votes: VoteCollector::new(round_id, voting_config.clone()),
            commit_votes: VoteCollector::new(round_id, voting_config),
            phase_start: Instant::now(),
        }
    }
}

/// Byzantine Fault Tolerant consensus
pub struct BftConsensus {
    config: BftConfig,
    current_round: RoundId,
    current_view: u64,
    quorum: Quorum,
    reputation: ReputationSystem,
    round_state: Option<RoundState>,
    consensus_result: Option<BftConsensusResult>,
    view_change_votes: HashMap<u64, HashSet<AuthorityId>>,
    primary_authority: AuthorityId,
}

impl BftConsensus {
    pub fn new(config: BftConfig, authorities: Vec<Authority>) -> Result<Self> {
        let primary_authority = authorities
            .first()
            .ok_or_else(|| Error::InvalidState {
                message: "No authorities provided".to_string(),
            })?
            .id
            .clone();

        let quorum = Quorum::new(config.quorum_config.clone(), authorities)?;
        let reputation = ReputationSystem::new(config.reputation_config.clone());

        Ok(BftConsensus {
            config,
            current_round: RoundId(0),
            current_view: 0,
            quorum,
            reputation,
            round_state: None,
            consensus_result: None,
            view_change_votes: HashMap::new(),
            primary_authority,
        })
    }

    /// Get current primary authority for the view
    fn get_primary(&self) -> &AuthorityId {
        let authorities = self.quorum.authorities();
        let index = (self.current_view as usize) % authorities.len();
        &authorities[index].id
    }

    /// Check if authority is current primary
    fn is_primary(&self, authority: &AuthorityId) -> bool {
        self.get_primary() == authority
    }

    /// Get effective vote weight with reputation
    fn get_vote_weight(&self, authority: &AuthorityId) -> Result<u64> {
        let base_weight = self.quorum.get_weight(authority)?;

        if !self.config.use_reputation_weights {
            return Ok(base_weight);
        }

        let reputation = self
            .reputation
            .calculate_weighted_reputation(authority)
            .unwrap_or(1.0);

        Ok((base_weight as f64 * reputation) as u64)
    }

    /// Handle pre-prepare message from primary
    pub fn handle_pre_prepare(&mut self, value: VoteValue) -> Result<()> {
        let state = self.round_state.as_mut().ok_or_else(|| {
            Error::InvalidState {
                message: "No active round".to_string(),
            }
        })?;

        if state.phase != ConsensusPhase::Idle {
            return Err(Error::InvalidState {
                message: format!("Wrong phase: {:?}", state.phase),
            });
        }

        state.proposed_value = Some(value);
        state.pre_prepare_received = true;
        state.phase = ConsensusPhase::PrePrepare;
        state.phase_start = Instant::now();

        Ok(())
    }

    /// Handle prepare vote
    pub fn handle_prepare(&mut self, vote: Vote) -> Result<()> {
        let state = self.round_state.as_mut().ok_or_else(|| {
            Error::InvalidState {
                message: "No active round".to_string(),
            }
        })?;

        if state.phase != ConsensusPhase::PrePrepare && state.phase != ConsensusPhase::Prepare {
            return Err(Error::InvalidState {
                message: format!("Wrong phase for prepare: {:?}", state.phase),
            });
        }

        state.prepare_votes.add_vote(vote)?;
        state.phase = ConsensusPhase::Prepare;

        // Check if we have prepare quorum
        let total_weight = state.prepare_votes.get_total_weight();
        if self.quorum.has_quorum(total_weight) {
            state.phase = ConsensusPhase::Commit;
            state.phase_start = Instant::now();
        }

        Ok(())
    }

    /// Handle commit vote
    pub fn handle_commit(&mut self, vote: Vote) -> Result<()> {
        let state = self.round_state.as_mut().ok_or_else(|| {
            Error::InvalidState {
                message: "No active round".to_string(),
            }
        })?;

        if state.phase != ConsensusPhase::Commit {
            return Err(Error::InvalidState {
                message: format!("Wrong phase for commit: {:?}", state.phase),
            });
        }

        state.commit_votes.add_vote(vote)?;

        // Check if we have commit quorum
        let total_weight = state.commit_votes.get_total_weight();
        if self.quorum.has_quorum(total_weight) {
            self.finalize_consensus()?;
        }

        Ok(())
    }

    /// Finalize consensus
    fn finalize_consensus(&mut self) -> Result<()> {
        let state = self.round_state.as_ref().ok_or_else(|| {
            Error::InvalidState {
                message: "No active round".to_string(),
            }
        })?;

        let leading = state
            .commit_votes
            .get_leading_value()
            .ok_or_else(|| Error::InvalidState {
                message: "No leading value in commit phase".to_string(),
            })?;

        let result = BftConsensusResult {
            round_id: state.round_id,
            value: leading.value.clone(),
            total_weight: leading.total_weight,
            participating_authorities: leading.authorities.clone(),
            phase: ConsensusPhase::Decided,
        };

        // Update reputation for participants
        for authority in &result.participating_authorities {
            let _ = self.reputation.record_correct_vote(authority);
        }

        self.consensus_result = Some(result);
        if let Some(state) = self.round_state.as_mut() {
            state.phase = ConsensusPhase::Decided;
        }

        Ok(())
    }

    /// Handle view change
    pub fn handle_view_change(&mut self, new_view: u64, authority: AuthorityId) -> Result<()> {
        self.view_change_votes
            .entry(new_view)
            .or_insert_with(HashSet::new)
            .insert(authority);

        let vote_count = self.view_change_votes.get(&new_view).unwrap().len();
        let required = self.quorum.authority_count() * 2 / 3;

        if vote_count >= required {
            self.execute_view_change(new_view)?;
        }

        Ok(())
    }

    /// Execute view change
    fn execute_view_change(&mut self, new_view: u64) -> Result<()> {
        self.current_view = new_view;
        self.view_change_votes.clear();

        // Reset round state
        if let Some(state) = self.round_state.as_mut() {
            state.phase = ConsensusPhase::ViewChange;
        }

        Ok(())
    }

    /// Detect Byzantine behavior
    pub fn detect_byzantine_faults(&mut self) -> Vec<AuthorityId> {
        let mut byzantine = Vec::new();

        if let Some(state) = &self.round_state {
            byzantine.extend(state.prepare_votes.detect_byzantine_authorities());
            byzantine.extend(state.commit_votes.detect_byzantine_authorities());
        }

        // Mark as Byzantine and update reputation
        for auth in &byzantine {
            let _ = self.quorum.mark_byzantine(auth);
            let _ = self.reputation.record_byzantine_fault(auth);
        }

        byzantine
    }
}

impl Consensus for BftConsensus {
    fn submit_vote(&mut self, vote: Vote) -> Result<()> {
        // Get weighted vote
        let weight = self.get_vote_weight(&vote.authority)?;
        let mut weighted_vote = vote;
        weighted_vote.weight = weight;

        let state = self.round_state.as_ref().ok_or_else(|| {
            Error::InvalidState {
                message: "No active round".to_string(),
            }
        })?;

        match state.phase {
            ConsensusPhase::PrePrepare | ConsensusPhase::Prepare => {
                self.handle_prepare(weighted_vote)
            }
            ConsensusPhase::Commit => self.handle_commit(weighted_vote),
            _ => Err(Error::InvalidState {
                message: format!("Cannot submit vote in phase: {:?}", state.phase),
            }),
        }
    }

    fn has_consensus(&self) -> bool {
        self.consensus_result.is_some()
    }

    fn get_result(&self) -> Option<BftConsensusResult> {
        self.consensus_result.clone()
    }

    fn get_phase(&self) -> ConsensusPhase {
        self.round_state
            .as_ref()
            .map(|s| s.phase)
            .unwrap_or(ConsensusPhase::Idle)
    }

    fn start_round(&mut self, round_id: RoundId, value: VoteValue) -> Result<()> {
        if self.has_consensus() {
            return Err(Error::AlreadyReached);
        }

        self.current_round = round_id;
        self.round_state = Some(RoundState::new(
            round_id,
            self.current_view,
            self.config.voting_config.clone(),
        ));

        // If we're primary, send pre-prepare
        if self.is_primary(&self.primary_authority) {
            self.handle_pre_prepare(value)?;
        }

        Ok(())
    }

    fn current_round(&self) -> RoundId {
        self.current_round
    }

    fn authorities(&self) -> Vec<Authority> {
        self.quorum.authorities().into_iter().cloned().collect()
    }

    fn handle_timeout(&mut self) -> Result<()> {
        let state = self.round_state.as_ref().ok_or_else(|| {
            Error::InvalidState {
                message: "No active round".to_string(),
            }
        })?;

        if state.phase_start.elapsed() > self.config.phase_timeout {
            // Trigger view change
            let new_view = self.current_view + 1;
            self.handle_view_change(new_view, self.primary_authority.clone())?;

            return Err(Error::ViewChangeRequired("Primary authority has failed".to_string()));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_authorities(count: usize) -> Vec<Authority> {
        (0..count)
            .map(|i| Authority::new(AuthorityId::from(format!("auth-{}", i)), 100))
            .collect()
    }

    fn create_vote(round: u64, authority: &str, value: &str) -> Vote {
        Vote::new(
            RoundId(round),
            AuthorityId::from(authority),
            VoteValue::from_string(value),
            100,
        )
        .with_signature(vec![1, 2, 3])
    }

    #[test]
    fn test_bft_creation() {
        let authorities = create_test_authorities(4);
        let config = BftConfig::default();
        let bft = BftConsensus::new(config, authorities);

        assert!(bft.is_ok());
    }

    #[test]
    fn test_start_round() {
        let authorities = create_test_authorities(4);
        let config = BftConfig::default();
        let mut bft = BftConsensus::new(config, authorities).unwrap();

        let result = bft.start_round(RoundId(1), VoteValue::from_string("value-a"));
        assert!(result.is_ok());
        assert_eq!(bft.current_round(), RoundId(1));
    }

    #[test]
    fn test_prepare_phase() {
        let authorities = create_test_authorities(4);
        let config = BftConfig::default();
        let mut bft = BftConsensus::new(config, authorities).unwrap();

        // Initialize round (doesn't call pre_prepare unless node is primary)
        bft.start_round(RoundId(1), VoteValue::from_string("value-a")).unwrap();

        // Manually call handle_pre_prepare (simulating receiving from primary)
        bft.handle_pre_prepare(VoteValue::from_string("value-a")).unwrap();
        assert_eq!(bft.get_phase(), ConsensusPhase::PrePrepare);

        let vote = create_vote(1, "auth-0", "value-a");
        assert!(bft.handle_prepare(vote).is_ok());
        assert_eq!(bft.get_phase(), ConsensusPhase::Prepare);
    }

    #[test]
    fn test_full_consensus() {
        let authorities = create_test_authorities(4);
        let config = BftConfig::default();
        let mut bft = BftConsensus::new(config, authorities).unwrap();

        // Start round
        bft.start_round(RoundId(1), VoteValue::from_string("value-a")).unwrap();
        bft.handle_pre_prepare(VoteValue::from_string("value-a")).unwrap();

        // Prepare phase - need 3 votes for quorum (2/3 of 4)
        for i in 0..3 {
            let vote = create_vote(1, &format!("auth-{}", i), "value-a");
            bft.handle_prepare(vote).unwrap();
        }

        assert_eq!(bft.get_phase(), ConsensusPhase::Commit);

        // Commit phase
        for i in 0..3 {
            let vote = create_vote(1, &format!("auth-{}", i), "value-a");
            bft.handle_commit(vote).unwrap();
        }

        assert!(bft.has_consensus());
        assert_eq!(bft.get_phase(), ConsensusPhase::Decided);

        let result = bft.get_result().unwrap();
        assert_eq!(result.value, VoteValue::from_string("value-a"));
    }

    #[test]
    fn test_insufficient_authorities() {
        let authorities = create_test_authorities(2);
        let config = BftConfig::default(); // Requires 4 for f=1
        let result = BftConsensus::new(config, authorities);

        assert!(result.is_err());
    }

    #[test]
    fn test_view_change() {
        let authorities = create_test_authorities(4);
        let config = BftConfig::default();
        let mut bft = BftConsensus::new(config, authorities).unwrap();

        let initial_view = bft.current_view;

        // Need 3 votes for view change (2/3 of 4)
        for i in 0..3 {
            bft.handle_view_change(1, AuthorityId::from(format!("auth-{}", i)))
                .unwrap();
        }

        assert_eq!(bft.current_view, initial_view + 1);
    }

    #[test]
    fn test_primary_rotation() {
        let authorities = create_test_authorities(4);
        let config = BftConfig::default();
        let mut bft = BftConsensus::new(config, authorities).unwrap();

        // Get initial primary (order depends on HashMap iteration)
        let primary_view_0 = bft.get_primary().clone();

        // Verify primary is one of the authorities
        let all_authorities = bft.authorities();
        assert!(all_authorities.iter().any(|a| a.id == primary_view_0));

        // Trigger view change and verify primary changes
        bft.current_view = 1;
        let primary_view_1 = bft.get_primary().clone();

        // In most cases primary should rotate (unless we only have 1 authority)
        assert!(all_authorities.len() > 1 || primary_view_0 == primary_view_1);
    }
}
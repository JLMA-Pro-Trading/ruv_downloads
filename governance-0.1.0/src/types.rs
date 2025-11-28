use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Role in the governance system
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Role {
    Admin,
    Guardian,
    Member,
    Observer,
}

impl Role {
    pub fn can_propose(&self) -> bool {
        matches!(self, Role::Admin | Role::Guardian | Role::Member)
    }

    pub fn can_vote(&self) -> bool {
        matches!(self, Role::Admin | Role::Guardian | Role::Member)
    }

    pub fn can_veto(&self) -> bool {
        matches!(self, Role::Admin | Role::Guardian)
    }

    pub fn can_execute(&self) -> bool {
        matches!(self, Role::Admin | Role::Guardian)
    }
}

impl fmt::Display for Role {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Role::Admin => write!(f, "Admin"),
            Role::Guardian => write!(f, "Guardian"),
            Role::Member => write!(f, "Member"),
            Role::Observer => write!(f, "Observer"),
        }
    }
}

/// Type of vote
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VoteType {
    For,
    Against,
    Abstain,
}

impl fmt::Display for VoteType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            VoteType::For => write!(f, "For"),
            VoteType::Against => write!(f, "Against"),
            VoteType::Abstain => write!(f, "Abstain"),
        }
    }
}

/// State of a proposal
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProposalState {
    Draft,
    Active,
    Passed,
    Rejected,
    Executed,
    Expired,
    Vetoed,
}

impl fmt::Display for ProposalState {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProposalState::Draft => write!(f, "Draft"),
            ProposalState::Active => write!(f, "Active"),
            ProposalState::Passed => write!(f, "Passed"),
            ProposalState::Rejected => write!(f, "Rejected"),
            ProposalState::Executed => write!(f, "Executed"),
            ProposalState::Expired => write!(f, "Expired"),
            ProposalState::Vetoed => write!(f, "Vetoed"),
        }
    }
}

/// Type of proposal
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ProposalType {
    ParameterChange {
        parameter: String,
        old_value: String,
        new_value: String,
    },
    StrategyApproval {
        strategy_id: String,
        strategy_name: String,
        risk_level: String,
    },
    RiskLimitAdjustment {
        limit_type: String,
        old_limit: Decimal,
        new_limit: Decimal,
    },
    EmergencyAction {
        action: String,
        reason: String,
    },
    TreasuryAllocation {
        recipient: String,
        amount: Decimal,
        purpose: String,
    },
    MemberManagement {
        action: MemberAction,
        member_id: String,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum MemberAction {
    Add { role: Role, voting_power: Decimal },
    Remove,
    UpdateRole { new_role: Role },
    UpdateVotingPower { new_power: Decimal },
}

/// Vote record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vote {
    pub voter_id: String,
    pub vote_type: VoteType,
    pub voting_power: Decimal,
    pub timestamp: DateTime<Utc>,
    pub reason: Option<String>,
}

/// Voting results summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VotingResults {
    pub votes_for: Decimal,
    pub votes_against: Decimal,
    pub votes_abstain: Decimal,
    pub total_votes: Decimal,
    pub total_voting_power: Decimal,
    pub participation_rate: Decimal,
    pub approval_rate: Decimal,
    pub quorum_reached: bool,
    pub passed: bool,
}

impl VotingResults {
    pub fn new() -> Self {
        Self {
            votes_for: Decimal::ZERO,
            votes_against: Decimal::ZERO,
            votes_abstain: Decimal::ZERO,
            total_votes: Decimal::ZERO,
            total_voting_power: Decimal::ZERO,
            participation_rate: Decimal::ZERO,
            approval_rate: Decimal::ZERO,
            quorum_reached: false,
            passed: false,
        }
    }

    pub fn calculate(&mut self, quorum_percentage: Decimal, passing_threshold: Decimal) {
        self.total_votes = self.votes_for + self.votes_against + self.votes_abstain;

        if self.total_voting_power > Decimal::ZERO {
            self.participation_rate = (self.total_votes / self.total_voting_power) * Decimal::from(100);
        }

        let active_votes = self.votes_for + self.votes_against;
        if active_votes > Decimal::ZERO {
            self.approval_rate = (self.votes_for / active_votes) * Decimal::from(100);
        }

        self.quorum_reached = self.participation_rate >= quorum_percentage;
        self.passed = self.quorum_reached && self.approval_rate >= passing_threshold;
    }
}

impl Default for VotingResults {
    fn default() -> Self {
        Self::new()
    }
}

/// Execution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionConfig {
    pub timelock_duration_seconds: i64,
    pub veto_period_seconds: i64,
    pub auto_execute: bool,
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        Self {
            timelock_duration_seconds: 86400, // 24 hours
            veto_period_seconds: 172800,      // 48 hours
            auto_execute: false,
        }
    }
}

/// Governance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceConfig {
    pub quorum_percentage: Decimal,
    pub passing_threshold: Decimal,
    pub voting_period_seconds: i64,
    pub execution_config: ExecutionConfig,
}

impl Default for GovernanceConfig {
    fn default() -> Self {
        Self {
            quorum_percentage: Decimal::from(50),  // 50% participation required
            passing_threshold: Decimal::from(66),   // 66% approval required
            voting_period_seconds: 604800,          // 7 days
            execution_config: ExecutionConfig::default(),
        }
    }
}

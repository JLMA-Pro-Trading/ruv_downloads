use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum GovernanceError {
    #[error("Proposal not found: {0}")]
    ProposalNotFound(String),

    #[error("Invalid proposal state: expected {expected}, got {actual}")]
    InvalidProposalState { expected: String, actual: String },

    #[error("Member not found: {0}")]
    MemberNotFound(String),

    #[error("Insufficient voting power: required {required}, have {available}")]
    InsufficientVotingPower { required: String, available: String },

    #[error("Member already voted on this proposal")]
    AlreadyVoted,

    #[error("Voting period ended")]
    VotingPeriodEnded,

    #[error("Voting period not ended")]
    VotingPeriodNotEnded,

    #[error("Quorum not reached: {current}% < {required}%")]
    QuorumNotReached { current: String, required: String },

    #[error("Proposal not passed: {approval}% < {threshold}%")]
    ProposalNotPassed { approval: String, threshold: String },

    #[error("Proposal already executed")]
    AlreadyExecuted,

    #[error("Timelock not expired: {remaining} seconds remaining")]
    TimelockNotExpired { remaining: i64 },

    #[error("Insufficient permissions: required {required}, have {actual}")]
    InsufficientPermissions { required: String, actual: String },

    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),

    #[error("Execution failed: {0}")]
    ExecutionFailed(String),

    #[error("Treasury operation failed: {0}")]
    TreasuryOperationFailed(String),

    #[error("Veto period expired")]
    VetoPeriodExpired,

    #[error("Member already exists: {0}")]
    MemberAlreadyExists(String),

    #[error("Invalid voting weight: {0}")]
    InvalidVotingWeight(String),
}

pub type Result<T> = std::result::Result<T, GovernanceError>;

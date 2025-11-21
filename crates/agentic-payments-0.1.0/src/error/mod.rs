//! Error types for the agentic-payments system
//!
//! This module provides comprehensive error handling with:
//! - Cryptographic operation errors
//! - Consensus and BFT voting errors
//! - Agent lifecycle and communication errors
//! - Trust chain and validation errors
//! - System configuration and initialization errors
//!
//! All errors include context information and support backtrace capture
//! when the `RUST_BACKTRACE` environment variable is set.

use std::fmt;
use std::io;
use std::time::Duration;

use thiserror::Error;

/// Result type alias for agentic-payments operations
pub type Result<T> = std::result::Result<T, Error>;

/// Top-level error type for all agentic-payments operations
#[derive(Debug, Error)]
pub enum Error {
    /// Cryptographic operation errors
    #[error("Cryptographic error: {0}")]
    Crypto(#[from] CryptoError),

    /// Consensus and voting errors
    #[error("Consensus error: {0}")]
    Consensus(#[from] ConsensusError),

    /// Agent lifecycle and communication errors
    #[error("Agent error: {0}")]
    Agent(#[from] AgentError),

    /// Validation and trust chain errors
    #[error("Validation error: {0}")]
    Validation(#[from] ValidationError),

    /// System configuration and initialization errors
    #[error("System error: {0}")]
    System(#[from] SystemError),

    /// Network and communication errors
    #[error("Network error: {0}")]
    Network(#[from] NetworkError),

    /// I/O operation errors
    #[error("I/O error: {0}")]
    Io(#[from] io::Error),

    /// Serialization/deserialization errors
    #[error("Serialization error: {0}")]
    Serialization(#[from] SerializationError),

    /// Timeout errors
    #[error("Operation timed out after {duration:?}: {operation}")]
    Timeout {
        /// The operation that timed out
        operation: String,
        /// The timeout duration
        duration: Duration,
    },

    /// Generic error with context
    #[error("{message}")]
    Other {
        /// Error message
        message: String,
        /// Optional source error
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Key not found error
    #[error("Key not found: {0}")]
    KeyNotFound(String),

    /// Configuration error
    #[error("Configuration error: {0}")]
    Configuration(String),

    /// Task join error
    #[error("Task join error: {0}")]
    TaskJoin(String),

    /// Pool exhausted error
    #[error("Agent pool exhausted")]
    PoolExhausted,

    /// Config error (alias for Configuration)
    #[error("Config error: {0}")]
    Config(String),

    /// DID error
    #[error("DID error: {0}")]
    Did(String),

    /// Invalid state error
    #[error("Invalid state: {message}")]
    InvalidState {
        /// Error message
        message: String,
    },

    /// Authority not found
    #[error("Authority not found: {authority}")]
    AuthorityNotFound {
        /// Authority ID
        authority: String,
    },

    /// Invalid vote
    #[error("Invalid vote from {authority}: {reason}")]
    InvalidVote {
        /// Authority that cast invalid vote
        authority: String,
        /// Reason vote is invalid
        reason: String,
    },

    /// Duplicate vote
    #[error("Duplicate vote from {authority}")]
    DuplicateVote {
        /// Authority that cast duplicate vote
        authority: String,
    },

    /// Byzantine fault
    #[error("Byzantine fault: {message}")]
    ByzantineFault {
        /// Fault description
        message: String,
    },

    /// View change required
    #[error("View change required: {0}")]
    ViewChangeRequired(String),

    /// Consensus already reached
    #[error("Consensus already reached")]
    AlreadyReached,
}

/// Cryptographic operation errors
#[derive(Debug, Error)]
pub enum CryptoError {
    /// Ed25519 signature verification failed
    #[error("Signature verification failed: {reason}")]
    SignatureVerificationFailed {
        /// Reason for verification failure
        reason: String,
        /// Optional public key context
        public_key: Option<String>,
    },

    /// Invalid signature format
    #[error("Invalid signature format: {details}")]
    InvalidSignature {
        /// Details about the invalid signature
        details: String,
    },

    /// Invalid public key format
    #[error("Invalid public key: {details}")]
    InvalidPublicKey {
        /// Details about the invalid key
        details: String,
    },

    /// Invalid private key format
    #[error("Invalid private key: {details}")]
    InvalidPrivateKey {
        /// Details about the invalid key
        details: String,
    },

    /// Key generation failed
    #[error("Key generation failed: {reason}")]
    KeyGenerationFailed {
        /// Reason for generation failure
        reason: String,
    },

    /// Key derivation failed
    #[error("Key derivation failed: {reason}")]
    KeyDerivationFailed {
        /// Reason for derivation failure
        reason: String,
    },

    /// PKCS#8 encoding/decoding error
    #[error("PKCS#8 error: {details}")]
    Pkcs8Error {
        /// Error details
        details: String,
    },

    /// Hash computation failed
    #[error("Hash computation failed: {algorithm}")]
    HashError {
        /// Hash algorithm that failed
        algorithm: String,
    },

    /// Random number generation failed
    #[error("Random number generation failed: {reason}")]
    RandomGenerationFailed {
        /// Reason for RNG failure
        reason: String,
    },

    /// Cryptographic batch operation failed
    #[error("Batch verification failed: {passed}/{total} signatures valid")]
    BatchVerificationFailed {
        /// Number of signatures that passed
        passed: usize,
        /// Total number of signatures
        total: usize,
    },

    /// HSM (Hardware Security Module) operation failed
    #[error("HSM operation failed: {operation}")]
    HsmError {
        /// HSM operation that failed
        operation: String,
    },
}

/// Consensus and Byzantine Fault Tolerance errors
#[derive(Debug, Error)]
pub enum ConsensusError {
    /// Insufficient votes to reach consensus
    #[error("Consensus not reached: {votes_for}/{total_votes} votes (required {required})")]
    ConsensusNotReached {
        /// Votes in favor
        votes_for: usize,
        /// Total votes cast
        total_votes: usize,
        /// Required votes for consensus
        required: usize,
    },

    /// Quorum not achieved
    #[error("Quorum not achieved: {available}/{required} agents available")]
    QuorumNotAchieved {
        /// Number of available agents
        available: usize,
        /// Required number of agents
        required: usize,
    },

    /// BFT voting round failed
    #[error("BFT voting round {round} failed: {reason}")]
    VotingRoundFailed {
        /// Voting round number
        round: u64,
        /// Failure reason
        reason: String,
    },

    /// Byzantine agent detected
    #[error("Byzantine agent detected: {agent_id} - {behavior}")]
    ByzantineAgentDetected {
        /// ID of the Byzantine agent
        agent_id: String,
        /// Detected malicious behavior
        behavior: String,
    },

    /// Vote validation failed
    #[error("Invalid vote from agent {agent_id}: {reason}")]
    InvalidVote {
        /// Agent that cast the invalid vote
        agent_id: String,
        /// Reason the vote is invalid
        reason: String,
    },

    /// Consensus timeout exceeded
    #[error("Consensus timeout after {duration:?} with {votes_cast}/{total_agents} votes")]
    ConsensusTimeout {
        /// Time elapsed before timeout
        duration: Duration,
        /// Votes cast before timeout
        votes_cast: usize,
        /// Total number of agents
        total_agents: usize,
    },

    /// Pool size too small for BFT
    #[error("Pool size {size} too small for BFT (minimum {minimum} required)")]
    InsufficientPoolSize {
        /// Current pool size
        size: usize,
        /// Minimum required size
        minimum: usize,
    },

    /// Multiple conflicting consensus results
    #[error("Conflicting consensus results: {count} different outcomes")]
    ConflictingResults {
        /// Number of different outcomes
        count: usize,
    },

    /// Invalid consensus state
    #[error("Invalid consensus state: {0}")]
    InvalidState(String),

    /// Authority not found in consensus group
    #[error("Authority not found: {0}")]
    AuthorityNotFound(String),

    /// Duplicate vote from same authority
    #[error("Duplicate vote from authority: {0}")]
    DuplicateVote(String),

    /// Byzantine fault detected in consensus
    #[error("Byzantine fault detected: {0}")]
    ByzantineFault(String),

    /// View change required for consensus
    #[error("View change required: {0}")]
    ViewChangeRequired(String),

    /// Consensus already reached
    #[error("Consensus already reached")]
    AlreadyReached,
}

/// Agent lifecycle and communication errors
#[derive(Debug, Error)]
pub enum AgentError {
    /// Agent spawning failed
    #[error("Failed to spawn agent {agent_type}: {reason}")]
    SpawnFailed {
        /// Type of agent that failed to spawn
        agent_type: String,
        /// Reason for spawn failure
        reason: String,
    },

    /// Agent not found
    #[error("Agent not found: {agent_id}")]
    AgentNotFound {
        /// ID of the missing agent
        agent_id: String,
    },

    /// Agent communication timeout
    #[error("Agent {agent_id} communication timeout after {duration:?}")]
    CommunicationTimeout {
        /// ID of the unresponsive agent
        agent_id: String,
        /// Timeout duration
        duration: Duration,
    },

    /// Agent crashed or terminated unexpectedly
    #[error("Agent {agent_id} crashed: {reason}")]
    AgentCrashed {
        /// ID of the crashed agent
        agent_id: String,
        /// Crash reason
        reason: String,
    },

    /// Agent recovery failed
    #[error("Failed to recover agent {agent_id}: {reason}")]
    RecoveryFailed {
        /// ID of the agent that couldn't be recovered
        agent_id: String,
        /// Recovery failure reason
        reason: String,
    },

    /// Agent pool exhausted
    #[error("Agent pool exhausted: {active}/{maximum} agents, cannot spawn more")]
    PoolExhausted {
        /// Number of active agents
        active: usize,
        /// Maximum pool size
        maximum: usize,
    },

    /// Invalid agent state transition
    #[error("Invalid state transition for agent {agent_id}: {from} -> {to}")]
    InvalidStateTransition {
        /// Agent ID
        agent_id: String,
        /// Current state
        from: String,
        /// Attempted new state
        to: String,
    },

    /// Agent task execution failed
    #[error("Agent {agent_id} task execution failed: {task}")]
    TaskExecutionFailed {
        /// Agent ID
        agent_id: String,
        /// Task description
        task: String,
        /// Optional error details
        details: Option<String>,
    },

    /// Inter-agent communication error
    #[error("Communication error between {from_agent} and {to_agent}: {reason}")]
    InterAgentCommunicationFailed {
        /// Source agent
        from_agent: String,
        /// Destination agent
        to_agent: String,
        /// Failure reason
        reason: String,
    },

    /// Agent pool error
    #[error("Agent pool error: {reason}")]
    AgentPoolError {
        /// Error reason
        reason: String,
    },

    /// Health check failed
    #[error("Health check failed: {reason}")]
    HealthCheckFailed {
        /// Failure reason
        reason: String,
    },
}

/// Validation and trust chain errors
#[derive(Debug, Error)]
pub enum ValidationError {
    /// Trust chain validation failed
    #[error("Trust chain validation failed: {reason}")]
    TrustChainInvalid {
        /// Reason for validation failure
        reason: String,
        /// Chain depth at failure
        depth: Option<usize>,
    },

    /// Certificate not found in chain
    #[error("Certificate not found: {cert_id}")]
    CertificateNotFound {
        /// Certificate identifier
        cert_id: String,
    },

    /// Certificate expired
    #[error("Certificate expired: {cert_id} (expired at {expired_at})")]
    CertificateExpired {
        /// Certificate identifier
        cert_id: String,
        /// Expiration timestamp
        expired_at: String,
    },

    /// Certificate revoked
    #[error("Certificate revoked: {cert_id} (reason: {reason})")]
    CertificateRevoked {
        /// Certificate identifier
        cert_id: String,
        /// Revocation reason
        reason: String,
    },

    /// Certificate issuer not trusted
    #[error("Untrusted certificate issuer: {issuer}")]
    UntrustedIssuer {
        /// Issuer identifier
        issuer: String,
    },

    /// Certificate chain too long
    #[error("Certificate chain too long: {length} (maximum {maximum})")]
    ChainTooLong {
        /// Actual chain length
        length: usize,
        /// Maximum allowed length
        maximum: usize,
    },

    /// Invalid certificate format
    #[error("Invalid certificate format: {details}")]
    InvalidCertificateFormat {
        /// Format error details
        details: String,
    },

    /// Verifiable Credential validation failed
    #[error("Verifiable Credential validation failed: {reason}")]
    CredentialValidationFailed {
        /// Validation failure reason
        reason: String,
    },

    /// DID (Decentralized Identifier) resolution failed
    #[error("DID resolution failed: {did}")]
    DidResolutionFailed {
        /// DID that failed to resolve
        did: String,
    },

    /// Mandate validation failed
    #[error("Mandate validation failed: {reason}")]
    MandateValidationFailed {
        /// Validation failure reason
        reason: String,
    },

    /// Invalid proof format
    #[error("Invalid proof: {details}")]
    InvalidProof {
        /// Proof validation error details
        details: String,
    },
}

/// System configuration and initialization errors
#[derive(Debug, Error)]
pub enum SystemError {
    /// System initialization failed
    #[error("System initialization failed: {reason}")]
    InitializationFailed {
        /// Initialization failure reason
        reason: String,
    },

    /// Invalid configuration
    #[error("Invalid configuration: {parameter} = {value}")]
    InvalidConfiguration {
        /// Configuration parameter name
        parameter: String,
        /// Invalid value
        value: String,
        /// Optional expected value description
        expected: Option<String>,
    },

    /// Resource allocation failed
    #[error("Resource allocation failed: {resource}")]
    ResourceAllocationFailed {
        /// Resource type
        resource: String,
        /// Optional details
        details: Option<String>,
    },

    /// System not initialized
    #[error("System not initialized: {component}")]
    NotInitialized {
        /// Component that requires initialization
        component: String,
    },

    /// System already initialized
    #[error("System already initialized: {component}")]
    AlreadyInitialized {
        /// Component that's already initialized
        component: String,
    },

    /// Graceful shutdown failed
    #[error("Shutdown failed: {reason}")]
    ShutdownFailed {
        /// Shutdown failure reason
        reason: String,
    },

    /// Database connection error
    #[error("Database error: {operation}")]
    DatabaseError {
        /// Database operation that failed
        operation: String,
        /// Optional error details
        details: Option<String>,
    },

    /// Metrics system error
    #[error("Metrics error: {reason}")]
    MetricsError {
        /// Metrics error reason
        reason: String,
    },

    /// Thread pool error
    #[error("Thread pool error: {reason}")]
    ThreadPoolError {
        /// Thread pool error reason
        reason: String,
    },
}

/// Network and communication errors
#[derive(Debug, Error)]
pub enum NetworkError {
    /// Connection failed
    #[error("Connection failed to {endpoint}: {reason}")]
    ConnectionFailed {
        /// Target endpoint
        endpoint: String,
        /// Connection failure reason
        reason: String,
    },

    /// Connection timeout
    #[error("Connection timeout to {endpoint} after {duration:?}")]
    ConnectionTimeout {
        /// Target endpoint
        endpoint: String,
        /// Timeout duration
        duration: Duration,
    },

    /// Network partition detected
    #[error("Network partition detected: {details}")]
    NetworkPartition {
        /// Partition details
        details: String,
    },

    /// Message send failed
    #[error("Failed to send message to {recipient}: {reason}")]
    SendFailed {
        /// Message recipient
        recipient: String,
        /// Send failure reason
        reason: String,
    },

    /// Message receive failed
    #[error("Failed to receive message from {sender}: {reason}")]
    ReceiveFailed {
        /// Message sender
        sender: String,
        /// Receive failure reason
        reason: String,
    },

    /// Protocol error
    #[error("Protocol error: {protocol} - {details}")]
    ProtocolError {
        /// Protocol name
        protocol: String,
        /// Error details
        details: String,
    },

    /// Peer disconnected
    #[error("Peer disconnected: {peer_id}")]
    PeerDisconnected {
        /// Disconnected peer ID
        peer_id: String,
    },

    /// Invalid network address
    #[error("Invalid network address: {address}")]
    InvalidAddress {
        /// Invalid address
        address: String,
    },
}

/// Serialization and deserialization errors
#[derive(Debug, Error)]
pub enum SerializationError {
    /// JSON serialization failed
    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    /// Base64 encoding/decoding failed
    #[error("Base64 error: {details}")]
    Base64 {
        /// Error details
        details: String,
    },

    /// Invalid data format
    #[error("Invalid data format: expected {expected}, got {actual}")]
    InvalidFormat {
        /// Expected format
        expected: String,
        /// Actual format
        actual: String,
    },

    /// Data corruption detected
    #[error("Data corruption detected: {details}")]
    DataCorruption {
        /// Corruption details
        details: String,
    },
}

// Conversion implementations for external error types

impl From<ed25519_dalek::SignatureError> for Error {
    fn from(err: ed25519_dalek::SignatureError) -> Self {
        Error::Crypto(CryptoError::SignatureVerificationFailed {
            reason: err.to_string(),
            public_key: None,
        })
    }
}

impl From<pkcs8::Error> for Error {
    fn from(err: pkcs8::Error) -> Self {
        Error::Crypto(CryptoError::Pkcs8Error {
            details: err.to_string(),
        })
    }
}

impl From<base64::DecodeError> for Error {
    fn from(err: base64::DecodeError) -> Self {
        Error::Serialization(SerializationError::Base64 {
            details: err.to_string(),
        })
    }
}

impl From<uuid::Error> for Error {
    fn from(err: uuid::Error) -> Self {
        Error::Serialization(SerializationError::InvalidFormat {
            expected: "valid UUID".to_string(),
            actual: err.to_string(),
        })
    }
}

// Helper methods for creating common errors

impl Error {
    /// Create a timeout error
    pub fn timeout(operation: impl Into<String>, duration: Duration) -> Self {
        Self::Timeout {
            operation: operation.into(),
            duration,
        }
    }

    /// Create a generic error with a message
    pub fn other(message: impl Into<String>) -> Self {
        Self::Other {
            message: message.into(),
            source: None,
        }
    }

    /// Create a generic error with a message and source
    pub fn with_source(
        message: impl Into<String>,
        source: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self::Other {
            message: message.into(),
            source: Some(Box::new(source)),
        }
    }

    /// Create an agent pool error
    pub fn agent_pool(message: impl Into<String>) -> Self {
        Self::Agent(AgentError::AgentPoolError {
            reason: message.into(),
        })
    }

    /// Create a configuration error
    pub fn config(message: impl Into<String>) -> Self {
        Self::Configuration(message.into())
    }

    /// Create a verification error
    pub fn verification(message: impl Into<String>) -> Self {
        Self::Crypto(CryptoError::SignatureVerificationFailed {
            reason: message.into(),
            public_key: None,
        })
    }

    /// Create a health check error
    pub fn health_check(message: impl Into<String>) -> Self {
        Self::Agent(AgentError::HealthCheckFailed {
            reason: message.into(),
        })
    }
}

impl CryptoError {
    /// Create a signature verification failure error
    pub fn signature_failed(reason: impl Into<String>) -> Self {
        Self::SignatureVerificationFailed {
            reason: reason.into(),
            public_key: None,
        }
    }

    /// Create a signature verification failure error with public key context
    pub fn signature_failed_with_key(reason: impl Into<String>, public_key: impl Into<String>) -> Self {
        Self::SignatureVerificationFailed {
            reason: reason.into(),
            public_key: Some(public_key.into()),
        }
    }
}

impl ConsensusError {
    /// Create a consensus not reached error
    pub fn not_reached(votes_for: usize, total_votes: usize, required: usize) -> Self {
        Self::ConsensusNotReached {
            votes_for,
            total_votes,
            required,
        }
    }

    /// Create a quorum not achieved error
    pub fn no_quorum(available: usize, required: usize) -> Self {
        Self::QuorumNotAchieved { available, required }
    }
}

impl AgentError {
    /// Create a spawn failed error
    pub fn spawn_failed(agent_type: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::SpawnFailed {
            agent_type: agent_type.into(),
            reason: reason.into(),
        }
    }

    /// Create an agent not found error
    pub fn not_found(agent_id: impl Into<String>) -> Self {
        Self::AgentNotFound {
            agent_id: agent_id.into(),
        }
    }
}

impl ValidationError {
    /// Create a trust chain invalid error
    pub fn trust_chain_invalid(reason: impl Into<String>) -> Self {
        Self::TrustChainInvalid {
            reason: reason.into(),
            depth: None,
        }
    }

    /// Create a certificate expired error
    pub fn certificate_expired(cert_id: impl Into<String>, expired_at: impl Into<String>) -> Self {
        Self::CertificateExpired {
            cert_id: cert_id.into(),
            expired_at: expired_at.into(),
        }
    }
}

impl SystemError {
    /// Create an initialization failed error
    pub fn init_failed(reason: impl Into<String>) -> Self {
        Self::InitializationFailed {
            reason: reason.into(),
        }
    }

    /// Create an invalid configuration error
    pub fn invalid_config(parameter: impl Into<String>, value: impl Into<String>) -> Self {
        Self::InvalidConfiguration {
            parameter: parameter.into(),
            value: value.into(),
            expected: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = Error::Crypto(CryptoError::SignatureVerificationFailed {
            reason: "invalid signature".to_string(),
            public_key: Some("abc123".to_string()),
        });
        assert!(err.to_string().contains("Cryptographic error"));
        assert!(err.to_string().contains("Signature verification failed"));
    }

    #[test]
    fn test_consensus_error_display() {
        let err = ConsensusError::not_reached(3, 5, 4);
        assert!(err.to_string().contains("3/5"));
        assert!(err.to_string().contains("required 4"));
    }

    #[test]
    fn test_error_helper_methods() {
        let err = Error::timeout("verification", Duration::from_secs(5));
        assert!(matches!(err, Error::Timeout { .. }));

        let err = Error::other("something went wrong");
        assert!(matches!(err, Error::Other { .. }));
    }

    #[test]
    fn test_crypto_error_helper() {
        let err = CryptoError::signature_failed("bad sig");
        assert!(matches!(err, CryptoError::SignatureVerificationFailed { .. }));
    }

    #[test]
    fn test_agent_error_helper() {
        let err = AgentError::spawn_failed("verifier", "out of memory");
        assert!(matches!(err, AgentError::SpawnFailed { .. }));
    }

    #[test]
    fn test_error_source_chain() {
        let io_err = io::Error::new(io::ErrorKind::NotFound, "file not found");
        let err: Error = io_err.into();
        assert!(matches!(err, Error::Io(_)));
    }

    #[test]
    fn test_serialization_error_from_json() {
        let json_str = "{invalid json}";
        let json_err = serde_json::from_str::<serde_json::Value>(json_str).unwrap_err();
        let ser_err: SerializationError = json_err.into();
        let err: Error = ser_err.into();
        assert!(matches!(err, Error::Serialization(SerializationError::Json(_))));
    }
}
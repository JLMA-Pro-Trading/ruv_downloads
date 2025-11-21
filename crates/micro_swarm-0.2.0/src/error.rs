//! Error types for the swarm system

use alloc::string::String;
use core::fmt;

/// Swarm error types
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SwarmError {
    /// Agent-related errors
    Agent(String),
    /// Task scheduling errors
    Scheduler(String),
    /// Memory management errors
    Memory(String),
    /// Communication channel errors
    Channel(String),
    /// Configuration errors
    Configuration(String),
    /// Resource exhaustion
    ResourceExhausted(String),
    /// Network/coordination errors
    Network(String),
    /// Timeout errors
    Timeout(String),
    /// Invalid state
    InvalidState(String),
    /// Not found errors
    NotFound(String),
}

impl fmt::Display for SwarmError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            SwarmError::Agent(msg) => write!(f, "Agent error: {}", msg),
            SwarmError::Scheduler(msg) => write!(f, "Scheduler error: {}", msg),
            SwarmError::Memory(msg) => write!(f, "Memory error: {}", msg),
            SwarmError::Channel(msg) => write!(f, "Channel error: {}", msg),
            SwarmError::Configuration(msg) => write!(f, "Configuration error: {}", msg),
            SwarmError::ResourceExhausted(msg) => write!(f, "Resource exhausted: {}", msg),
            SwarmError::Network(msg) => write!(f, "Network error: {}", msg),
            SwarmError::Timeout(msg) => write!(f, "Timeout: {}", msg),
            SwarmError::InvalidState(msg) => write!(f, "Invalid state: {}", msg),
            SwarmError::NotFound(msg) => write!(f, "Not found: {}", msg),
        }
    }
}

impl SwarmError {
    /// Create an agent error
    pub fn agent<S: Into<String>>(msg: S) -> Self {
        Self::Agent(msg.into())
    }
    
    /// Create a scheduler error
    pub fn scheduler<S: Into<String>>(msg: S) -> Self {
        Self::Scheduler(msg.into())
    }
    
    /// Create a memory error
    pub fn memory<S: Into<String>>(msg: S) -> Self {
        Self::Memory(msg.into())
    }
    
    /// Create a channel error
    pub fn channel<S: Into<String>>(msg: S) -> Self {
        Self::Channel(msg.into())
    }
    
    /// Create a configuration error
    pub fn config<S: Into<String>>(msg: S) -> Self {
        Self::Configuration(msg.into())
    }
    
    /// Create a resource exhausted error
    pub fn resource_exhausted<S: Into<String>>(msg: S) -> Self {
        Self::ResourceExhausted(msg.into())
    }
    
    /// Create a network error
    pub fn network<S: Into<String>>(msg: S) -> Self {
        Self::Network(msg.into())
    }
    
    /// Create a timeout error
    pub fn timeout<S: Into<String>>(msg: S) -> Self {
        Self::Timeout(msg.into())
    }
    
    /// Create an invalid state error
    pub fn invalid_state<S: Into<String>>(msg: S) -> Self {
        Self::InvalidState(msg.into())
    }
    
    /// Create a not found error
    pub fn not_found<S: Into<String>>(msg: S) -> Self {
        Self::NotFound(msg.into())
    }
}
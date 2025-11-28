//! Micro Swarm - Real distributed orchestration and coordination
//! 
//! This crate provides a complete swarm orchestration system with:
//! - Agent lifecycle management and spawning
//! - Task scheduling with priority queues
//! - Memory pooling and resource management
//! - Inter-agent communication channels
//! - Fault detection and recovery
//! - Real-time monitoring and metrics

#![no_std]
#![forbid(unsafe_code)]
#![warn(missing_docs)]

extern crate alloc;
use alloc::{
    vec::Vec,
    collections::{BTreeMap, VecDeque},
    boxed::Box,
    string::String,
};
use core::{
    time::Duration,
    fmt,
};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Version information
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

// Core types and traits
mod types;
mod error;
mod agent;
mod task;
mod memory;
mod channel;

// Main components
mod orchestrator;
mod scheduler;
mod coordinator;

// Re-exports
pub use types::*;
pub use error::*;
pub use agent::*;
pub use task::*;
pub use memory::*;
pub use channel::*;
pub use orchestrator::*;
pub use scheduler::*;
pub use coordinator::*;

/// Swarm result type
pub type Result<T> = core::result::Result<T, SwarmError>;

// Type aliases for compatibility
pub use coordinator::SwarmCoordinator as Coordinator;
pub use scheduler::TaskScheduler as Scheduler;
pub use memory::MemoryManager as MemoryPool;
pub use channel::CommunicationHub as ChannelManager;

// Additional exports needed by orchestrator
pub use memory::MemoryManager as SwarmMemoryPool;
pub use channel::CommunicationHub as SwarmChannelManager;
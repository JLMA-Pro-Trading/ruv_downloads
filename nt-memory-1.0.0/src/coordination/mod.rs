//! Cross-agent coordination systems
//!
//! Implements:
//! - Pub/sub messaging for agent communication
//! - Distributed locks for critical sections
//! - Consensus protocols (Raft-inspired)
//! - Namespace management for multi-agent systems

pub mod pubsub;
pub mod locks;
pub mod consensus;
pub mod namespace;

pub use pubsub::{PubSubBroker, Message, Subscription};
pub use locks::{DistributedLock, LockToken};
pub use consensus::{ConsensusEngine, Proposal, Vote};
pub use namespace::Namespace;

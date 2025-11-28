//! Core types and identifiers for the swarm system

use alloc::{string::String, vec::Vec};
use core::{fmt, hash::{Hash, Hasher}};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

/// Unique identifier for agents in the swarm
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct AgentId(pub u64);

impl AgentId {
    /// Create a new agent ID
    pub fn new() -> Self {
        // Simple counter-based ID generation for no_std
        static mut COUNTER: u64 = 0;
        unsafe {
            COUNTER += 1;
            Self(COUNTER)
        }
    }
    
    /// Get the raw ID value
    pub fn raw(&self) -> u64 {
        self.0
    }
}

impl fmt::Display for AgentId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "agent-{}", self.0)
    }
}

impl From<u64> for AgentId {
    fn from(id: u64) -> Self {
        Self(id)
    }
}

/// Unique identifier for tasks
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TaskId(pub u64);

impl TaskId {
    /// Create a new task ID
    pub fn new() -> Self {
        static mut COUNTER: u64 = 0;
        unsafe {
            COUNTER += 1;
            Self(COUNTER)
        }
    }
    
    /// Get the raw ID value
    pub fn raw(&self) -> u64 {
        self.0
    }
}

impl fmt::Display for TaskId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "task-{}", self.0)
    }
}

/// Unique identifier for memory regions
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Ord, PartialOrd)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct RegionId(pub u64);

impl RegionId {
    /// Create a new region ID
    pub fn new() -> Self {
        static mut COUNTER: u64 = 0;
        unsafe {
            COUNTER += 1;
            Self(COUNTER)
        }
    }
    
    /// Get the raw ID value
    pub fn raw(&self) -> u64 {
        self.0
    }
}

/// Swarm topology types
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum SwarmTopology {
    /// Centralized hub-and-spoke
    Centralized,
    /// Distributed mesh network
    Mesh,
    /// Hierarchical tree structure
    Hierarchical,
    /// Ring topology
    Ring,
    /// Star configuration
    Star,
}

/// Agent capability descriptor
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Capability {
    /// Capability name
    pub name: String,
    /// Version or level
    pub version: u32,
    /// Resource requirements
    pub resources: ResourceRequirements,
}

impl Capability {
    /// Create a new capability
    pub fn new(name: String, version: u32) -> Self {
        Self {
            name,
            version,
            resources: ResourceRequirements::default(),
        }
    }
    
    /// Set resource requirements
    pub fn with_resources(mut self, resources: ResourceRequirements) -> Self {
        self.resources = resources;
        self
    }
}

/// Resource requirements for capabilities
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ResourceRequirements {
    /// Memory requirement in bytes
    pub memory: u64,
    /// CPU cycles estimate
    pub cpu_cycles: u64,
    /// Network bandwidth requirement
    pub bandwidth: u64,
}

impl Default for ResourceRequirements {
    fn default() -> Self {
        Self {
            memory: 1024,
            cpu_cycles: 1000,
            bandwidth: 0,
        }
    }
}

/// Message passing between agents
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Message {
    /// Sender agent ID
    pub from: AgentId,
    /// Receiver agent ID
    pub to: AgentId,
    /// Message type
    pub msg_type: MessageType,
    /// Message payload
    pub payload: MessagePayload,
}

/// Types of messages in the swarm
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum MessageType {
    /// Task assignment
    TaskAssignment,
    /// Task completion notification
    TaskComplete,
    /// Status update
    StatusUpdate,
    /// Resource request
    ResourceRequest,
    /// Coordination message
    Coordination,
    /// Heartbeat/ping
    Heartbeat,
}

/// Message payload data
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MessagePayload {
    /// Data content
    pub data: Vec<u8>,
    /// Metadata
    pub metadata: BTreeMap<String, String>,
}

impl MessagePayload {
    /// Create empty payload
    pub fn empty() -> Self {
        Self {
            data: Vec::new(),
            metadata: BTreeMap::new(),
        }
    }
    
    /// Create payload with data
    pub fn with_data(data: Vec<u8>) -> Self {
        Self {
            data,
            metadata: BTreeMap::new(),
        }
    }
    
    /// Add metadata entry
    pub fn with_metadata(mut self, key: String, value: String) -> Self {
        self.metadata.insert(key, value);
        self
    }
}

use alloc::collections::BTreeMap;

/// Configuration for the swarm system
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct SwarmConfig {
    /// Swarm name
    pub name: String,
    /// Maximum number of agents
    pub max_agents: usize,
    /// Swarm topology
    pub topology: SwarmTopology,
    /// Enable fault tolerance
    pub fault_tolerance: bool,
    /// Heartbeat interval
    pub heartbeat_interval: u64,
}

impl Default for SwarmConfig {
    fn default() -> Self {
        Self {
            name: String::from("default-swarm"),
            max_agents: 256,
            topology: SwarmTopology::Mesh,
            fault_tolerance: true,
            heartbeat_interval: 1000,
        }
    }
}

/// Configuration for the scheduler
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct SchedulerConfig {
    /// Maximum concurrent tasks per agent
    pub max_concurrent_tasks: usize,
    /// Task timeout in milliseconds
    pub task_timeout: u64,
    /// Enable priority scheduling
    pub priority_scheduling: bool,
    /// Load balancing strategy
    pub load_balancing: bool,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            max_concurrent_tasks: 4,
            task_timeout: 60000,
            priority_scheduling: true,
            load_balancing: true,
        }
    }
}

/// Configuration for memory management
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct MemoryConfig {
    /// Total memory pool size
    pub pool_size: usize,
    /// Minimum allocation size
    pub min_allocation: usize,
    /// Maximum allocation size
    pub max_allocation: usize,
    /// Enable memory compression
    pub compression: bool,
}

impl Default for MemoryConfig {
    fn default() -> Self {
        Self {
            pool_size: 1024 * 1024, // 1MB
            min_allocation: 64,
            max_allocation: 65536,
            compression: false,
        }
    }
}
//! Agent definition and lifecycle management

use alloc::{string::String, vec::Vec, boxed::Box};
use core::time::Duration;

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{
    Result, SwarmError, AgentId, TaskId, Capability, ResourceRequirements,
    Message, MessageType, MessagePayload,
};

/// Agent state in the swarm
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum AgentState {
    /// Agent is initializing
    Initializing,
    /// Agent is idle and available
    Idle,
    /// Agent is busy executing tasks
    Busy,
    /// Agent is shutting down
    Stopping,
    /// Agent has stopped
    Stopped,
    /// Agent has failed
    Failed,
}

/// Agent information
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct AgentInfo {
    /// Unique agent identifier
    pub id: AgentId,
    /// Agent name
    pub name: String,
    /// Agent type
    pub agent_type: AgentType,
    /// Current state
    pub state: AgentState,
    /// Agent capabilities
    pub capabilities: Vec<Capability>,
    /// Maximum parallel tasks
    pub max_parallel_tasks: usize,
    /// Current task count
    pub current_tasks: usize,
    /// Resource requirements
    pub resources: ResourceRequirements,
}

/// Types of agents in the swarm
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum AgentType {
    /// Neural network processing agent
    Neural,
    /// Quantum computation agent
    Quantum,
    /// Visualization and rendering agent
    Visualization,
    /// Data analysis agent
    Analytics,
    /// Coordination agent
    Coordinator,
    /// Memory management agent
    Memory,
    /// Generic computation agent
    Generic,
}

/// Agent execution context
#[derive(Debug, Clone)]
pub struct AgentContext {
    /// Current agent ID
    pub agent_id: AgentId,
    /// Active task IDs
    pub active_tasks: Vec<TaskId>,
    /// Available memory regions
    pub memory_regions: Vec<crate::RegionId>,
    /// Agent-specific configuration
    pub config: AgentConfig,
}

/// Agent-specific configuration
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct AgentConfig {
    /// Heartbeat interval
    pub heartbeat_interval: Duration,
    /// Maximum task execution time
    pub max_task_duration: Duration,
    /// Memory limit in bytes
    pub memory_limit: u64,
    /// Enable fault tolerance
    pub fault_tolerance: bool,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            heartbeat_interval: Duration::from_secs(10),
            max_task_duration: Duration::from_secs(300),
            memory_limit: 1024 * 1024, // 1MB
            fault_tolerance: true,
        }
    }
}

/// Agent lifecycle trait
pub trait Agent {
    /// Initialize the agent
    fn initialize(&mut self, context: AgentContext) -> Result<()>;
    
    /// Start the agent
    fn start(&mut self) -> Result<()>;
    
    /// Stop the agent
    fn stop(&mut self) -> Result<()>;
    
    /// Get agent information
    fn info(&self) -> &AgentInfo;
    
    /// Get current state
    fn state(&self) -> AgentState;
    
    /// Execute a task
    fn execute_task(&mut self, task_id: TaskId, payload: Vec<u8>) -> Result<Vec<u8>>;
    
    /// Handle a message
    fn handle_message(&mut self, message: Message) -> Result<Option<Message>>;
    
    /// Perform health check
    fn health_check(&self) -> Result<()>;
    
    /// Get resource usage
    fn resource_usage(&self) -> ResourceUsage;
}

/// Resource usage statistics
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ResourceUsage {
    /// Memory usage in bytes
    pub memory_used: u64,
    /// CPU usage percentage (0.0-1.0)
    pub cpu_usage: f32,
    /// Network bytes sent
    pub network_sent: u64,
    /// Network bytes received
    pub network_received: u64,
    /// Number of tasks completed
    pub tasks_completed: u64,
    /// Average task execution time
    pub avg_task_time: Duration,
}

impl Default for ResourceUsage {
    fn default() -> Self {
        Self {
            memory_used: 0,
            cpu_usage: 0.0,
            network_sent: 0,
            network_received: 0,
            tasks_completed: 0,
            avg_task_time: Duration::from_millis(0),
        }
    }
}

/// Base agent implementation
pub struct BaseAgent {
    info: AgentInfo,
    context: Option<AgentContext>,
    resource_usage: ResourceUsage,
}

impl BaseAgent {
    /// Create a new base agent
    pub fn new(name: String, agent_type: AgentType) -> Self {
        let info = AgentInfo {
            id: AgentId::new(),
            name,
            agent_type,
            state: AgentState::Initializing,
            capabilities: Vec::new(),
            max_parallel_tasks: 1,
            current_tasks: 0,
            resources: ResourceRequirements::default(),
        };
        
        Self {
            info,
            context: None,
            resource_usage: ResourceUsage::default(),
        }
    }
    
    /// Add a capability
    pub fn add_capability(&mut self, capability: Capability) {
        self.info.capabilities.push(capability);
    }
    
    /// Set maximum parallel tasks
    pub fn set_max_parallel_tasks(&mut self, max_tasks: usize) {
        self.info.max_parallel_tasks = max_tasks;
    }
    
    /// Set resource requirements
    pub fn set_resources(&mut self, resources: ResourceRequirements) {
        self.info.resources = resources;
    }
}

impl Agent for BaseAgent {
    fn initialize(&mut self, context: AgentContext) -> Result<()> {
        self.context = Some(context);
        self.info.state = AgentState::Idle;
        Ok(())
    }
    
    fn start(&mut self) -> Result<()> {
        if self.info.state != AgentState::Idle {
            return Err(SwarmError::invalid_state("Agent must be idle to start"));
        }
        self.info.state = AgentState::Idle;
        Ok(())
    }
    
    fn stop(&mut self) -> Result<()> {
        self.info.state = AgentState::Stopping;
        // Cancel active tasks if any
        self.info.current_tasks = 0;
        self.info.state = AgentState::Stopped;
        Ok(())
    }
    
    fn info(&self) -> &AgentInfo {
        &self.info
    }
    
    fn state(&self) -> AgentState {
        self.info.state
    }
    
    fn execute_task(&mut self, task_id: TaskId, payload: Vec<u8>) -> Result<Vec<u8>> {
        if self.info.current_tasks >= self.info.max_parallel_tasks {
            return Err(SwarmError::resource_exhausted("Agent at maximum capacity"));
        }
        
        self.info.current_tasks += 1;
        self.info.state = AgentState::Busy;
        
        // Basic task execution - just echo the payload
        let result = payload.clone();
        
        self.info.current_tasks -= 1;
        if self.info.current_tasks == 0 {
            self.info.state = AgentState::Idle;
        }
        
        self.resource_usage.tasks_completed += 1;
        
        Ok(result)
    }
    
    fn handle_message(&mut self, message: Message) -> Result<Option<Message>> {
        match message.msg_type {
            MessageType::Heartbeat => {
                // Respond to heartbeat
                Ok(Some(Message {
                    from: self.info.id,
                    to: message.from,
                    msg_type: MessageType::Heartbeat,
                    payload: MessagePayload::empty(),
                }))
            }
            MessageType::StatusUpdate => {
                // No response needed for status updates
                Ok(None)
            }
            _ => {
                // Default: no response
                Ok(None)
            }
        }
    }
    
    fn health_check(&self) -> Result<()> {
        match self.info.state {
            AgentState::Failed => Err(SwarmError::agent("Agent is in failed state")),
            AgentState::Stopped => Err(SwarmError::agent("Agent is stopped")),
            _ => Ok(()),
        }
    }
    
    fn resource_usage(&self) -> ResourceUsage {
        self.resource_usage.clone()
    }
}

/// Neural network agent
pub struct NeuralAgent {
    base: BaseAgent,
    network_size: usize,
}

impl NeuralAgent {
    /// Create a new neural agent
    pub fn new(name: String, network_size: usize) -> Self {
        let mut base = BaseAgent::new(name, AgentType::Neural);
        base.add_capability(Capability::new("neural_inference".into(), 1));
        base.add_capability(Capability::new("pattern_recognition".into(), 1));
        base.set_max_parallel_tasks(4);
        
        Self {
            base,
            network_size,
        }
    }
}

impl Agent for NeuralAgent {
    fn initialize(&mut self, context: AgentContext) -> Result<()> {
        self.base.initialize(context)
    }
    
    fn start(&mut self) -> Result<()> {
        self.base.start()
    }
    
    fn stop(&mut self) -> Result<()> {
        self.base.stop()
    }
    
    fn info(&self) -> &AgentInfo {
        self.base.info()
    }
    
    fn state(&self) -> AgentState {
        self.base.state()
    }
    
    fn execute_task(&mut self, task_id: TaskId, payload: Vec<u8>) -> Result<Vec<u8>> {
        // Simulate neural network processing
        let mut result = payload;
        
        // Add some "neural processing" simulation
        for i in 0..result.len() {
            result[i] = result[i].wrapping_mul(2).wrapping_add(1);
        }
        
        self.base.execute_task(task_id, result)
    }
    
    fn handle_message(&mut self, message: Message) -> Result<Option<Message>> {
        self.base.handle_message(message)
    }
    
    fn health_check(&self) -> Result<()> {
        self.base.health_check()
    }
    
    fn resource_usage(&self) -> ResourceUsage {
        let mut usage = self.base.resource_usage();
        usage.memory_used += (self.network_size * 4) as u64; // 4 bytes per parameter
        usage
    }
}

/// Quantum computation agent
pub struct QuantumAgent {
    base: BaseAgent,
    qubit_count: usize,
}

impl QuantumAgent {
    /// Create a new quantum agent
    pub fn new(name: String, qubit_count: usize) -> Self {
        let mut base = BaseAgent::new(name, AgentType::Quantum);
        base.add_capability(Capability::new("quantum_computation".into(), 1));
        base.add_capability(Capability::new("optimization".into(), 1));
        base.set_max_parallel_tasks(2);
        
        Self {
            base,
            qubit_count,
        }
    }
}

impl Agent for QuantumAgent {
    fn initialize(&mut self, context: AgentContext) -> Result<()> {
        self.base.initialize(context)
    }
    
    fn start(&mut self) -> Result<()> {
        self.base.start()
    }
    
    fn stop(&mut self) -> Result<()> {
        self.base.stop()
    }
    
    fn info(&self) -> &AgentInfo {
        self.base.info()
    }
    
    fn state(&self) -> AgentState {
        self.base.state()
    }
    
    fn execute_task(&mut self, task_id: TaskId, payload: Vec<u8>) -> Result<Vec<u8>> {
        // Simulate quantum computation
        let mut result = payload;
        
        // Add some "quantum processing" simulation
        for i in 0..result.len() {
            result[i] = result[i] ^ (i as u8);
        }
        
        self.base.execute_task(task_id, result)
    }
    
    fn handle_message(&mut self, message: Message) -> Result<Option<Message>> {
        self.base.handle_message(message)
    }
    
    fn health_check(&self) -> Result<()> {
        self.base.health_check()
    }
    
    fn resource_usage(&self) -> ResourceUsage {
        let mut usage = self.base.resource_usage();
        usage.memory_used += (self.qubit_count * 16) as u64; // 16 bytes per qubit state
        usage
    }
}

/// Agent factory for creating different types of agents
pub struct AgentFactory;

impl AgentFactory {
    /// Create a neural agent
    pub fn create_neural(name: String, network_size: usize) -> Box<dyn Agent> {
        Box::new(NeuralAgent::new(name, network_size))
    }
    
    /// Create a quantum agent
    pub fn create_quantum(name: String, qubit_count: usize) -> Box<dyn Agent> {
        Box::new(QuantumAgent::new(name, qubit_count))
    }
    
    /// Create a generic agent
    pub fn create_generic(name: String) -> Box<dyn Agent> {
        Box::new(BaseAgent::new(name, AgentType::Generic))
    }
}
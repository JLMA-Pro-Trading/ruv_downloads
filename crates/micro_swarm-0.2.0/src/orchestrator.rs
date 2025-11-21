//! Swarm orchestration and task scheduling

use alloc::{vec::Vec, string::String};

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{
    Result, SwarmError, SwarmConfig, SwarmTopology, SchedulerConfig, MemoryConfig,
    Agent, Task, AgentId, TaskId, Message, MessageType, MessagePayload, AgentState
};

use crate::coordinator::SwarmCoordinator;
use crate::scheduler::TaskScheduler;
use crate::memory::SwarmMemoryPool;
use crate::channel::SwarmChannelManager;

/// Processing cycle statistics
#[derive(Debug, Clone, Default)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ProcessingStats {
    /// Number of tasks scheduled this cycle
    pub tasks_scheduled: usize,
    /// Number of tasks completed this cycle
    pub tasks_completed: usize,
    /// Number of agents that failed this cycle
    pub failed_agents: usize,
    /// Duration of this processing cycle
    pub cycle_duration: u64,
}

/// Builder for creating swarm orchestrators
pub struct SwarmBuilder {
    config: SwarmConfig,
}

impl SwarmBuilder {
    /// Create a new swarm builder
    pub fn new() -> Self {
        Self {
            config: SwarmConfig::default(),
        }
    }
    
    /// Set swarm name
    pub fn name(mut self, name: String) -> Self {
        self.config.name = name;
        self
    }
    
    /// Set maximum number of agents
    pub fn max_agents(mut self, max_agents: usize) -> Self {
        self.config.max_agents = max_agents;
        self
    }
    
    /// Set swarm topology
    pub fn topology(mut self, topology: SwarmTopology) -> Self {
        self.config.topology = topology;
        self.config.coordination_config.topology = topology;
        self
    }
    
    /// Enable/disable monitoring
    pub fn monitoring(mut self, enabled: bool) -> Self {
        self.config.monitoring_enabled = enabled;
        self
    }
    
    /// Enable/disable fault tolerance
    pub fn fault_tolerance(mut self, enabled: bool) -> Self {
        self.config.fault_tolerance = enabled;
        self.config.coordination_config.fault_tolerance = enabled;
        self
    }
    
    /// Set scheduler configuration
    pub fn scheduler_config(mut self, config: SchedulerConfig) -> Self {
        self.config.scheduler_config = config;
        self
    }
    
    /// Set memory configuration
    pub fn memory_config(mut self, config: MemoryConfig) -> Self {
        self.config.memory_config = config;
        self
    }
    
    /// Build the orchestrator
    pub fn build(self) -> Result<SwarmOrchestrator> {
        SwarmOrchestrator::new(self.config)
    }
}

/// Main swarm orchestrator
pub struct SwarmOrchestrator {
    /// Swarm configuration
    config: SwarmConfig,
    /// Agent coordinator
    coordinator: SwarmCoordinator,
    /// Task scheduler
    scheduler: TaskScheduler,
    /// Memory pool
    memory_pool: SwarmMemoryPool,
    /// Channel manager
    channel_manager: SwarmChannelManager,
    /// Current cycle number
    cycle_count: u64,
}

impl SwarmOrchestrator {
    /// Create a new orchestrator
    pub fn new(config: SwarmConfig) -> Result<Self> {
        let coordinator = SwarmCoordinator::new(crate::coordinator::CoordinationConfig {
            topology: config.topology,
            max_groups: 16,
            fault_tolerance: config.fault_tolerance,
            heartbeat_interval: config.heartbeat_interval,
            consensus_timeout: 5000,
            leader_election: true,
        });
        let scheduler = TaskScheduler::new(SchedulerConfig::default());
        let memory_pool = SwarmMemoryPool::new(MemoryConfig::default());
        let channel_manager = SwarmChannelManager::new();
        
        Ok(Self {
            config,
            coordinator,
            scheduler,
            memory_pool,
            channel_manager,
            cycle_count: 0,
        })
    }
    
    /// Create a builder for configuration
    pub fn builder() -> SwarmBuilder {
        SwarmBuilder::new()
    }
    
    /// Spawn a new agent
    pub fn spawn_agent(&mut self, agent: Agent) -> Result<AgentId> {
        let agent_id = agent.id();
        self.coordinator.register_agent(agent)?;
        self.channel_manager.create_agent_channels(agent_id)?;
        Ok(agent_id)
    }
    
    /// Submit a task to the swarm
    pub fn submit_task(&mut self, task: Task) -> Result<TaskId> {
        let task_id = task.id();
        self.scheduler.add_task(task)?;
        Ok(task_id)
    }
    
    /// Process one orchestration cycle
    pub fn process_cycle(&mut self) -> Result<ProcessingStats> {
        let start_time = self.get_time();
        let mut stats = ProcessingStats::default();
        
        // Update agent health
        self.coordinator.check_agent_health()?;
        
        // Schedule tasks
        let scheduled = self.scheduler.schedule_tasks(&mut self.coordinator)?;
        stats.tasks_scheduled = scheduled.len();
        
        // Process messages
        self.channel_manager.process_pending_messages()?;
        
        // Update cycle count
        self.cycle_count += 1;
        stats.cycle_duration = self.get_time() - start_time;
        
        Ok(stats)
    }
    
    /// Get current time (placeholder)
    fn get_time(&self) -> u64 {
        // In a real implementation, this would use a proper time source
        self.cycle_count * 1000
    }
}

impl Default for SwarmBuilder {
    fn default() -> Self {
        Self::new()
    }
}

impl Default for ResourceUtilization {
    fn default() -> Self {
        Self {
            cpu_usage: 0.0,
            memory_usage: 0.0,
            network_usage: 0.0,
            storage_usage: 0.0,
        }
    }
}

impl Default for SwarmMetrics {
    fn default() -> Self {
        Self {
            active_agents: 0,
            memory_utilization: 0.0,
            total_tasks_processed: 0,
            tasks_in_queue: 0,
            tasks_running: 0,
            avg_task_completion_time: 0.0,
            throughput: 0.0,
            error_rate: 0.0,
            message_rate: 0.0,
            resource_usage: ResourceUtilization::default(),
        }
    }
}
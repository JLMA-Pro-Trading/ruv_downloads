//! Task scheduling and execution planning

use alloc::{vec::Vec, collections::{BTreeMap, VecDeque}, string::String};
use core::cmp::Ordering;

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{
    Result, SwarmError, AgentId, TaskId, Task, TaskPriority, TaskStatus, 
    Agent, AgentState, ResourceRequirements,
};

/// Task scheduler configuration
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct SchedulerConfig {
    /// Maximum concurrent tasks across all agents
    pub max_concurrent_tasks: usize,
    /// Task queue size limit
    pub task_queue_size: usize,
    /// Agent selection strategy
    pub selection_strategy: AgentSelectionStrategy,
    /// Enable load balancing
    pub load_balancing: bool,
    /// Enable task preemption
    pub preemption: bool,
    /// Task dependency resolution
    pub dependency_resolution: bool,
}

impl Default for SchedulerConfig {
    fn default() -> Self {
        Self {
            max_concurrent_tasks: 256,
            task_queue_size: 10000,
            selection_strategy: AgentSelectionStrategy::LoadBalanced,
            load_balancing: true,
            preemption: false,
            dependency_resolution: true,
        }
    }
}

/// Agent selection strategies
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum AgentSelectionStrategy {
    /// Round-robin assignment
    RoundRobin,
    /// Assign to least loaded agent
    LeastLoaded,
    /// Load-balanced assignment with capability matching
    LoadBalanced,
    /// Capability-based assignment
    CapabilityBased,
    /// Agent affinity-based assignment
    AffinityBased,
}

/// Agent workload information
#[derive(Debug, Clone)]
pub struct AgentWorkload {
    /// Agent identifier
    pub agent_id: AgentId,
    /// Agent capabilities
    pub capabilities: Vec<String>,
    /// Current number of tasks
    pub current_tasks: usize,
    /// Maximum parallel tasks
    pub max_tasks: usize,
    /// Total completed tasks
    pub total_completed: u64,
    /// Average task completion time
    pub avg_completion_time: u64,
    /// Current load factor (0.0 - 1.0)
    pub load_factor: f32,
}

impl AgentWorkload {
    /// Create new agent workload tracker
    pub fn new(agent_id: AgentId, capabilities: Vec<String>, max_tasks: usize) -> Self {
        Self {
            agent_id,
            capabilities,
            current_tasks: 0,
            max_tasks,
            total_completed: 0,
            avg_completion_time: 0,
            load_factor: 0.0,
        }
    }
    
    /// Update load factor
    pub fn update_load_factor(&mut self) {
        self.load_factor = if self.max_tasks > 0 {
            self.current_tasks as f32 / self.max_tasks as f32
        } else {
            1.0
        };
    }
    
    /// Check if agent can handle more tasks
    pub fn can_accept_task(&self) -> bool {
        self.current_tasks < self.max_tasks
    }
    
    /// Check if agent has required capabilities
    pub fn has_capabilities(&self, required: &[String]) -> bool {
        required.iter().all(|cap| self.capabilities.contains(cap))
    }
}

/// Task execution plan
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct ExecutionPlan {
    /// Plan identifier
    pub id: u64,
    /// Planned tasks with their assigned agents
    pub assignments: Vec<TaskAssignment>,
    /// Dependency graph
    pub dependencies: BTreeMap<TaskId, Vec<TaskId>>,
    /// Estimated total execution time
    pub estimated_duration: u64,
    /// Maximum parallelism factor
    pub parallelism_factor: f32,
}

/// Task assignment in execution plan
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TaskAssignment {
    /// Task to execute
    pub task_id: TaskId,
    /// Assigned agent
    pub agent_id: AgentId,
    /// Estimated start time
    pub estimated_start: u64,
    /// Estimated completion time
    pub estimated_completion: u64,
}

/// Scheduler statistics
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct SchedulerStats {
    /// Total tasks submitted
    pub total_submitted: u64,
    /// Total tasks completed
    pub total_completed: u64,
    /// Total tasks failed
    pub total_failed: u64,
    /// Current queue depth
    pub queue_depth: usize,
    /// Active tasks count
    pub active_tasks: usize,
    /// Average queue time
    pub avg_queue_time: f32,
    /// Average execution time
    pub avg_execution_time: f32,
    /// Agent utilization map
    pub agent_utilization: BTreeMap<AgentId, f32>,
}

impl Default for SchedulerStats {
    fn default() -> Self {
        Self {
            total_submitted: 0,
            total_completed: 0,
            total_failed: 0,
            queue_depth: 0,
            active_tasks: 0,
            avg_queue_time: 0.0,
            avg_execution_time: 0.0,
            agent_utilization: BTreeMap::new(),
        }
    }
}

/// Task scheduler for the swarm
pub struct TaskScheduler {
    /// Configuration
    config: SchedulerConfig,
    /// Task queue ordered by priority
    task_queue: Vec<Task>,
    /// Currently running tasks
    running_tasks: BTreeMap<TaskId, TaskExecution>,
    /// Completed tasks
    completed_tasks: Vec<TaskId>,
    /// Agent workload tracking
    agent_workloads: BTreeMap<AgentId, AgentWorkload>,
    /// Scheduler statistics
    stats: SchedulerStats,
    /// Round-robin counter for agent selection
    round_robin_counter: usize,
}

/// Task execution information
#[derive(Debug, Clone)]
struct TaskExecution {
    /// Task ID
    task_id: TaskId,
    /// Assigned agent
    agent_id: AgentId,
    /// Start time
    start_time: u64,
    /// Expected completion time
    expected_completion: u64,
}

impl TaskScheduler {
    /// Create a new task scheduler
    pub fn new(config: SchedulerConfig) -> Self {
        Self {
            config,
            task_queue: Vec::new(),
            running_tasks: BTreeMap::new(),
            completed_tasks: Vec::new(),
            agent_workloads: BTreeMap::new(),
            stats: SchedulerStats::default(),
            round_robin_counter: 0,
        }
    }
    
    /// Register an agent with the scheduler
    pub fn register_agent(&mut self, agent_id: AgentId, capabilities: Vec<String>, max_tasks: usize) -> Result<()> {
        let workload = AgentWorkload::new(agent_id, capabilities, max_tasks);
        self.agent_workloads.insert(agent_id, workload);
        self.stats.agent_utilization.insert(agent_id, 0.0);
        Ok(())
    }
    
    /// Unregister an agent from the scheduler
    pub fn unregister_agent(&mut self, agent_id: AgentId) -> Result<()> {
        // Cancel any running tasks for this agent
        let cancelled_tasks: Vec<_> = self.running_tasks.iter()
            .filter(|(_, execution)| execution.agent_id == agent_id)
            .map(|(task_id, _)| *task_id)
            .collect();
        
        for task_id in cancelled_tasks {
            self.cancel_task(task_id)?;
        }
        
        self.agent_workloads.remove(&agent_id);
        self.stats.agent_utilization.remove(&agent_id);
        
        Ok(())
    }
    
    /// Submit a task for scheduling
    pub fn submit_task(&mut self, mut task: Task) -> Result<()> {
        // Check queue size limit
        if self.task_queue.len() >= self.config.task_queue_size {
            return Err(SwarmError::scheduler("Task queue is full"));
        }
        
        // Validate task dependencies if enabled
        if self.config.dependency_resolution {
            self.validate_dependencies(&task)?;
        }
        
        // Insert task in priority order
        let insert_pos = self.task_queue.iter()
            .position(|t| t.priority < task.priority)
            .unwrap_or(self.task_queue.len());
        
        task.status = TaskStatus::Pending;
        self.task_queue.insert(insert_pos, task);
        
        self.stats.total_submitted += 1;
        self.stats.queue_depth = self.task_queue.len();
        
        Ok(())
    }
    
    /// Submit multiple tasks as a batch
    pub fn submit_batch(&mut self, tasks: Vec<Task>) -> Result<()> {
        for task in tasks {
            self.submit_task(task)?;
        }
        Ok(())
    }
    
    /// Create an execution plan for pending tasks
    pub fn create_execution_plan(&mut self) -> Result<ExecutionPlan> {
        static mut PLAN_COUNTER: u64 = 0;
        let plan_id = unsafe {
            PLAN_COUNTER += 1;
            PLAN_COUNTER
        };
        
        let mut assignments = Vec::new();
        let mut dependencies = BTreeMap::new();
        let mut current_time = self.get_current_time();
        
        // Build dependency graph
        for task in &self.task_queue {
            dependencies.insert(task.id, task.dependencies.clone());
        }
        
        // Create assignments for ready tasks
        for task in &self.task_queue {
            if self.is_task_ready(task) {
                if let Some(agent_id) = self.select_agent_for_task(task) {
                    let estimated_duration = self.estimate_task_duration(task);
                    
                    assignments.push(TaskAssignment {
                        task_id: task.id,
                        agent_id,
                        estimated_start: current_time,
                        estimated_completion: current_time + estimated_duration,
                    });
                    
                    current_time += estimated_duration / 4; // Assume some parallelism
                }
            }
        }
        
        let parallelism_factor = if self.task_queue.len() > 0 {
            assignments.len() as f32 / self.task_queue.len() as f32
        } else {
            1.0
        };
        
        Ok(ExecutionPlan {
            id: plan_id,
            assignments,
            dependencies,
            estimated_duration: current_time - self.get_current_time(),
            parallelism_factor,
        })
    }
    
    /// Schedule pending tasks to available agents
    pub fn schedule_tasks(&mut self) -> Result<Vec<TaskId>> {
        let mut scheduled_tasks = Vec::new();
        
        // Check if we've reached the concurrent task limit
        if self.running_tasks.len() >= self.config.max_concurrent_tasks {
            return Ok(scheduled_tasks);
        }
        
        let mut i = 0;
        while i < self.task_queue.len() {
            // Check if task is ready (dependencies satisfied)
            let task_ready = self.is_task_ready(&self.task_queue[i]);
            if !task_ready {
                i += 1;
                continue;
            }
            
            // Try to find an available agent with a cloned task for checking
            let task_for_selection = self.task_queue[i].clone();
            if let Some(agent_id) = self.select_agent_for_task(&task_for_selection) {
                // Remove task from queue and schedule it
                let mut task = self.task_queue.remove(i);
                task.schedule(agent_id);
                
                let execution = TaskExecution {
                    task_id: task.id,
                    agent_id,
                    start_time: self.get_current_time(),
                    expected_completion: self.get_current_time() + self.estimate_task_duration(&task),
                };
                
                self.running_tasks.insert(task.id, execution);
                scheduled_tasks.push(task.id);
                
                // Update agent workload
                if let Some(workload) = self.agent_workloads.get_mut(&agent_id) {
                    workload.current_tasks += 1;
                    workload.update_load_factor();
                }
                
                self.stats.active_tasks += 1;
                self.stats.queue_depth = self.task_queue.len();
                
                // Check concurrent task limit
                if self.running_tasks.len() >= self.config.max_concurrent_tasks {
                    break;
                }
            } else {
                i += 1;
            }
        }
        
        Ok(scheduled_tasks)
    }
    
    /// Mark a task as completed
    pub fn complete_task(&mut self, task_id: TaskId, success: bool) -> Result<()> {
        let execution = self.running_tasks.remove(&task_id)
            .ok_or_else(|| SwarmError::scheduler("Task not found in running tasks"))?;
        
        // Calculate execution time before borrowing mutably
        let execution_time = if success {
            self.get_current_time() - execution.start_time
        } else {
            0
        };
        
        // Update agent workload
        if let Some(workload) = self.agent_workloads.get_mut(&execution.agent_id) {
            workload.current_tasks = workload.current_tasks.saturating_sub(1);
            workload.update_load_factor();
            
            if success {
                workload.total_completed += 1;
                workload.avg_completion_time = 
                    (workload.avg_completion_time + execution_time) / 2;
            }
        }
        
        // Update statistics
        if success {
            self.stats.total_completed += 1;
            self.completed_tasks.push(task_id);
        } else {
            self.stats.total_failed += 1;
        }
        
        self.stats.active_tasks = self.running_tasks.len();
        self.update_agent_utilization();
        
        Ok(())
    }
    
    /// Cancel a running task
    pub fn cancel_task(&mut self, task_id: TaskId) -> Result<()> {
        if let Some(execution) = self.running_tasks.remove(&task_id) {
            // Update agent workload
            if let Some(workload) = self.agent_workloads.get_mut(&execution.agent_id) {
                workload.current_tasks = workload.current_tasks.saturating_sub(1);
                workload.update_load_factor();
            }
            
            self.stats.active_tasks = self.running_tasks.len();
            self.update_agent_utilization();
        }
        
        Ok(())
    }
    
    /// Get current scheduler statistics
    pub fn stats(&self) -> &SchedulerStats {
        &self.stats
    }
    
    /// Get task status
    pub fn get_task_status(&self, task_id: TaskId) -> Option<TaskStatus> {
        // Check if task is running
        if self.running_tasks.contains_key(&task_id) {
            return Some(TaskStatus::Running);
        }
        
        // Check if task is completed
        if self.completed_tasks.contains(&task_id) {
            return Some(TaskStatus::Completed);
        }
        
        // Check if task is in queue
        for task in &self.task_queue {
            if task.id == task_id {
                return Some(task.status);
            }
        }
        
        None
    }
    
    /// Perform load balancing if enabled
    pub fn balance_load(&mut self) -> Result<u64> {
        if !self.config.load_balancing {
            return Ok(0);
        }
        
        let mut rebalanced = 0;
        
        // Calculate average load
        let total_load: usize = self.agent_workloads.values()
            .map(|w| w.current_tasks)
            .sum();
        
        let avg_load = if self.agent_workloads.len() > 0 {
            total_load as f32 / self.agent_workloads.len() as f32
        } else {
            0.0
        };
        
        // Find overloaded and underloaded agents
        let overloaded_threshold = avg_load * 1.5;
        let underloaded_threshold = avg_load * 0.5;
        
        let overloaded: Vec<_> = self.agent_workloads.iter()
            .filter(|(_, w)| w.current_tasks as f32 > overloaded_threshold && w.current_tasks > 0)
            .map(|(id, _)| *id)
            .collect();
        
        let underloaded: Vec<_> = self.agent_workloads.iter()
            .filter(|(_, w)| (w.current_tasks as f32) < underloaded_threshold && w.can_accept_task())
            .map(|(id, _)| *id)
            .collect();
        
        // In a real implementation, we would migrate tasks between agents
        // For this simulation, we just count potential rebalancing
        rebalanced = overloaded.len().min(underloaded.len()) as u64;
        
        Ok(rebalanced)
    }
    
    /// Check if a task is ready to execute (dependencies satisfied)
    fn is_task_ready(&self, task: &Task) -> bool {
        if !self.config.dependency_resolution {
            return true;
        }
        
        task.dependencies.iter().all(|dep_id| {
            self.completed_tasks.contains(dep_id)
        })
    }
    
    /// Select the best agent for a task based on strategy
    fn select_agent_for_task(&mut self, task: &Task) -> Option<AgentId> {
        let available_agents: Vec<_> = self.agent_workloads.iter()
            .filter(|(_, workload)| {
                workload.can_accept_task() && 
                workload.has_capabilities(&task.required_capabilities)
            })
            .collect();
        
        if available_agents.is_empty() {
            return None;
        }
        
        match self.config.selection_strategy {
            AgentSelectionStrategy::RoundRobin => {
                let selected = available_agents[self.round_robin_counter % available_agents.len()];
                self.round_robin_counter += 1;
                Some(*selected.0)
            }
            
            AgentSelectionStrategy::LeastLoaded => {
                available_agents.iter()
                    .min_by_key(|(_, workload)| workload.current_tasks)
                    .map(|(id, _)| **id)
            }
            
            AgentSelectionStrategy::LoadBalanced => {
                available_agents.iter()
                    .min_by(|(_, a), (_, b)| {
                        a.load_factor.partial_cmp(&b.load_factor)
                            .unwrap_or(Ordering::Equal)
                    })
                    .map(|(id, _)| **id)
            }
            
            AgentSelectionStrategy::CapabilityBased => {
                // Select agent with most matching capabilities
                available_agents.iter()
                    .max_by_key(|(_, workload)| {
                        task.required_capabilities.iter()
                            .filter(|cap| workload.capabilities.contains(cap))
                            .count()
                    })
                    .map(|(id, _)| **id)
            }
            
            AgentSelectionStrategy::AffinityBased => {
                // Check for preferred agent first
                if let Some(preferred) = task.preferred_agent {
                    if available_agents.iter().any(|(id, _)| **id == preferred) {
                        return Some(preferred);
                    }
                }
                
                // Fall back to least loaded
                available_agents.iter()
                    .min_by_key(|(_, workload)| workload.current_tasks)
                    .map(|(id, _)| **id)
            }
        }
    }
    
    /// Validate task dependencies
    fn validate_dependencies(&self, task: &Task) -> Result<()> {
        for dep_id in &task.dependencies {
            // Check for circular dependencies (simplified check)
            if *dep_id == task.id {
                return Err(SwarmError::scheduler("Circular dependency detected"));
            }
            
            // In a real implementation, we would do a full dependency graph analysis
        }
        
        Ok(())
    }
    
    /// Estimate task execution duration
    fn estimate_task_duration(&self, task: &Task) -> u64 {
        // Simple estimation based on payload size and priority
        let base_time = 100; // Base execution time
        let payload_factor = (task.payload.len() / 1024).max(1) as u64;
        let priority_factor = match task.priority {
            TaskPriority::Critical => 50,
            TaskPriority::High => 75,
            TaskPriority::Normal => 100,
            TaskPriority::Low => 150,
        };
        
        base_time * payload_factor * priority_factor / 100
    }
    
    /// Get current time (simulation counter)
    fn get_current_time(&self) -> u64 {
        static mut COUNTER: u64 = 0;
        unsafe {
            COUNTER += 1;
            COUNTER
        }
    }
    
    /// Update agent utilization statistics
    fn update_agent_utilization(&mut self) {
        for (agent_id, workload) in &self.agent_workloads {
            self.stats.agent_utilization.insert(*agent_id, workload.load_factor);
        }
    }
}
//! Task definition and management

use alloc::{string::String, vec::Vec};
use core::time::Duration;

#[cfg(feature = "serde")]
use serde::{Serialize, Deserialize};

use crate::{TaskId, AgentId, Capability};

/// Task priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum TaskPriority {
    /// Low priority, can be deferred
    Low = 0,
    /// Normal priority
    Normal = 1,
    /// High priority, should be expedited
    High = 2,
    /// Critical priority, must be executed immediately
    Critical = 3,
}

impl Default for TaskPriority {
    fn default() -> Self {
        TaskPriority::Normal
    }
}

/// Task status
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub enum TaskStatus {
    /// Task is pending execution
    Pending,
    /// Task has been scheduled to an agent
    Scheduled,
    /// Task is currently running
    Running,
    /// Task completed successfully
    Completed,
    /// Task failed with error
    Failed,
    /// Task was cancelled
    Cancelled,
    /// Task timed out
    Timeout,
}

/// Task definition
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct Task {
    /// Unique task identifier
    pub id: TaskId,
    /// Human-readable task name
    pub name: String,
    /// Task priority
    pub priority: TaskPriority,
    /// Required capabilities to execute this task
    pub required_capabilities: Vec<String>,
    /// Preferred agent to execute this task
    pub preferred_agent: Option<AgentId>,
    /// Task dependencies (must complete before this task)
    pub dependencies: Vec<TaskId>,
    /// Task payload data
    pub payload: Vec<u8>,
    /// Maximum execution time
    pub timeout: Duration,
    /// Task metadata
    pub metadata: TaskMetadata,
    /// Current status
    pub status: TaskStatus,
    /// Assigned agent (if scheduled)
    pub assigned_agent: Option<AgentId>,
}

/// Task metadata
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TaskMetadata {
    /// Task creation timestamp (simulation counter)
    pub created_at: u64,
    /// Task scheduled timestamp
    pub scheduled_at: Option<u64>,
    /// Task started timestamp
    pub started_at: Option<u64>,
    /// Task completed timestamp
    pub completed_at: Option<u64>,
    /// Estimated resource requirements
    pub resource_estimate: crate::ResourceRequirements,
    /// Task category/type
    pub category: String,
}

impl Default for TaskMetadata {
    fn default() -> Self {
        static mut COUNTER: u64 = 0;
        let timestamp = unsafe {
            COUNTER += 1;
            COUNTER
        };
        
        Self {
            created_at: timestamp,
            scheduled_at: None,
            started_at: None,
            completed_at: None,
            resource_estimate: crate::ResourceRequirements::default(),
            category: "generic".into(),
        }
    }
}

impl Task {
    /// Create a new task
    pub fn new(name: String, payload: Vec<u8>) -> Self {
        Self {
            id: TaskId::new(),
            name,
            priority: TaskPriority::Normal,
            required_capabilities: Vec::new(),
            preferred_agent: None,
            dependencies: Vec::new(),
            payload,
            timeout: Duration::from_secs(300), // 5 minutes default
            metadata: TaskMetadata::default(),
            status: TaskStatus::Pending,
            assigned_agent: None,
        }
    }
    
    /// Set task priority
    pub fn with_priority(mut self, priority: TaskPriority) -> Self {
        self.priority = priority;
        self
    }
    
    /// Add required capability
    pub fn with_capability(mut self, capability: String) -> Self {
        self.required_capabilities.push(capability);
        self
    }
    
    /// Set preferred agent
    pub fn with_preferred_agent(mut self, agent_id: AgentId) -> Self {
        self.preferred_agent = Some(agent_id);
        self
    }
    
    /// Add dependency
    pub fn with_dependency(mut self, task_id: TaskId) -> Self {
        self.dependencies.push(task_id);
        self
    }
    
    /// Set timeout
    pub fn with_timeout(mut self, timeout: Duration) -> Self {
        self.timeout = timeout;
        self
    }
    
    /// Set category
    pub fn with_category(mut self, category: String) -> Self {
        self.metadata.category = category;
        self
    }
    
    /// Mark task as scheduled
    pub fn schedule(&mut self, agent_id: AgentId) {
        self.status = TaskStatus::Scheduled;
        self.assigned_agent = Some(agent_id);
        static mut COUNTER: u64 = 0;
        self.metadata.scheduled_at = Some(unsafe {
            COUNTER += 1;
            COUNTER
        });
    }
    
    /// Mark task as started
    pub fn start(&mut self) {
        self.status = TaskStatus::Running;
        static mut COUNTER: u64 = 0;
        self.metadata.started_at = Some(unsafe {
            COUNTER += 1;
            COUNTER
        });
    }
    
    /// Mark task as completed
    pub fn complete(&mut self) {
        self.status = TaskStatus::Completed;
        static mut COUNTER: u64 = 0;
        self.metadata.completed_at = Some(unsafe {
            COUNTER += 1;
            COUNTER
        });
    }
    
    /// Mark task as failed
    pub fn fail(&mut self) {
        self.status = TaskStatus::Failed;
        static mut COUNTER: u64 = 0;
        self.metadata.completed_at = Some(unsafe {
            COUNTER += 1;
            COUNTER
        });
    }
    
    /// Mark task as cancelled
    pub fn cancel(&mut self) {
        self.status = TaskStatus::Cancelled;
        static mut COUNTER: u64 = 0;
        self.metadata.completed_at = Some(unsafe {
            COUNTER += 1;
            COUNTER
        });
    }
    
    /// Check if task is ready to execute (dependencies satisfied)
    pub fn is_ready(&self, completed_tasks: &[TaskId]) -> bool {
        if self.status != TaskStatus::Pending {
            return false;
        }
        
        // Check all dependencies are completed
        self.dependencies.iter().all(|dep| completed_tasks.contains(dep))
    }
    
    /// Get execution duration if completed
    pub fn execution_duration(&self) -> Option<u64> {
        match (self.metadata.started_at, self.metadata.completed_at) {
            (Some(start), Some(end)) => Some(end - start),
            _ => None,
        }
    }
    
    /// Get total duration from creation to completion
    pub fn total_duration(&self) -> Option<u64> {
        self.metadata.completed_at.map(|end| end - self.metadata.created_at)
    }
}

/// Task builder for creating complex tasks
pub struct TaskBuilder {
    task: Task,
}

impl TaskBuilder {
    /// Create a new task builder
    pub fn new(name: String) -> Self {
        Self {
            task: Task::new(name, Vec::new()),
        }
    }
    
    /// Set payload
    pub fn payload(mut self, payload: Vec<u8>) -> Self {
        self.task.payload = payload;
        self
    }
    
    /// Set priority
    pub fn priority(mut self, priority: TaskPriority) -> Self {
        self.task.priority = priority;
        self
    }
    
    /// Add capability requirement
    pub fn requires(mut self, capability: String) -> Self {
        self.task.required_capabilities.push(capability);
        self
    }
    
    /// Set preferred agent
    pub fn prefer_agent(mut self, agent_id: AgentId) -> Self {
        self.task.preferred_agent = Some(agent_id);
        self
    }
    
    /// Add dependency
    pub fn depends_on(mut self, task_id: TaskId) -> Self {
        self.task.dependencies.push(task_id);
        self
    }
    
    /// Set timeout
    pub fn timeout(mut self, timeout: Duration) -> Self {
        self.task.timeout = timeout;
        self
    }
    
    /// Set category
    pub fn category(mut self, category: String) -> Self {
        self.task.metadata.category = category;
        self
    }
    
    /// Build the task
    pub fn build(self) -> Task {
        self.task
    }
}

/// Task result after execution
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TaskResult {
    /// Task that was executed
    pub task_id: TaskId,
    /// Agent that executed the task
    pub agent_id: AgentId,
    /// Execution status
    pub status: TaskStatus,
    /// Result payload
    pub result: Vec<u8>,
    /// Error message if failed
    pub error: Option<String>,
    /// Execution metrics
    pub metrics: TaskMetrics,
}

/// Task execution metrics
#[derive(Debug, Clone)]
#[cfg_attr(feature = "serde", derive(Serialize, Deserialize))]
pub struct TaskMetrics {
    /// Queue time (scheduled - created)
    pub queue_time: u64,
    /// Execution time (completed - started)
    pub execution_time: u64,
    /// Total time (completed - created)
    pub total_time: u64,
    /// Memory used during execution
    pub memory_used: u64,
    /// CPU cycles consumed
    pub cpu_cycles: u64,
}

impl TaskResult {
    /// Create a successful task result
    pub fn success(task_id: TaskId, agent_id: AgentId, result: Vec<u8>, metrics: TaskMetrics) -> Self {
        Self {
            task_id,
            agent_id,
            status: TaskStatus::Completed,
            result,
            error: None,
            metrics,
        }
    }
    
    /// Create a failed task result
    pub fn failure(task_id: TaskId, agent_id: AgentId, error: String, metrics: TaskMetrics) -> Self {
        Self {
            task_id,
            agent_id,
            status: TaskStatus::Failed,
            result: Vec::new(),
            error: Some(error),
            metrics,
        }
    }
}
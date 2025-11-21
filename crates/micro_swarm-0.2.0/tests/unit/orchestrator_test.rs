//! Unit tests for swarm orchestration and coordination

use micro_swarm::*;
use alloc::{vec, string::String};

#[cfg(test)]
mod swarm_orchestrator_tests {
    use super::*;

    #[test]
    fn test_orchestrator_creation() {
        let orchestrator = SwarmOrchestrator::new();
        
        assert_eq!(orchestrator.agent_count(), 0);
        assert_eq!(orchestrator.task_count(), 0);
        assert_eq!(orchestrator.channel_count(), 0);
        assert_eq!(orchestrator.state(), SwarmState::Idle);
    }

    #[test]
    fn test_orchestrator_register_agent() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        let agent_info = AgentInfo {
            id: AgentId::new(),
            name: "test-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        
        let agent_id = agent_info.id;
        let result = orchestrator.register_agent(agent_info);
        
        assert!(result.is_ok());
        assert_eq!(orchestrator.agent_count(), 1);
        
        let retrieved = orchestrator.get_agent(agent_id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, agent_id);
    }

    #[test]
    fn test_orchestrator_submit_task() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        let task_info = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: None,
            created_at: 0,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        
        let task_id = task_info.id;
        let result = orchestrator.submit_task(task_info);
        
        assert!(result.is_ok());
        assert_eq!(orchestrator.task_count(), 1);
        
        let retrieved = orchestrator.get_task(task_id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, task_id);
    }

    #[test]
    fn test_orchestrator_task_assignment() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Register agent
        let agent_info = AgentInfo {
            id: AgentId::new(),
            name: "worker-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        let agent_id = agent_info.id;
        orchestrator.register_agent(agent_info).unwrap();
        
        // Submit task
        let task_info = TaskInfo {
            id: TaskId::new(),
            name: "compute-task".into(),
            priority: Priority::High,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 0,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        let task_id = task_info.id;
        orchestrator.submit_task(task_info).unwrap();
        
        // Process assignments
        let assignments = orchestrator.process_task_assignments();
        assert!(assignments.is_ok());
        assert!(assignments.unwrap() > 0);
        
        // Task should now be assigned
        let task = orchestrator.get_task(task_id).unwrap();
        assert_eq!(task.state, TaskState::Assigned);
        assert_eq!(task.assigned_agent, Some(agent_id));
        
        // Agent should be busy
        let agent = orchestrator.get_agent(agent_id).unwrap();
        assert_eq!(agent.state, AgentState::Busy);
        assert_eq!(agent.current_tasks, 1);
    }

    #[test]
    fn test_orchestrator_task_completion() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Set up agent and task
        let agent_info = AgentInfo {
            id: AgentId::new(),
            name: "worker-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        let agent_id = agent_info.id;
        orchestrator.register_agent(agent_info).unwrap();
        
        let task_info = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Running,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: Some(agent_id),
            created_at: 0,
            started_at: Some(1000),
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        let task_id = task_info.id;
        orchestrator.submit_task(task_info).unwrap();
        
        // Complete the task
        let result = orchestrator.complete_task(
            task_id,
            TaskResult::Success("Task completed successfully".into())
        );
        
        assert!(result.is_ok());
        
        // Task should be completed
        let task = orchestrator.get_task(task_id).unwrap();
        assert_eq!(task.state, TaskState::Completed);
        assert!(task.result.is_some());
        
        // Agent stats should be updated
        let agent = orchestrator.get_agent(agent_id).unwrap();
        assert_eq!(agent.tasks_completed, 1);
        assert_eq!(agent.current_tasks, 0);
    }

    #[test]
    fn test_orchestrator_agent_failure_handling() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Register agent
        let agent_info = AgentInfo {
            id: AgentId::new(),
            name: "failing-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        let agent_id = agent_info.id;
        orchestrator.register_agent(agent_info).unwrap();
        
        // Submit and assign task
        let task_info = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Running,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: Some(agent_id),
            created_at: 0,
            started_at: Some(1000),
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        let task_id = task_info.id;
        orchestrator.submit_task(task_info).unwrap();
        
        // Mark agent as failed
        let result = orchestrator.handle_agent_failure(agent_id);
        assert!(result.is_ok());
        
        // Agent should be in failed state
        let agent = orchestrator.get_agent(agent_id).unwrap();
        assert_eq!(agent.state, AgentState::Failed);
        
        // Task should be reassigned or marked for retry
        let task = orchestrator.get_task(task_id).unwrap();
        assert!(task.state == TaskState::Pending || task.state == TaskState::Failed);
    }

    #[test]
    fn test_orchestrator_resource_management() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Register agent with limited resources
        let agent_info = AgentInfo {
            id: AgentId::new(),
            name: "limited-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 1,
            current_tasks: 0,
            resource_requirements: ResourceRequirements {
                cpu_cores: 2,
                memory_mb: 1024,
                disk_mb: 512,
                network_bandwidth_mbps: 100,
            },
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        let agent_id = agent_info.id;
        orchestrator.register_agent(agent_info).unwrap();
        
        // Submit two tasks
        let task1 = TaskInfo {
            id: TaskId::new(),
            name: "task-1".into(),
            priority: Priority::Normal,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 0,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        
        let task2 = TaskInfo {
            id: TaskId::new(),
            name: "task-2".into(),
            priority: Priority::Normal,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 0,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        
        let task1_id = task1.id;
        let task2_id = task2.id;
        
        orchestrator.submit_task(task1).unwrap();
        orchestrator.submit_task(task2).unwrap();
        
        // Process assignments - only one should be assigned
        let assignments = orchestrator.process_task_assignments().unwrap();
        assert_eq!(assignments, 1);
        
        // One task assigned, one pending
        let task1_state = orchestrator.get_task(task1_id).unwrap().state;
        let task2_state = orchestrator.get_task(task2_id).unwrap().state;
        
        assert!(
            (task1_state == TaskState::Assigned && task2_state == TaskState::Pending) ||
            (task1_state == TaskState::Pending && task2_state == TaskState::Assigned)
        );
        
        // Agent should be at capacity
        let agent = orchestrator.get_agent(agent_id).unwrap();
        assert!(agent.is_at_capacity());
    }

    #[test]
    fn test_orchestrator_statistics() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Add some agents and tasks
        for i in 0..3 {
            let agent_info = AgentInfo {
                id: AgentId::new(),
                name: format!("agent-{}", i),
                agent_type: AgentType::Worker,
                state: if i == 0 { AgentState::Idle } else { AgentState::Busy },
                capabilities: vec![Capability::Compute],
                max_parallel_tasks: 4,
                current_tasks: if i == 0 { 0 } else { 2 },
                resource_requirements: ResourceRequirements::default(),
                uptime: core::time::Duration::from_secs(i as u64 * 3600),
                tasks_completed: i * 5,
                tasks_failed: i,
            };
            orchestrator.register_agent(agent_info).unwrap();
        }
        
        for i in 0..5 {
            let task_info = TaskInfo {
                id: TaskId::new(),
                name: format!("task-{}", i),
                priority: if i < 2 { Priority::High } else { Priority::Normal },
                state: match i {
                    0..=1 => TaskState::Completed,
                    2..=3 => TaskState::Running,
                    _ => TaskState::Pending,
                },
                required_capabilities: vec![Capability::Compute],
                resource_requirements: ResourceRequirements::default(),
                assigned_agent: if i < 4 { Some(AgentId::from(i as u64)) } else { None },
                created_at: i as u64 * 1000,
                started_at: if i < 4 { Some(i as u64 * 1000 + 100) } else { None },
                completed_at: if i < 2 { Some(i as u64 * 1000 + 5000) } else { None },
                retry_count: 0,
                max_retries: 3,
                timeout: Some(core::time::Duration::from_secs(30)),
                dependencies: vec![],
                result: if i < 2 { 
                    Some(TaskResult::Success("completed".into())) 
                } else { 
                    None 
                },
            };
            orchestrator.submit_task(task_info).unwrap();
        }
        
        let stats = orchestrator.statistics();
        
        assert_eq!(stats.total_agents, 3);
        assert_eq!(stats.active_agents, 2); // 2 busy agents
        assert_eq!(stats.idle_agents, 1);
        assert_eq!(stats.total_tasks, 5);
        assert_eq!(stats.completed_tasks, 2);
        assert_eq!(stats.running_tasks, 2);
        assert_eq!(stats.pending_tasks, 1);
        assert!(stats.average_task_completion_time > 0.0);
    }

    #[test]
    fn test_orchestrator_health_check() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Register healthy agent
        let healthy_agent = AgentInfo {
            id: AgentId::new(),
            name: "healthy-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(3600),
            tasks_completed: 10,
            tasks_failed: 0,
        };
        orchestrator.register_agent(healthy_agent).unwrap();
        
        // Register unhealthy agent
        let unhealthy_agent = AgentInfo {
            id: AgentId::new(),
            name: "unhealthy-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Failed,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(100),
            tasks_completed: 2,
            tasks_failed: 8,
        };
        orchestrator.register_agent(unhealthy_agent).unwrap();
        
        let health = orchestrator.health_check();
        
        assert!(!health.is_healthy);
        assert_eq!(health.healthy_agents, 1);
        assert_eq!(health.unhealthy_agents, 1);
        assert!(health.overall_success_rate < 1.0);
        assert!(!health.issues.is_empty());
    }
}

#[cfg(test)]
mod swarm_state_tests {
    use super::*;

    #[test]
    fn test_swarm_state_transitions() {
        let mut state = SwarmState::Idle;
        
        // Idle -> Starting
        state = state.transition_to(SwarmState::Starting).unwrap();
        assert_eq!(state, SwarmState::Starting);
        
        // Starting -> Running
        state = state.transition_to(SwarmState::Running).unwrap();
        assert_eq!(state, SwarmState::Running);
        
        // Running -> Stopping
        state = state.transition_to(SwarmState::Stopping).unwrap();
        assert_eq!(state, SwarmState::Stopping);
        
        // Stopping -> Stopped
        state = state.transition_to(SwarmState::Stopped).unwrap();
        assert_eq!(state, SwarmState::Stopped);
    }

    #[test]
    fn test_invalid_swarm_state_transitions() {
        let state = SwarmState::Stopped;
        
        // Cannot transition from stopped
        assert!(state.transition_to(SwarmState::Running).is_err());
        assert!(state.transition_to(SwarmState::Idle).is_err());
    }

    #[test]
    fn test_swarm_state_properties() {
        assert!(SwarmState::Running.is_active());
        assert!(!SwarmState::Idle.is_active());
        assert!(!SwarmState::Stopped.is_active());
        
        assert!(SwarmState::Running.can_accept_tasks());
        assert!(!SwarmState::Stopping.can_accept_tasks());
        assert!(!SwarmState::Stopped.can_accept_tasks());
    }
}
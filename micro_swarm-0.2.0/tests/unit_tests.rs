//! Comprehensive unit tests for micro_swarm crate
//! 
//! This test suite covers all major components of the swarm orchestration system:
//! - Core types and identifiers
//! - Agent lifecycle management  
//! - Task scheduling and execution
//! - Memory pool management
//! - Inter-agent communication channels
//! - Swarm orchestration and coordination

#[cfg(test)]
mod unit {
    mod types_test;
    mod agent_test;
    mod task_test;
    mod memory_test;
    mod channel_test;
    mod orchestrator_test;
}

// Integration test to ensure all modules work together
#[cfg(test)]
mod integration {
    use micro_swarm::*;
    use alloc::{vec, string::String};

    #[test]
    fn test_complete_swarm_workflow() {
        // Create orchestrator
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Register multiple agents with different capabilities
        let agent1 = AgentInfo {
            id: AgentId::new(),
            name: "compute-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 2,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        
        let agent2 = AgentInfo {
            id: AgentId::new(),
            name: "network-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Network],
            max_parallel_tasks: 3,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };
        
        let agent1_id = agent1.id;
        let agent2_id = agent2.id;
        
        orchestrator.register_agent(agent1).unwrap();
        orchestrator.register_agent(agent2).unwrap();
        
        // Submit multiple tasks with different priorities and capabilities
        let task1 = TaskInfo {
            id: TaskId::new(),
            name: "high-priority-compute".into(),
            priority: Priority::High,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 1000,
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
            name: "network-task".into(),
            priority: Priority::Normal,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Network],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 2000,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        
        let task3 = TaskInfo {
            id: TaskId::new(),
            name: "low-priority-compute".into(),
            priority: Priority::Low,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 3000,
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
        let task3_id = task3.id;
        
        orchestrator.submit_task(task1).unwrap();
        orchestrator.submit_task(task2).unwrap();
        orchestrator.submit_task(task3).unwrap();
        
        assert_eq!(orchestrator.task_count(), 3);
        assert_eq!(orchestrator.agent_count(), 2);
        
        // Process task assignments
        let assignments = orchestrator.process_task_assignments().unwrap();
        assert_eq!(assignments, 3); // All tasks should be assigned
        
        // Verify assignments are correct
        let task1_assigned = orchestrator.get_task(task1_id).unwrap();
        let task2_assigned = orchestrator.get_task(task2_id).unwrap();
        let task3_assigned = orchestrator.get_task(task3_id).unwrap();
        
        assert_eq!(task1_assigned.state, TaskState::Assigned);
        assert_eq!(task2_assigned.state, TaskState::Assigned);
        assert_eq!(task3_assigned.state, TaskState::Assigned);
        
        // Compute tasks should go to compute agent, network task to network agent
        assert_eq!(task1_assigned.assigned_agent, Some(agent1_id));
        assert_eq!(task2_assigned.assigned_agent, Some(agent2_id));
        assert_eq!(task3_assigned.assigned_agent, Some(agent1_id));
        
        // Verify agent states
        let agent1_updated = orchestrator.get_agent(agent1_id).unwrap();
        let agent2_updated = orchestrator.get_agent(agent2_id).unwrap();
        
        assert_eq!(agent1_updated.current_tasks, 2); // Both compute tasks
        assert_eq!(agent2_updated.current_tasks, 1); // Network task
        assert_eq!(agent1_updated.state, AgentState::Busy);
        assert_eq!(agent2_updated.state, AgentState::Busy);
        
        // Complete tasks
        orchestrator.complete_task(task1_id, TaskResult::Success("Task 1 done".into())).unwrap();
        orchestrator.complete_task(task2_id, TaskResult::Success("Task 2 done".into())).unwrap();
        orchestrator.complete_task(task3_id, TaskResult::Success("Task 3 done".into())).unwrap();
        
        // Verify completion
        let task1_completed = orchestrator.get_task(task1_id).unwrap();
        let task2_completed = orchestrator.get_task(task2_id).unwrap();
        let task3_completed = orchestrator.get_task(task3_id).unwrap();
        
        assert_eq!(task1_completed.state, TaskState::Completed);
        assert_eq!(task2_completed.state, TaskState::Completed);
        assert_eq!(task3_completed.state, TaskState::Completed);
        
        // Verify agent stats updated
        let agent1_final = orchestrator.get_agent(agent1_id).unwrap();
        let agent2_final = orchestrator.get_agent(agent2_id).unwrap();
        
        assert_eq!(agent1_final.tasks_completed, 2);
        assert_eq!(agent2_final.tasks_completed, 1);
        assert_eq!(agent1_final.current_tasks, 0);
        assert_eq!(agent2_final.current_tasks, 0);
        assert_eq!(agent1_final.state, AgentState::Idle);
        assert_eq!(agent2_final.state, AgentState::Idle);
        
        // Check overall statistics
        let stats = orchestrator.statistics();
        assert_eq!(stats.completed_tasks, 3);
        assert_eq!(stats.running_tasks, 0);
        assert_eq!(stats.pending_tasks, 0);
        assert_eq!(stats.active_agents, 0); // All idle now
        assert_eq!(stats.idle_agents, 2);
    }

    #[test]
    fn test_memory_and_channel_integration() {
        // Test memory management with channels
        let mut memory_manager = MemoryManager::new();
        let pool_id = memory_manager.create_pool(4096, 16).unwrap();
        
        // Allocate memory for message buffers
        let buffer1 = memory_manager.allocate(pool_id, 256).unwrap();
        let buffer2 = memory_manager.allocate(pool_id, 512).unwrap();
        
        assert_eq!(memory_manager.used_memory(), 768);
        
        // Create channel between agents
        let agent1 = AgentId::new();
        let agent2 = AgentId::new();
        let mut channel_manager = ChannelManager::new();
        
        let channel_id = channel_manager.create_channel(agent1, agent2, 10).unwrap();
        
        // Send messages through channel
        let message = Message::new(
            agent1,
            agent2,
            MessageType::TaskAssignment,
            MessagePayload::Binary(vec![1, 2, 3, 4, 5])
        );
        
        channel_manager.send_message(channel_id, message).unwrap();
        
        let received = channel_manager.receive_message(channel_id);
        assert!(received.is_some());
        
        let received_msg = received.unwrap();
        if let MessagePayload::Binary(data) = received_msg.payload() {
            assert_eq!(data, &vec![1, 2, 3, 4, 5]);
        } else {
            panic!("Expected binary payload");
        }
        
        // Cleanup memory
        memory_manager.deallocate(buffer1).unwrap();
        memory_manager.deallocate(buffer2).unwrap();
        
        assert_eq!(memory_manager.used_memory(), 0);
        
        // Get statistics
        let channel_stats = channel_manager.total_statistics();
        assert_eq!(channel_stats.total_messages_sent, 1);
        assert_eq!(channel_stats.total_messages_received, 1);
    }

    #[test]
    fn test_failure_recovery_workflow() {
        let mut orchestrator = SwarmOrchestrator::new();
        
        // Register agent
        let agent_info = AgentInfo {
            id: AgentId::new(),
            name: "fragile-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 2,
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
            name: "critical-task".into(),
            priority: Priority::Critical,
            state: TaskState::Pending,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::minimal(),
            assigned_agent: None,
            created_at: 0,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 2,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };
        let task_id = task_info.id;
        orchestrator.submit_task(task_info).unwrap();
        
        // Assign and start task
        orchestrator.process_task_assignments().unwrap();
        let mut task = orchestrator.get_task(task_id).unwrap();
        task.start_execution(1000).unwrap();
        
        // Simulate agent failure
        orchestrator.handle_agent_failure(agent_id).unwrap();
        
        // Verify agent is marked as failed
        let failed_agent = orchestrator.get_agent(agent_id).unwrap();
        assert_eq!(failed_agent.state, AgentState::Failed);
        
        // Task should be back to pending for retry
        let failed_task = orchestrator.get_task(task_id).unwrap();
        assert_eq!(failed_task.state, TaskState::Pending);
        assert_eq!(failed_task.retry_count, 1);
        
        // Register replacement agent
        let replacement_agent = AgentInfo {
            id: AgentId::new(),
            name: "replacement-agent".into(),
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
        let replacement_id = replacement_agent.id;
        orchestrator.register_agent(replacement_agent).unwrap();
        
        // Reassign task
        orchestrator.process_task_assignments().unwrap();
        
        let reassigned_task = orchestrator.get_task(task_id).unwrap();
        assert_eq!(reassigned_task.state, TaskState::Assigned);
        assert_eq!(reassigned_task.assigned_agent, Some(replacement_id));
        
        // Complete successfully on retry
        orchestrator.complete_task(task_id, TaskResult::Success("Recovered successfully".into())).unwrap();
        
        let completed_task = orchestrator.get_task(task_id).unwrap();
        assert_eq!(completed_task.state, TaskState::Completed);
        assert_eq!(completed_task.retry_count, 1);
        
        // Verify statistics reflect the recovery
        let stats = orchestrator.statistics();
        assert_eq!(stats.completed_tasks, 1);
        assert_eq!(stats.failed_agents, 1);
    }
}
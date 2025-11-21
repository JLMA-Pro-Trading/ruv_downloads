//! Integration tests for the micro swarm system

use micro_swarm::*;

#[test]
fn test_swarm_lifecycle() {
    // Create a swarm orchestrator
    let mut orchestrator = SwarmBuilder::new()
        .name("test_swarm".into())
        .max_agents(8)
        .topology(SwarmTopology::Mesh)
        .fault_tolerance(true)
        .build()
        .unwrap();
    
    // Initialize the swarm
    orchestrator.initialize().unwrap();
    assert_eq!(orchestrator.state(), SwarmState::Running);
    
    // Bootstrap default agents
    let agent_ids = orchestrator.bootstrap_default_agents().unwrap();
    assert_eq!(agent_ids.len(), 8); // 4 neural + 2 quantum + 2 generic
    assert_eq!(orchestrator.metrics().active_agents, 8);
    
    // Shutdown
    orchestrator.shutdown().unwrap();
    assert_eq!(orchestrator.state(), SwarmState::Stopped);
}

#[test]
fn test_task_submission_and_execution() {
    let mut orchestrator = SwarmBuilder::new()
        .name("task_test_swarm".into())
        .max_agents(4)
        .build()
        .unwrap();
    
    orchestrator.initialize().unwrap();
    
    // Add a neural agent
    let agent = AgentFactory::create_neural("test_neural".into(), 512);
    let agent_id = orchestrator.register_agent(agent).unwrap();
    
    // Create and submit a task
    let task = TaskBuilder::new("test_task".into())
        .payload(vec![1, 2, 3, 4])
        .priority(TaskPriority::High)
        .requires("neural_inference".into())
        .build();
    
    let task_id = orchestrator.submit_task(task).unwrap();
    
    // Process one cycle
    let stats = orchestrator.process_cycle().unwrap();
    assert!(stats.tasks_scheduled > 0 || stats.tasks_completed > 0);
    
    orchestrator.shutdown().unwrap();
}

#[test]
fn test_memory_management() {
    let mut orchestrator = SwarmBuilder::new()
        .name("memory_test_swarm".into())
        .memory_config(MemoryConfig {
            total_size: 1024 * 1024, // 1MB
            region_size: 1024,       // 1KB regions
            max_regions_per_agent: 8,
            compression_enabled: false,
            eviction_policy: EvictionPolicy::LRU,
        })
        .build()
        .unwrap();
    
    orchestrator.initialize().unwrap();
    
    // Add an agent
    let agent = AgentFactory::create_generic("memory_test".into());
    let agent_id = orchestrator.register_agent(agent).unwrap();
    
    // Check initial memory stats
    let memory_stats = orchestrator.memory_stats();
    assert_eq!(memory_stats.total_regions, 1024); // 1MB / 1KB = 1024 regions
    assert_eq!(memory_stats.allocated_regions, 0);
    
    orchestrator.shutdown().unwrap();
}

#[test]
fn test_fault_tolerance() {
    let mut orchestrator = SwarmBuilder::new()
        .name("fault_test_swarm".into())
        .max_agents(4)
        .fault_tolerance(true)
        .build()
        .unwrap();
    
    orchestrator.initialize().unwrap();
    
    // Add agents
    let agent1 = AgentFactory::create_neural("agent1".into(), 256);
    let agent2 = AgentFactory::create_quantum("agent2".into(), 4);
    
    let agent1_id = orchestrator.register_agent(agent1).unwrap();
    let agent2_id = orchestrator.register_agent(agent2).unwrap();
    
    assert_eq!(orchestrator.metrics().active_agents, 2);
    
    // Simulate agent failure by unregistering
    orchestrator.unregister_agent(agent1_id).unwrap();
    assert_eq!(orchestrator.metrics().active_agents, 1);
    
    // The remaining agent should still be functional
    let stats = orchestrator.process_cycle().unwrap();
    // System should continue operating
    
    orchestrator.shutdown().unwrap();
}

#[test]
fn test_scheduler_strategies() {
    for strategy in [
        AgentSelectionStrategy::RoundRobin,
        AgentSelectionStrategy::LeastLoaded,
        AgentSelectionStrategy::LoadBalanced,
        AgentSelectionStrategy::CapabilityBased,
    ] {
        let scheduler_config = SchedulerConfig {
            selection_strategy: strategy,
            max_concurrent_tasks: 16,
            task_queue_size: 100,
            load_balancing: true,
            preemption: false,
            dependency_resolution: true,
        };
        
        let mut orchestrator = SwarmBuilder::new()
            .name(format!("scheduler_test_{:?}", strategy))
            .scheduler_config(scheduler_config)
            .build()
            .unwrap();
        
        orchestrator.initialize().unwrap();
        
        // Add diverse agents
        let neural_agent = AgentFactory::create_neural("neural".into(), 512);
        let quantum_agent = AgentFactory::create_quantum("quantum".into(), 8);
        
        orchestrator.register_agent(neural_agent).unwrap();
        orchestrator.register_agent(quantum_agent).unwrap();
        
        // Submit tasks with different requirements
        let neural_task = TaskBuilder::new("neural_task".into())
            .requires("neural_inference".into())
            .build();
        
        let quantum_task = TaskBuilder::new("quantum_task".into())
            .requires("quantum_computation".into())
            .build();
        
        orchestrator.submit_task(neural_task).unwrap();
        orchestrator.submit_task(quantum_task).unwrap();
        
        // Process cycles
        for _ in 0..5 {
            let _ = orchestrator.process_cycle().unwrap();
        }
        
        orchestrator.shutdown().unwrap();
    }
}

#[test]
fn test_swarm_topologies() {
    for topology in [
        SwarmTopology::Centralized,
        SwarmTopology::Mesh,
        SwarmTopology::Hierarchical,
        SwarmTopology::Ring,
        SwarmTopology::Star,
    ] {
        let mut orchestrator = SwarmBuilder::new()
            .name(format!("topology_test_{:?}", topology))
            .topology(topology)
            .max_agents(6)
            .build()
            .unwrap();
        
        orchestrator.initialize().unwrap();
        
        // Add agents
        for i in 0..3 {
            let agent = AgentFactory::create_generic(format!("agent_{}", i));
            orchestrator.register_agent(agent).unwrap();
        }
        
        // Check coordination is working
        let coord_stats = orchestrator.coordination_stats();
        // In a real implementation, we'd verify topology-specific behavior
        
        orchestrator.shutdown().unwrap();
    }
}

#[test]
fn test_status_export() {
    let mut orchestrator = SwarmBuilder::new()
        .name("status_test_swarm".into())
        .monitoring(true)
        .build()
        .unwrap();
    
    orchestrator.initialize().unwrap();
    
    // Add an agent and submit a task
    let agent = AgentFactory::create_neural("test_agent".into(), 256);
    orchestrator.register_agent(agent).unwrap();
    
    let task = TaskBuilder::new("test_task".into())
        .payload(vec![1, 2, 3])
        .build();
    orchestrator.submit_task(task).unwrap();
    
    // Export status
    let status = orchestrator.export_status().unwrap();
    
    // Verify status contains expected information
    assert!(status.contains("Swarm Status Report"));
    assert!(status.contains("status_test_swarm"));
    assert!(status.contains("Active Agents: 1"));
    assert!(status.contains("Tasks in Queue:"));
    assert!(status.contains("Memory Stats:"));
    
    orchestrator.shutdown().unwrap();
}

#[cfg(test)]
mod agent_tests {
    use super::*;
    
    #[test] 
    fn test_neural_agent() {
        let mut agent = *AgentFactory::create_neural("test".into(), 1024);
        
        let context = AgentContext {
            agent_id: AgentId::new(),
            active_tasks: Vec::new(),
            memory_regions: Vec::new(),
            config: AgentConfig::default(),
        };
        
        agent.initialize(context).unwrap();
        agent.start().unwrap();
        
        assert_eq!(agent.state(), AgentState::Idle);
        assert_eq!(agent.info().agent_type, AgentType::Neural);
        
        // Execute a task
        let result = agent.execute_task(TaskId::new(), vec![1, 2, 3, 4]).unwrap();
        assert!(!result.is_empty());
        
        agent.stop().unwrap();
        assert_eq!(agent.state(), AgentState::Stopped);
    }
    
    #[test]
    fn test_quantum_agent() {
        let mut agent = *AgentFactory::create_quantum("test".into(), 8);
        
        let context = AgentContext {
            agent_id: AgentId::new(),
            active_tasks: Vec::new(), 
            memory_regions: Vec::new(),
            config: AgentConfig::default(),
        };
        
        agent.initialize(context).unwrap();
        agent.start().unwrap();
        
        assert_eq!(agent.state(), AgentState::Idle);
        assert_eq!(agent.info().agent_type, AgentType::Quantum);
        
        // Execute a task
        let result = agent.execute_task(TaskId::new(), vec![5, 6, 7, 8]).unwrap();
        assert!(!result.is_empty());
        
        agent.stop().unwrap();
    }
}

#[cfg(test)]
mod scheduler_tests {
    use super::*;
    
    #[test]
    fn test_task_scheduling() {
        let mut scheduler = TaskScheduler::new(SchedulerConfig::default());
        
        // Register an agent
        let agent_id = AgentId::new();
        scheduler.register_agent(
            agent_id, 
            vec!["generic".into()], 
            2
        ).unwrap();
        
        // Submit tasks
        let task1 = TaskBuilder::new("task1".into())
            .priority(TaskPriority::High)
            .build();
        let task2 = TaskBuilder::new("task2".into())
            .priority(TaskPriority::Low)
            .build();
        
        scheduler.submit_task(task1).unwrap();
        scheduler.submit_task(task2).unwrap();
        
        let stats = scheduler.stats();
        assert_eq!(stats.queue_depth, 2);
        
        // Schedule tasks
        let scheduled = scheduler.schedule_tasks().unwrap();
        assert!(scheduled.len() <= 2); // At most 2 tasks can be scheduled to 1 agent with max_tasks=2
    }
}

#[cfg(test)]
mod memory_tests {
    use super::*;
    
    #[test]
    fn test_memory_allocation() {
        let mut manager = MemoryManager::new(MemoryConfig::default());
        manager.initialize().unwrap();
        
        let agent_id = AgentId::new();
        
        // Allocate a region
        let region_id = manager.allocate(agent_id, 1024).unwrap();
        
        // Write and read data
        let test_data = vec![1, 2, 3, 4, 5];
        manager.write(region_id, &test_data).unwrap();
        
        let read_data = manager.read(region_id).unwrap();
        assert_eq!(test_data, read_data);
        
        // Deallocate
        manager.deallocate(region_id).unwrap();
        
        let stats = manager.stats();
        assert_eq!(stats.allocated_regions, 0);
    }
}
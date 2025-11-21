//! Unit tests for agent lifecycle and management

use micro_swarm::*;
use alloc::vec;

#[cfg(test)]
mod agent_info_tests {
    use super::*;

    #[test]
    fn test_agent_info_creation() {
        let id = AgentId::new();
        let info = AgentInfo {
            id,
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

        assert_eq!(info.id, id);
        assert_eq!(info.name, "test-agent");
        assert_eq!(info.agent_type, AgentType::Worker);
        assert_eq!(info.state, AgentState::Idle);
        assert_eq!(info.max_parallel_tasks, 4);
        assert_eq!(info.current_tasks, 0);
    }

    #[test]
    fn test_agent_info_availability() {
        let mut info = AgentInfo {
            id: AgentId::new(),
            name: "test-agent".into(),
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

        // Initially available
        assert!(info.is_available());
        assert!(info.can_accept_task());

        // At capacity
        info.current_tasks = 2;
        assert!(!info.can_accept_task());
        assert!(info.is_at_capacity());

        // Not available when busy
        info.state = AgentState::Busy;
        info.current_tasks = 1;
        assert!(!info.is_available());

        // Not available when failed
        info.state = AgentState::Failed;
        assert!(!info.is_available());
    }

    #[test]
    fn test_agent_info_capability_matching() {
        let info = AgentInfo {
            id: AgentId::new(),
            name: "test-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![
                Capability::Compute,
                Capability::Network,
            ],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };

        assert!(info.has_capability(&Capability::Compute));
        assert!(info.has_capability(&Capability::Network));
        assert!(!info.has_capability(&Capability::Storage));

        let required_caps = vec![Capability::Compute];
        assert!(info.has_all_capabilities(&required_caps));

        let mixed_caps = vec![Capability::Compute, Capability::Storage];
        assert!(!info.has_all_capabilities(&mixed_caps));
    }

    #[test]
    fn test_agent_info_resource_compatibility() {
        let info = AgentInfo {
            id: AgentId::new(),
            name: "test-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements {
                cpu_cores: 4,
                memory_mb: 2048,
                disk_mb: 1024,
                network_bandwidth_mbps: 100,
            },
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };

        let low_req = ResourceRequirements {
            cpu_cores: 2,
            memory_mb: 1024,
            disk_mb: 512,
            network_bandwidth_mbps: 50,
        };

        let high_req = ResourceRequirements {
            cpu_cores: 8,
            memory_mb: 4096,
            disk_mb: 2048,
            network_bandwidth_mbps: 200,
        };

        assert!(info.can_satisfy_requirements(&low_req));
        assert!(!info.can_satisfy_requirements(&high_req));
    }

    #[test]
    fn test_agent_info_task_tracking() {
        let mut info = AgentInfo {
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

        // Assign tasks
        info.assign_task();
        assert_eq!(info.current_tasks, 1);
        assert_eq!(info.state, AgentState::Busy);

        info.assign_task();
        assert_eq!(info.current_tasks, 2);

        // Complete task
        info.complete_task(true);
        assert_eq!(info.current_tasks, 1);
        assert_eq!(info.tasks_completed, 1);
        assert_eq!(info.tasks_failed, 0);

        // Fail task
        info.complete_task(false);
        assert_eq!(info.current_tasks, 0);
        assert_eq!(info.tasks_completed, 1);
        assert_eq!(info.tasks_failed, 1);
        assert_eq!(info.state, AgentState::Idle);
    }

    #[test]
    fn test_agent_info_success_rate() {
        let mut info = AgentInfo {
            id: AgentId::new(),
            name: "test-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 10,
            tasks_failed: 2,
        };

        let success_rate = info.success_rate();
        assert!((success_rate - 0.833).abs() < 0.01); // 10/(10+2) ≈ 0.833

        // No tasks completed
        info.tasks_completed = 0;
        info.tasks_failed = 0;
        assert_eq!(info.success_rate(), 0.0);
    }
}

#[cfg(test)]
mod agent_state_tests {
    use super::*;

    #[test]
    fn test_agent_state_transitions() {
        let mut state = AgentState::Initializing;
        
        // Valid transitions
        state = state.transition_to(AgentState::Idle).unwrap();
        assert_eq!(state, AgentState::Idle);
        
        state = state.transition_to(AgentState::Busy).unwrap();
        assert_eq!(state, AgentState::Busy);
        
        state = state.transition_to(AgentState::Idle).unwrap();
        assert_eq!(state, AgentState::Idle);
        
        state = state.transition_to(AgentState::Stopping).unwrap();
        assert_eq!(state, AgentState::Stopping);
        
        state = state.transition_to(AgentState::Stopped).unwrap();
        assert_eq!(state, AgentState::Stopped);
    }

    #[test]
    fn test_invalid_agent_state_transitions() {
        let state = AgentState::Stopped;
        
        // Cannot transition from stopped to any other state
        assert!(state.transition_to(AgentState::Idle).is_err());
        assert!(state.transition_to(AgentState::Busy).is_err());
    }

    #[test]
    fn test_agent_state_properties() {
        assert!(AgentState::Idle.can_accept_tasks());
        assert!(!AgentState::Busy.can_accept_tasks());
        assert!(!AgentState::Stopping.can_accept_tasks());
        assert!(!AgentState::Stopped.can_accept_tasks());
        assert!(!AgentState::Failed.can_accept_tasks());

        assert!(!AgentState::Idle.is_terminal());
        assert!(!AgentState::Busy.is_terminal());
        assert!(AgentState::Stopped.is_terminal());
        assert!(AgentState::Failed.is_terminal());
    }

    #[test]
    fn test_agent_state_display() {
        assert_eq!(format!("{}", AgentState::Initializing), "Initializing");
        assert_eq!(format!("{}", AgentState::Idle), "Idle");
        assert_eq!(format!("{}", AgentState::Busy), "Busy");
        assert_eq!(format!("{}", AgentState::Stopping), "Stopping");
        assert_eq!(format!("{}", AgentState::Stopped), "Stopped");
        assert_eq!(format!("{}", AgentState::Failed), "Failed");
    }
}

#[cfg(test)]
mod agent_registry_tests {
    use super::*;

    #[test]
    fn test_agent_registry_creation() {
        let registry = AgentRegistry::new();
        assert_eq!(registry.count(), 0);
        assert!(registry.is_empty());
    }

    #[test]
    fn test_agent_registry_register() {
        let mut registry = AgentRegistry::new();
        let agent_id = AgentId::new();
        let info = AgentInfo {
            id: agent_id,
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

        let result = registry.register(info.clone());
        assert!(result.is_ok());
        assert_eq!(registry.count(), 1);
        assert!(!registry.is_empty());

        // Get agent back
        let retrieved = registry.get(agent_id);
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().id, agent_id);

        // Cannot register same agent twice
        let result = registry.register(info);
        assert!(result.is_err());
    }

    #[test]
    fn test_agent_registry_unregister() {
        let mut registry = AgentRegistry::new();
        let agent_id = AgentId::new();
        let info = AgentInfo {
            id: agent_id,
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

        registry.register(info).unwrap();
        assert_eq!(registry.count(), 1);

        let removed = registry.unregister(agent_id);
        assert!(removed.is_some());
        assert_eq!(registry.count(), 0);

        let removed_again = registry.unregister(agent_id);
        assert!(removed_again.is_none());
    }

    #[test]
    fn test_agent_registry_find_by_capability() {
        let mut registry = AgentRegistry::new();
        
        // Add agents with different capabilities
        let agent1_id = AgentId::new();
        let agent1 = AgentInfo {
            id: agent1_id,
            name: "compute-agent".into(),
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

        let agent2_id = AgentId::new();
        let agent2 = AgentInfo {
            id: agent2_id,
            name: "network-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Idle,
            capabilities: vec![Capability::Network],
            max_parallel_tasks: 4,
            current_tasks: 0,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };

        registry.register(agent1).unwrap();
        registry.register(agent2).unwrap();

        let compute_agents = registry.find_by_capability(&Capability::Compute);
        assert_eq!(compute_agents.len(), 1);
        assert_eq!(compute_agents[0].id, agent1_id);

        let network_agents = registry.find_by_capability(&Capability::Network);
        assert_eq!(network_agents.len(), 1);
        assert_eq!(network_agents[0].id, agent2_id);

        let storage_agents = registry.find_by_capability(&Capability::Storage);
        assert_eq!(storage_agents.len(), 0);
    }

    #[test]
    fn test_agent_registry_find_available() {
        let mut registry = AgentRegistry::new();
        
        let agent1_id = AgentId::new();
        let mut agent1 = AgentInfo {
            id: agent1_id,
            name: "available-agent".into(),
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

        let agent2_id = AgentId::new();
        let mut agent2 = AgentInfo {
            id: agent2_id,
            name: "busy-agent".into(),
            agent_type: AgentType::Worker,
            state: AgentState::Busy,
            capabilities: vec![Capability::Compute],
            max_parallel_tasks: 4,
            current_tasks: 4,
            resource_requirements: ResourceRequirements::default(),
            uptime: core::time::Duration::from_secs(0),
            tasks_completed: 0,
            tasks_failed: 0,
        };

        registry.register(agent1).unwrap();
        registry.register(agent2).unwrap();

        let available = registry.find_available();
        assert_eq!(available.len(), 1);
        assert_eq!(available[0].id, agent1_id);
    }
}
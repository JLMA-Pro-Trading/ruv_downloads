//! Unit tests for core types and identifiers

use micro_swarm::*;

#[cfg(test)]
mod agent_id_tests {
    use super::*;

    #[test]
    fn test_agent_id_creation() {
        let id1 = AgentId::new();
        let id2 = AgentId::new();
        
        // IDs should be unique
        assert_ne!(id1, id2);
        assert!(id2.raw() > id1.raw());
    }

    #[test]
    fn test_agent_id_from_u64() {
        let id = AgentId::from(42);
        assert_eq!(id.raw(), 42);
    }

    #[test]
    fn test_agent_id_display() {
        let id = AgentId::from(123);
        let display_str = format!("{}", id);
        assert_eq!(display_str, "agent-123");
    }

    #[test]
    fn test_agent_id_equality() {
        let id1 = AgentId::from(100);
        let id2 = AgentId::from(100);
        let id3 = AgentId::from(101);
        
        assert_eq!(id1, id2);
        assert_ne!(id1, id3);
    }

    #[test]
    fn test_agent_id_hash() {
        use core::hash::{Hash, Hasher};
        use alloc::collections::BTreeMap;
        
        let id1 = AgentId::from(42);
        let id2 = AgentId::from(42);
        let id3 = AgentId::from(43);
        
        // Same IDs should hash the same
        let mut map = BTreeMap::new();
        map.insert(id1, "first");
        map.insert(id2, "second");
        map.insert(id3, "third");
        
        assert_eq!(map.len(), 2); // id1 and id2 are the same
        assert_eq!(map.get(&id1), Some(&"second")); // id2 overwrote id1
    }
}

#[cfg(test)]
mod task_id_tests {
    use super::*;

    #[test]
    fn test_task_id_creation() {
        let id1 = TaskId::new();
        let id2 = TaskId::new();
        
        // IDs should be unique
        assert_ne!(id1, id2);
        assert!(id2.raw() > id1.raw());
    }

    #[test]
    fn test_task_id_from_u64() {
        let id = TaskId::from(42);
        assert_eq!(id.raw(), 42);
    }

    #[test]
    fn test_task_id_display() {
        let id = TaskId::from(456);
        let display_str = format!("{}", id);
        assert_eq!(display_str, "task-456");
    }

    #[test]
    fn test_task_id_ordering() {
        let id1 = TaskId::from(1);
        let id2 = TaskId::from(2);
        let id3 = TaskId::from(3);
        
        assert!(id1 < id2);
        assert!(id2 < id3);
        assert!(id1 != id2);
    }
}

#[cfg(test)]
mod priority_tests {
    use super::*;

    #[test]
    fn test_priority_ordering() {
        assert!(Priority::Critical > Priority::High);
        assert!(Priority::High > Priority::Normal);
        assert!(Priority::Normal > Priority::Low);
        assert!(Priority::Low > Priority::Background);
    }

    #[test]
    fn test_priority_values() {
        assert_eq!(Priority::Critical.value(), 4);
        assert_eq!(Priority::High.value(), 3);
        assert_eq!(Priority::Normal.value(), 2);
        assert_eq!(Priority::Low.value(), 1);
        assert_eq!(Priority::Background.value(), 0);
    }

    #[test]
    fn test_priority_from_u8() {
        assert_eq!(Priority::from_u8(4), Priority::Critical);
        assert_eq!(Priority::from_u8(3), Priority::High);
        assert_eq!(Priority::from_u8(2), Priority::Normal);
        assert_eq!(Priority::from_u8(1), Priority::Low);
        assert_eq!(Priority::from_u8(0), Priority::Background);
        assert_eq!(Priority::from_u8(10), Priority::Critical); // Clamps to max
    }

    #[test]
    fn test_priority_display() {
        assert_eq!(format!("{}", Priority::Critical), "Critical");
        assert_eq!(format!("{}", Priority::High), "High");
        assert_eq!(format!("{}", Priority::Normal), "Normal");
        assert_eq!(format!("{}", Priority::Low), "Low");
        assert_eq!(format!("{}", Priority::Background), "Background");
    }
}

#[cfg(test)]
mod agent_type_tests {
    use super::*;

    #[test]
    fn test_agent_type_creation() {
        let worker = AgentType::Worker;
        let coordinator = AgentType::Coordinator;
        let monitor = AgentType::Monitor;
        
        assert_ne!(worker, coordinator);
        assert_ne!(coordinator, monitor);
        assert_ne!(worker, monitor);
    }

    #[test]
    fn test_agent_type_display() {
        assert_eq!(format!("{}", AgentType::Worker), "Worker");
        assert_eq!(format!("{}", AgentType::Coordinator), "Coordinator");
        assert_eq!(format!("{}", AgentType::Monitor), "Monitor");
        assert_eq!(format!("{}", AgentType::Resource), "Resource");
    }

    #[test]
    fn test_agent_type_properties() {
        assert!(AgentType::Worker.can_execute_tasks());
        assert!(AgentType::Coordinator.can_coordinate());
        assert!(AgentType::Monitor.can_monitor());
        assert!(AgentType::Resource.can_manage_resources());
    }
}

#[cfg(test)]
mod capability_tests {
    use super::*;

    #[test]
    fn test_capability_creation() {
        let compute = Capability::Compute;
        let network = Capability::Network;
        let storage = Capability::Storage;
        
        assert_ne!(compute, network);
        assert_ne!(network, storage);
    }

    #[test]
    fn test_capability_compatibility() {
        let cap1 = Capability::Compute;
        let cap2 = Capability::Compute;
        let cap3 = Capability::Network;
        
        assert!(cap1.is_compatible(&cap2));
        assert!(!cap1.is_compatible(&cap3));
    }

    #[test]
    fn test_capability_requirements() {
        let cap = Capability::Compute;
        let requirements = cap.resource_requirements();
        
        assert!(requirements.cpu_cores > 0);
        assert!(requirements.memory_mb > 0);
    }
}

#[cfg(test)]
mod resource_requirements_tests {
    use super::*;

    #[test]
    fn test_resource_requirements_creation() {
        let req = ResourceRequirements {
            cpu_cores: 2,
            memory_mb: 1024,
            disk_mb: 512,
            network_bandwidth_mbps: 100,
        };
        
        assert_eq!(req.cpu_cores, 2);
        assert_eq!(req.memory_mb, 1024);
        assert_eq!(req.disk_mb, 512);
        assert_eq!(req.network_bandwidth_mbps, 100);
    }

    #[test]
    fn test_resource_requirements_default() {
        let req = ResourceRequirements::default();
        
        assert_eq!(req.cpu_cores, 1);
        assert_eq!(req.memory_mb, 256);
        assert_eq!(req.disk_mb, 100);
        assert_eq!(req.network_bandwidth_mbps, 10);
    }

    #[test]
    fn test_resource_requirements_minimal() {
        let req = ResourceRequirements::minimal();
        
        assert_eq!(req.cpu_cores, 1);
        assert_eq!(req.memory_mb, 64);
        assert_eq!(req.disk_mb, 10);
        assert_eq!(req.network_bandwidth_mbps, 1);
    }

    #[test]
    fn test_resource_requirements_high_performance() {
        let req = ResourceRequirements::high_performance();
        
        assert!(req.cpu_cores >= 4);
        assert!(req.memory_mb >= 4096);
        assert!(req.disk_mb >= 1024);
        assert!(req.network_bandwidth_mbps >= 1000);
    }

    #[test]
    fn test_resource_requirements_can_satisfy() {
        let req1 = ResourceRequirements {
            cpu_cores: 2,
            memory_mb: 1024,
            disk_mb: 512,
            network_bandwidth_mbps: 100,
        };
        
        let req2 = ResourceRequirements {
            cpu_cores: 1,
            memory_mb: 512,
            disk_mb: 256,
            network_bandwidth_mbps: 50,
        };
        
        let req3 = ResourceRequirements {
            cpu_cores: 4,
            memory_mb: 2048,
            disk_mb: 1024,
            network_bandwidth_mbps: 200,
        };
        
        assert!(req1.can_satisfy(&req2));
        assert!(!req1.can_satisfy(&req3));
    }

    #[test]
    fn test_resource_requirements_add() {
        let req1 = ResourceRequirements {
            cpu_cores: 2,
            memory_mb: 1024,
            disk_mb: 512,
            network_bandwidth_mbps: 100,
        };
        
        let req2 = ResourceRequirements {
            cpu_cores: 1,
            memory_mb: 512,
            disk_mb: 256,
            network_bandwidth_mbps: 50,
        };
        
        let sum = req1 + req2;
        
        assert_eq!(sum.cpu_cores, 3);
        assert_eq!(sum.memory_mb, 1536);
        assert_eq!(sum.disk_mb, 768);
        assert_eq!(sum.network_bandwidth_mbps, 150);
    }
}

#[cfg(test)]
mod message_type_tests {
    use super::*;

    #[test]
    fn test_message_type_creation() {
        let task = MessageType::TaskAssignment;
        let result = MessageType::TaskResult;
        let heartbeat = MessageType::Heartbeat;
        
        assert_ne!(task, result);
        assert_ne!(result, heartbeat);
    }

    #[test]
    fn test_message_type_priority() {
        assert!(MessageType::SystemShutdown.priority() > MessageType::TaskAssignment.priority());
        assert!(MessageType::TaskResult.priority() > MessageType::Heartbeat.priority());
    }

    #[test]
    fn test_message_type_requires_response() {
        assert!(MessageType::TaskAssignment.requires_response());
        assert!(MessageType::ResourceRequest.requires_response());
        assert!(!MessageType::Heartbeat.requires_response());
        assert!(!MessageType::SystemShutdown.requires_response());
    }
}
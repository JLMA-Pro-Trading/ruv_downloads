//! Unit tests for task definition and scheduling

use micro_swarm::*;
use alloc::{vec, string::String};

#[cfg(test)]
mod task_info_tests {
    use super::*;

    #[test]
    fn test_task_info_creation() {
        let task_id = TaskId::new();
        let task = TaskInfo {
            id: task_id,
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

        assert_eq!(task.id, task_id);
        assert_eq!(task.name, "test-task");
        assert_eq!(task.priority, Priority::Normal);
        assert_eq!(task.state, TaskState::Pending);
        assert_eq!(task.retry_count, 0);
        assert_eq!(task.max_retries, 3);
    }

    #[test]
    fn test_task_info_assignment() {
        let mut task = TaskInfo {
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

        let agent_id = AgentId::new();
        
        // Assign to agent
        let result = task.assign_to_agent(agent_id);
        assert!(result.is_ok());
        assert_eq!(task.assigned_agent, Some(agent_id));
        assert_eq!(task.state, TaskState::Assigned);

        // Cannot reassign
        let result = task.assign_to_agent(AgentId::new());
        assert!(result.is_err());
    }

    #[test]
    fn test_task_info_execution() {
        let mut task = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Assigned,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: Some(AgentId::new()),
            created_at: 0,
            started_at: None,
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };

        // Start execution
        let result = task.start_execution(1000);
        assert!(result.is_ok());
        assert_eq!(task.state, TaskState::Running);
        assert_eq!(task.started_at, Some(1000));

        // Complete successfully
        let result = task.complete_execution(2000, TaskResult::Success("done".into()));
        assert!(result.is_ok());
        assert_eq!(task.state, TaskState::Completed);
        assert_eq!(task.completed_at, Some(2000));
        assert!(matches!(task.result, Some(TaskResult::Success(_))));
    }

    #[test]
    fn test_task_info_failure_and_retry() {
        let mut task = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Running,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: Some(AgentId::new()),
            created_at: 0,
            started_at: Some(1000),
            completed_at: None,
            retry_count: 0,
            max_retries: 2,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };

        // Fail first time
        let result = task.complete_execution(2000, TaskResult::Error("timeout".into()));
        assert!(result.is_ok());
        assert_eq!(task.state, TaskState::Pending); // Should go back to pending for retry
        assert_eq!(task.retry_count, 1);
        assert!(task.can_retry());

        // Fail second time
        task.state = TaskState::Running;
        task.started_at = Some(3000);
        let result = task.complete_execution(4000, TaskResult::Error("timeout".into()));
        assert!(result.is_ok());
        assert_eq!(task.state, TaskState::Pending);
        assert_eq!(task.retry_count, 2);
        assert!(task.can_retry());

        // Fail third time - should become failed
        task.state = TaskState::Running;
        task.started_at = Some(5000);
        let result = task.complete_execution(6000, TaskResult::Error("timeout".into()));
        assert!(result.is_ok());
        assert_eq!(task.state, TaskState::Failed);
        assert_eq!(task.retry_count, 3);
        assert!(!task.can_retry());
    }

    #[test]
    fn test_task_info_timeout_check() {
        let mut task = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Running,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: Some(AgentId::new()),
            created_at: 0,
            started_at: Some(1000),
            completed_at: None,
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: None,
        };

        // Not timed out
        assert!(!task.is_timed_out(25000)); // 24 seconds elapsed

        // Timed out
        assert!(task.is_timed_out(35000)); // 34 seconds elapsed

        // No timeout set
        task.timeout = None;
        assert!(!task.is_timed_out(100000));
    }

    #[test]
    fn test_task_info_dependencies() {
        let dep1 = TaskId::new();
        let dep2 = TaskId::new();
        
        let task = TaskInfo {
            id: TaskId::new(),
            name: "dependent-task".into(),
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
            dependencies: vec![dep1, dep2],
            result: None,
        };

        assert!(task.has_dependencies());
        assert_eq!(task.dependencies.len(), 2);
        assert!(task.depends_on(&dep1));
        assert!(task.depends_on(&dep2));
        assert!(!task.depends_on(&TaskId::new()));
    }

    #[test]
    fn test_task_info_duration() {
        let mut task = TaskInfo {
            id: TaskId::new(),
            name: "test-task".into(),
            priority: Priority::Normal,
            state: TaskState::Completed,
            required_capabilities: vec![Capability::Compute],
            resource_requirements: ResourceRequirements::default(),
            assigned_agent: Some(AgentId::new()),
            created_at: 1000,
            started_at: Some(2000),
            completed_at: Some(5000),
            retry_count: 0,
            max_retries: 3,
            timeout: Some(core::time::Duration::from_secs(30)),
            dependencies: vec![],
            result: Some(TaskResult::Success("done".into())),
        };

        let execution_duration = task.execution_duration();
        assert_eq!(execution_duration, Some(core::time::Duration::from_millis(3000)));

        let total_duration = task.total_duration();
        assert_eq!(total_duration, Some(core::time::Duration::from_millis(4000)));

        // Task still running
        task.state = TaskState::Running;
        task.completed_at = None;
        assert!(task.execution_duration().is_none());
        assert!(task.total_duration().is_none());
    }
}

#[cfg(test)]
mod task_state_tests {
    use super::*;

    #[test]
    fn test_task_state_transitions() {
        let mut state = TaskState::Pending;
        
        // Pending -> Assigned
        state = state.transition_to(TaskState::Assigned).unwrap();
        assert_eq!(state, TaskState::Assigned);
        
        // Assigned -> Running
        state = state.transition_to(TaskState::Running).unwrap();
        assert_eq!(state, TaskState::Running);
        
        // Running -> Completed
        state = state.transition_to(TaskState::Completed).unwrap();
        assert_eq!(state, TaskState::Completed);
    }

    #[test]
    fn test_invalid_task_state_transitions() {
        let state = TaskState::Completed;
        
        // Cannot transition from completed
        assert!(state.transition_to(TaskState::Running).is_err());
        assert!(state.transition_to(TaskState::Pending).is_err());
    }

    #[test]
    fn test_task_state_properties() {
        assert!(TaskState::Pending.can_be_assigned());
        assert!(!TaskState::Running.can_be_assigned());
        assert!(!TaskState::Completed.can_be_assigned());

        assert!(!TaskState::Pending.is_terminal());
        assert!(!TaskState::Running.is_terminal());
        assert!(TaskState::Completed.is_terminal());
        assert!(TaskState::Failed.is_terminal());
        assert!(TaskState::Cancelled.is_terminal());
    }
}

#[cfg(test)]
mod task_result_tests {
    use super::*;

    #[test]
    fn test_task_result_success() {
        let result = TaskResult::Success("completed successfully".into());
        
        assert!(result.is_success());
        assert!(!result.is_error());
        
        if let TaskResult::Success(msg) = result {
            assert_eq!(msg, "completed successfully");
        } else {
            panic!("Expected Success variant");
        }
    }

    #[test]
    fn test_task_result_error() {
        let result = TaskResult::Error("task failed".into());
        
        assert!(!result.is_success());
        assert!(result.is_error());
        
        if let TaskResult::Error(msg) = result {
            assert_eq!(msg, "task failed");
        } else {
            panic!("Expected Error variant");
        }
    }

    #[test]
    fn test_task_result_cancelled() {
        let result = TaskResult::Cancelled;
        
        assert!(!result.is_success());
        assert!(!result.is_error());
        assert!(result.is_cancelled());
    }
}

#[cfg(test)]
mod task_queue_tests {
    use super::*;

    fn create_test_task(priority: Priority, name: &str) -> TaskInfo {
        TaskInfo {
            id: TaskId::new(),
            name: name.into(),
            priority,
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
        }
    }

    #[test]
    fn test_task_queue_creation() {
        let queue = TaskQueue::new();
        assert_eq!(queue.len(), 0);
        assert!(queue.is_empty());
    }

    #[test]
    fn test_task_queue_push_pop() {
        let mut queue = TaskQueue::new();
        
        let task1 = create_test_task(Priority::Normal, "task1");
        let task2 = create_test_task(Priority::High, "task2");
        let task3 = create_test_task(Priority::Low, "task3");
        
        queue.push(task1);
        queue.push(task2);
        queue.push(task3);
        
        assert_eq!(queue.len(), 3);
        assert!(!queue.is_empty());
        
        // Should pop highest priority first
        let popped = queue.pop();
        assert!(popped.is_some());
        assert_eq!(popped.unwrap().priority, Priority::High);
        
        let popped = queue.pop();
        assert!(popped.is_some());
        assert_eq!(popped.unwrap().priority, Priority::Normal);
        
        let popped = queue.pop();
        assert!(popped.is_some());
        assert_eq!(popped.unwrap().priority, Priority::Low);
        
        assert!(queue.is_empty());
        assert!(queue.pop().is_none());
    }

    #[test]
    fn test_task_queue_peek() {
        let mut queue = TaskQueue::new();
        
        assert!(queue.peek().is_none());
        
        let task = create_test_task(Priority::High, "test-task");
        let task_id = task.id;
        queue.push(task);
        
        let peeked = queue.peek();
        assert!(peeked.is_some());
        assert_eq!(peeked.unwrap().id, task_id);
        assert_eq!(queue.len(), 1); // Peek doesn't remove
    }

    #[test]
    fn test_task_queue_priority_ordering() {
        let mut queue = TaskQueue::new();
        
        // Add tasks in random order
        queue.push(create_test_task(Priority::Low, "low"));
        queue.push(create_test_task(Priority::Critical, "critical"));
        queue.push(create_test_task(Priority::Normal, "normal"));
        queue.push(create_test_task(Priority::High, "high"));
        queue.push(create_test_task(Priority::Background, "background"));
        
        // Should come out in priority order
        assert_eq!(queue.pop().unwrap().priority, Priority::Critical);
        assert_eq!(queue.pop().unwrap().priority, Priority::High);
        assert_eq!(queue.pop().unwrap().priority, Priority::Normal);
        assert_eq!(queue.pop().unwrap().priority, Priority::Low);
        assert_eq!(queue.pop().unwrap().priority, Priority::Background);
    }

    #[test]
    fn test_task_queue_find_and_remove() {
        let mut queue = TaskQueue::new();
        
        let task1 = create_test_task(Priority::Normal, "task1");
        let task2 = create_test_task(Priority::High, "task2");
        let task1_id = task1.id;
        let task2_id = task2.id;
        
        queue.push(task1);
        queue.push(task2);
        
        // Find existing task
        let found = queue.find(&task1_id);
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, task1_id);
        
        // Remove existing task
        let removed = queue.remove(&task1_id);
        assert!(removed.is_some());
        assert_eq!(removed.unwrap().id, task1_id);
        assert_eq!(queue.len(), 1);
        
        // Try to find removed task
        let not_found = queue.find(&task1_id);
        assert!(not_found.is_none());
        
        // Remove non-existent task
        let not_removed = queue.remove(&TaskId::new());
        assert!(not_removed.is_none());
    }

    #[test]
    fn test_task_queue_clear() {
        let mut queue = TaskQueue::new();
        
        queue.push(create_test_task(Priority::Normal, "task1"));
        queue.push(create_test_task(Priority::High, "task2"));
        
        assert_eq!(queue.len(), 2);
        
        queue.clear();
        
        assert_eq!(queue.len(), 0);
        assert!(queue.is_empty());
    }
}
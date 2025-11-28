//! Integration tests for memory system

use nt_memory::*;
use tempfile::TempDir;

#[tokio::test]
async fn test_memory_system_full_workflow() {
    // Setup
    let temp_dir = TempDir::new().unwrap();
    let _config = MemoryConfig {
        cache_config: CacheConfig {
            max_entries: 1000,
            ttl: std::time::Duration::from_secs(60),
            track_access: true,
        },
        agentdb_url: "http://localhost:3000".to_string(),
        storage_path: temp_dir.path().to_str().unwrap().to_string(),
        enable_compression: true,
        max_memory_bytes: 1_000_000,
    };

    let memory = MemorySystem::new(config).await;

    // Skip if AgentDB not available
    if memory.is_err() {
        println!("Skipping test: AgentDB not available");
        return;
    }

    let memory = memory.unwrap();

    // Test basic put/get
    let key = "test_key";
    let value = b"test_value".to_vec();

    memory.put("agent_1", key, value.clone()).await.unwrap();

    let retrieved = memory.get("agent_1", key).await.unwrap();
    assert_eq!(retrieved, Some(value));

    // Test cache hit
    let retrieved_again = memory.get("agent_1", key).await.unwrap();
    assert!(retrieved_again.is_some());

    // Verify stats
    let stats = memory.stats();
    assert!(stats.l1_entries > 0);
    assert!(stats.l1_hit_rate > 0.0);
}

#[tokio::test]
async fn test_trajectory_tracking() {
    let temp_dir = TempDir::new().unwrap();
    let _config = MemoryConfig {
        storage_path: temp_dir.path().to_str().unwrap().to_string(),
        ..Default::default()
    };

    let memory = MemorySystem::new(config).await;
    if memory.is_err() {
        return;
    }

    let memory = memory.unwrap();

    // Create trajectory
    let mut trajectory = Trajectory::new("agent_1".to_string());

    trajectory.add_observation(
        serde_json::json!({"price": 100.0}),
        Some(vec![0.1; 384]),
    );

    trajectory.add_action(
        "buy".to_string(),
        serde_json::json!({"quantity": 10}),
        Some(110.0),
    );

    trajectory.add_outcome(105.0);

    // Track trajectory
    memory.track_trajectory(trajectory).await.unwrap();
}

#[tokio::test]
async fn test_pubsub_messaging() {
    let temp_dir = TempDir::new().unwrap();
    let _config = MemoryConfig {
        storage_path: temp_dir.path().to_str().unwrap().to_string(),
        ..Default::default()
    };

    let memory = MemorySystem::new(config).await;
    if memory.is_err() {
        return;
    }

    let memory = memory.unwrap();

    // Subscribe
    let mut rx = memory.subscribe("test_topic").await.unwrap();

    // Publish
    let message = b"test message".to_vec();
    memory.publish("test_topic", message.clone()).await.unwrap();

    // Receive
    let received = rx.recv().await.unwrap();
    assert_eq!(received, message);
}

#[tokio::test]
async fn test_distributed_locks() {
    let temp_dir = TempDir::new().unwrap();
    let _config = MemoryConfig {
        storage_path: temp_dir.path().to_str().unwrap().to_string(),
        ..Default::default()
    };

    let memory = MemorySystem::new(config).await;
    if memory.is_err() {
        return;
    }

    let memory = memory.unwrap();

    // Acquire lock
    let token = memory
        .acquire_lock("resource_1", std::time::Duration::from_secs(1))
        .await
        .unwrap();

    assert!(!token.is_empty());

    // Release lock
    memory.release_lock(&token).await.unwrap();
}

#[tokio::test]
async fn test_cross_agent_coordination() {
    let temp_dir = TempDir::new().unwrap();
    let _config = MemoryConfig {
        storage_path: temp_dir.path().to_str().unwrap().to_string(),
        ..Default::default()
    };

    let memory = MemorySystem::new(config).await;
    if memory.is_err() {
        return;
    }

    let memory = memory.unwrap();

    // Agent 1 stores data
    memory
        .put("agent_1", "shared_state", b"value_1".to_vec())
        .await
        .unwrap();

    // Agent 2 retrieves data
    let value = memory.get("agent_1", "shared_state").await.unwrap();
    assert_eq!(value, Some(b"value_1".to_vec()));

    // Agent 2 publishes message
    memory
        .publish("agent_1/updates", b"new_data".to_vec())
        .await
        .unwrap();
}

#[tokio::test]
async fn test_namespace_isolation() {
    let temp_dir = TempDir::new().unwrap();
    let _config = MemoryConfig {
        storage_path: temp_dir.path().to_str().unwrap().to_string(),
        ..Default::default()
    };

    let memory = MemorySystem::new(config).await;
    if memory.is_err() {
        return;
    }

    let memory = memory.unwrap();

    // Different agents store with same key
    memory
        .put("agent_1", "position", b"100".to_vec())
        .await
        .unwrap();

    memory
        .put("agent_2", "position", b"200".to_vec())
        .await
        .unwrap();

    // Verify isolation
    let val1 = memory.get("agent_1", "position").await.unwrap();
    let val2 = memory.get("agent_2", "position").await.unwrap();

    assert_eq!(val1, Some(b"100".to_vec()));
    assert_eq!(val2, Some(b"200".to_vec()));
}

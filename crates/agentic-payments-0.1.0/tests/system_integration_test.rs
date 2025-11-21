//! Integration tests for AgenticVerificationSystem

use agentic_payments::prelude::*;

#[tokio::test]
async fn test_system_full_workflow() {
    // Create system with 5 agents
    let system = AgenticVerificationSystem::builder()
        .pool_size(5)
        .consensus_threshold(0.67)
        .build()
        .await
        .unwrap();

    // Generate identity and sign message
    let identity = AgentIdentity::generate().unwrap();
    let message = b"test payment authorization";
    let signature = identity.sign(message).unwrap();

    // Verify with consensus
    let result = system
        .verify_with_consensus(signature, message, identity.verifying_key())
        .await
        .unwrap();

    // Assertions
    assert!(result.is_valid());
    assert_eq!(result.total_votes, 5);
    assert!(result.votes_for >= 4); // 4/5 = 0.8 > 0.67 threshold

    // Check metrics
    let metrics = system.metrics().await;
    assert_eq!(metrics.total_verifications, 1);
    assert_eq!(metrics.successful_verifications, 1);

    // Check health
    assert!(system.health_check().await.is_ok());
    assert_eq!(system.health_status().await, HealthStatus::Healthy);

    // Shutdown
    system.shutdown().await.unwrap();
}

#[tokio::test]
async fn test_system_scaling() {
    let system = AgenticVerificationSystem::builder()
        .pool_size(3)
        .build()
        .await
        .unwrap();

    assert_eq!(system.pool_size().await, 3);

    // Scale up
    system.scale_pool(10).await.unwrap();
    assert_eq!(system.pool_size().await, 10);

    // Scale down
    system.scale_pool(5).await.unwrap();
    assert_eq!(system.pool_size().await, 5);
}

#[tokio::test]
async fn test_system_invalid_signature() {
    let system = AgenticVerificationSystem::builder()
        .pool_size(5)
        .build()
        .await
        .unwrap();

    let identity1 = AgentIdentity::generate().unwrap();
    let identity2 = AgentIdentity::generate().unwrap();

    let message = b"test message";
    let signature = identity1.sign(message).unwrap();

    // Verify with wrong key - should fail consensus
    let result = system
        .verify_with_consensus(signature, message, identity2.verifying_key())
        .await;

    assert!(result.is_err());
}

#[tokio::test]
async fn test_system_concurrent_verifications() {
    let system = AgenticVerificationSystem::builder()
        .pool_size(10)
        .build()
        .await
        .unwrap();

    let identity = AgentIdentity::generate().unwrap();

    // Spawn 20 concurrent verifications
    let mut handles = vec![];
    for i in 0..20 {
        let system = system.clone();
        let identity = identity.clone();

        let handle = tokio::spawn(async move {
            let message = format!("message {}", i);
            let signature = identity.sign(message.as_bytes()).unwrap();

            system
                .verify_with_consensus(signature, message.as_bytes(), identity.verifying_key())
                .await
        });

        handles.push(handle);
    }

    // Wait for all verifications
    for handle in handles {
        let result = handle.await.unwrap();
        assert!(result.is_ok());
        assert!(result.unwrap().is_valid());
    }

    // Check metrics
    let metrics = system.metrics().await;
    assert_eq!(metrics.total_verifications, 20);
    assert_eq!(metrics.successful_verifications, 20);
}

#[tokio::test]
async fn test_system_builder_validation() {
    // Test invalid pool size
    let result = AgenticVerificationSystem::builder()
        .pool_size(1)
        .build()
        .await;
    assert!(result.is_err());

    // Test invalid threshold
    let result = AgenticVerificationSystem::builder()
        .consensus_threshold(1.5)
        .build()
        .await;
    assert!(result.is_err());
}
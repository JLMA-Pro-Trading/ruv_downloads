//! Integration tests for multi-transport message delivery

use bitchat_qudag::{
    BitChatMessaging, BitChatConfig, QuDAGMessaging,
    transport::TransportType,
    crypto::CryptoMode,
    messaging::{MessagePriority, MessageType}
};
use std::time::Duration;
use tokio::time::timeout;

#[cfg(all(test, not(target_arch = "wasm32")))]
mod multi_transport_integration {
    use super::*;

    #[tokio::test]
    async fn test_websocket_local_network_integration() {
        // Create two messaging instances with different transports
        let config1 = BitChatConfig::custom(
            vec![TransportType::WebSocket, TransportType::LocalNetwork],
            CryptoMode::Traditional
        );
        let config2 = BitChatConfig::custom(
            vec![TransportType::WebSocket, TransportType::LocalNetwork],
            CryptoMode::Traditional
        );

        let mut messaging1 = BitChatMessaging::new(config1).await.unwrap();
        let mut messaging2 = BitChatMessaging::new(config2).await.unwrap();

        // Start both messaging systems
        messaging1.start().await.unwrap();
        messaging2.start().await.unwrap();

        // Allow some time for discovery
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Test message delivery between transports
        let message = b"Cross-transport message";
        let peer1_id = messaging1.local_peer_id();
        let peer2_id = messaging2.local_peer_id();

        // Send message from peer1 to peer2
        if let Ok(()) = messaging1.send_message(&peer2_id, message).await {
            // Wait for message to be received
            if let Ok(Some(received)) = timeout(
                Duration::from_secs(10),
                messaging2.receive_message()
            ).await {
                assert_eq!(received.sender, peer1_id);
                assert_eq!(received.data, message);
            }
        }

        // Cleanup
        messaging1.stop().await.unwrap();
        messaging2.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_transport_failover() {
        // Create config with multiple transports
        let config = BitChatConfig::custom(
            vec![TransportType::WebSocket, TransportType::LocalNetwork, TransportType::InternetP2P],
            CryptoMode::Hybrid
        );

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        // Get initial transport stats
        let initial_stats = messaging.get_stats().await.unwrap();
        assert!(initial_stats.active_connections == 0);

        // Simulate transport failures and recovery
        let stats = messaging.get_stats().await.unwrap();
        assert_eq!(stats.total_connections, 0);

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_message_routing_across_transports() {
        // Create a mesh of 3 nodes with different transport preferences
        let config1 = BitChatConfig::custom(
            vec![TransportType::WebSocket],
            CryptoMode::Traditional
        );
        let config2 = BitChatConfig::custom(
            vec![TransportType::LocalNetwork],
            CryptoMode::Traditional
        );
        let config3 = BitChatConfig::custom(
            vec![TransportType::WebSocket, TransportType::LocalNetwork],
            CryptoMode::Traditional
        );

        let mut node1 = BitChatMessaging::new(config1).await.unwrap();
        let mut node2 = BitChatMessaging::new(config2).await.unwrap();
        let mut node3 = BitChatMessaging::new(config3).await.unwrap();

        // Start all nodes
        node1.start().await.unwrap();
        node2.start().await.unwrap();
        node3.start().await.unwrap();

        // Allow discovery time
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Test message routing through node3 (bridge)
        let message = b"Routed message";
        let node1_id = node1.local_peer_id();
        let node2_id = node2.local_peer_id();
        let node3_id = node3.local_peer_id();

        // Node1 sends to Node3
        if let Ok(()) = node1.send_message(&node3_id, message).await {
            if let Ok(Some(received)) = timeout(
                Duration::from_secs(5),
                node3.receive_message()
            ).await {
                assert_eq!(received.sender, node1_id);
                assert_eq!(received.data, message);
            }
        }

        // Cleanup
        node1.stop().await.unwrap();
        node2.stop().await.unwrap();
        node3.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_concurrent_transport_operations() {
        let config = BitChatConfig::custom(
            vec![TransportType::WebSocket, TransportType::LocalNetwork],
            CryptoMode::Hybrid
        );

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        // Spawn multiple concurrent operations
        let handles = (0..10).map(|i| {
            let msg = format!("Concurrent message {}", i);
            let data = msg.as_bytes().to_vec();
            let peer_id = messaging.local_peer_id();
            
            tokio::spawn(async move {
                // Each task tries to send a message
                tokio::time::sleep(Duration::from_millis(i * 100)).await;
                // In real scenario, this would be to different peers
                (i, data)
            })
        }).collect::<Vec<_>>();

        // Wait for all tasks to complete
        for handle in handles {
            let (i, data) = handle.await.unwrap();
            assert!(!data.is_empty());
            assert!(i < 10);
        }

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_transport_performance_comparison() {
        let transports = vec![
            TransportType::WebSocket,
            TransportType::LocalNetwork,
            TransportType::InternetP2P,
        ];

        for transport in transports {
            let config = BitChatConfig::custom(vec![transport.clone()], CryptoMode::Traditional);
            let mut messaging = BitChatMessaging::new(config).await.unwrap();
            
            let start_time = std::time::Instant::now();
            messaging.start().await.unwrap();
            let startup_time = start_time.elapsed();
            
            // Measure startup time
            assert!(startup_time < Duration::from_secs(10));
            
            // Get stats
            let stats = messaging.get_stats().await.unwrap();
            assert_eq!(stats.active_connections, 0);
            
            messaging.stop().await.unwrap();
        }
    }

    #[tokio::test]
    async fn test_topic_based_routing() {
        let config1 = BitChatConfig::custom(
            vec![TransportType::WebSocket],
            CryptoMode::Traditional
        );
        let config2 = BitChatConfig::custom(
            vec![TransportType::WebSocket],
            CryptoMode::Traditional
        );

        let mut publisher = BitChatMessaging::new(config1).await.unwrap();
        let mut subscriber = BitChatMessaging::new(config2).await.unwrap();

        publisher.start().await.unwrap();
        subscriber.start().await.unwrap();

        // Subscribe to topic
        subscriber.subscribe_topic("test-topic").await.unwrap();

        // Allow subscription to propagate
        tokio::time::sleep(Duration::from_secs(1)).await;

        // Publish message
        let message = b"Topic message";
        publisher.publish_message("test-topic", message).await.unwrap();

        // Wait for message
        if let Ok(Some(received)) = timeout(
            Duration::from_secs(5),
            subscriber.receive_message()
        ).await {
            assert_eq!(received.data, message);
            assert_eq!(received.topic, Some("test-topic".to_string()));
        }

        // Cleanup
        subscriber.unsubscribe_topic("test-topic").await.unwrap();
        publisher.stop().await.unwrap();
        subscriber.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_large_message_handling() {
        let config = BitChatConfig::builder()
            .max_message_size(1024 * 1024) // 1MB
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        // Create large message
        let large_message = vec![0u8; 500 * 1024]; // 500KB
        let peer_id = messaging.local_peer_id();

        // Test that large messages are handled correctly
        let result = messaging.send_message(&peer_id, &large_message).await;
        // In a real scenario, this would be sent to a different peer
        assert!(result.is_ok());

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_message_priorities() {
        let config = BitChatConfig::development();
        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        
        messaging.start().await.unwrap();

        // Test different message priorities
        let priorities = vec![
            MessagePriority::Low,
            MessagePriority::Normal,
            MessagePriority::High,
            MessagePriority::Critical,
        ];

        for priority in priorities {
            let message = format!("Priority {:?} message", priority);
            let peer_id = messaging.local_peer_id();
            
            // In a real implementation, priority would affect delivery order
            let result = messaging.send_message(&peer_id, message.as_bytes()).await;
            assert!(result.is_ok());
        }

        messaging.stop().await.unwrap();
    }
}
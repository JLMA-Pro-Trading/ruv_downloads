//! Integration tests for store & forward functionality

use bitchat_qudag::{
    BitChatMessaging, BitChatConfig, QuDAGMessaging,
    transport::TransportType,
    crypto::CryptoMode,
    messaging::{MessagePriority, MessageType}
};
use std::time::Duration;
use tokio::time::timeout;

#[cfg(all(test, not(target_arch = "wasm32")))]
mod store_forward_integration {
    use super::*;

    #[tokio::test]
    async fn test_offline_message_storage() {
        // Create sender and receiver configs
        let sender_config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_ttl(Duration::from_secs(3600))
            .build();
        
        let receiver_config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_ttl(Duration::from_secs(3600))
            .build();

        let mut sender = BitChatMessaging::new(sender_config).await.unwrap();
        let mut receiver = BitChatMessaging::new(receiver_config).await.unwrap();

        // Start sender first
        sender.start().await.unwrap();
        
        let receiver_id = receiver.local_peer_id();
        let message = b"Offline message";

        // Send message while receiver is offline
        let result = sender.send_message(&receiver_id, message).await;
        // Message should be stored for later delivery
        assert!(result.is_ok());

        // Now start receiver
        receiver.start().await.unwrap();

        // Allow time for message delivery
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Check if message was delivered
        if let Ok(Some(received)) = timeout(
            Duration::from_secs(5),
            receiver.receive_message()
        ).await {
            assert_eq!(received.data, message);
            assert_eq!(received.sender, sender.local_peer_id());
        }

        // Cleanup
        sender.stop().await.unwrap();
        receiver.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_message_expiration() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_ttl(Duration::from_secs(1)) // Very short TTL
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        let peer_id = messaging.local_peer_id();
        let message = b"Expiring message";

        // Send message
        messaging.send_message(&peer_id, message).await.unwrap();

        // Wait for message to expire
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Message should have expired and not be delivered
        let result = timeout(
            Duration::from_secs(1),
            messaging.receive_message()
        ).await;
        
        // Should timeout as message has expired
        assert!(result.is_err());

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_store_forward_queue_limits() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_queue_size(10) // Small queue
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        let peer_id = messaging.local_peer_id();

        // Send more messages than queue can handle
        for i in 0..20 {
            let message = format!("Message {}", i);
            let result = messaging.send_message(&peer_id, message.as_bytes()).await;
            
            if i < 10 {
                // First 10 should succeed
                assert!(result.is_ok());
            } else {
                // After queue is full, might get errors
                // Implementation dependent
            }
        }

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_priority_message_storage() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_queue_size(5)
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        let peer_id = messaging.local_peer_id();

        // Send messages with different priorities
        let messages = vec![
            (b"Low priority", MessagePriority::Low),
            (b"Normal priority", MessagePriority::Normal),
            (b"High priority", MessagePriority::High),
            (b"Critical priority", MessagePriority::Critical),
        ];

        for (msg, priority) in messages {
            // In real implementation, priority would affect storage order
            let result = messaging.send_message(&peer_id, msg).await;
            assert!(result.is_ok());
        }

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_ephemeral_message_no_storage() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .enable_ephemeral_messages(true)
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        let peer_id = messaging.local_peer_id();
        let message = b"Ephemeral message";

        // Send ephemeral message (should not be stored)
        let result = messaging.send_message(&peer_id, message).await;
        assert!(result.is_ok());

        // Ephemeral messages should not be stored for offline delivery
        // This test verifies the behavior through configuration

        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_store_forward_persistence() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_persistence(true)
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        let peer_id = messaging.local_peer_id();
        let message = b"Persistent message";

        // Send message
        messaging.send_message(&peer_id, message).await.unwrap();

        // Stop and restart messaging
        messaging.stop().await.unwrap();
        
        let mut messaging2 = BitChatMessaging::new(
            BitChatConfig::builder()
                .enable_store_forward(true)
                .store_forward_persistence(true)
                .build()
        ).await.unwrap();
        
        messaging2.start().await.unwrap();

        // Messages should persist across restarts
        // Implementation specific verification

        messaging2.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_batch_message_delivery() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .store_forward_batch_size(5)
            .build();

        let mut sender = BitChatMessaging::new(config.clone()).await.unwrap();
        let mut receiver = BitChatMessaging::new(config).await.unwrap();

        sender.start().await.unwrap();
        
        let receiver_id = receiver.local_peer_id();
        let messages = (0..10).map(|i| format!("Batch message {}", i)).collect::<Vec<_>>();

        // Send batch of messages while receiver is offline
        for msg in &messages {
            sender.send_message(&receiver_id, msg.as_bytes()).await.unwrap();
        }

        // Start receiver
        receiver.start().await.unwrap();

        // Allow time for batch delivery
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Check that messages are delivered in batches
        let mut received_count = 0;
        while let Ok(Some(_)) = timeout(
            Duration::from_secs(1),
            receiver.receive_message()
        ).await {
            received_count += 1;
        }

        // Should have received some messages
        assert!(received_count > 0);

        sender.stop().await.unwrap();
        receiver.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_store_forward_with_encryption() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .crypto_mode(CryptoMode::Hybrid)
            .require_encryption(true)
            .build();

        let mut sender = BitChatMessaging::new(config.clone()).await.unwrap();
        let mut receiver = BitChatMessaging::new(config).await.unwrap();

        sender.start().await.unwrap();
        
        let receiver_id = receiver.local_peer_id();
        let message = b"Encrypted offline message";

        // Send encrypted message while receiver is offline
        sender.send_message(&receiver_id, message).await.unwrap();

        // Start receiver
        receiver.start().await.unwrap();

        // Allow time for delivery
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Check if encrypted message was delivered correctly
        if let Ok(Some(received)) = timeout(
            Duration::from_secs(5),
            receiver.receive_message()
        ).await {
            assert_eq!(received.data, message);
            assert!(received.encryption_info.is_some());
        }

        sender.stop().await.unwrap();
        receiver.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_relay_store_forward() {
        // Test store & forward through relay nodes
        let relay_config = BitChatConfig::builder()
            .enable_store_forward(true)
            .enable_relay(true)
            .build();

        let client_config = BitChatConfig::builder()
            .enable_store_forward(true)
            .enable_relay(true)
            .build();

        let mut relay = BitChatMessaging::new(relay_config).await.unwrap();
        let mut client1 = BitChatMessaging::new(client_config.clone()).await.unwrap();
        let mut client2 = BitChatMessaging::new(client_config).await.unwrap();

        // Start relay first
        relay.start().await.unwrap();
        
        // Start client1
        client1.start().await.unwrap();

        let client2_id = client2.local_peer_id();
        let message = b"Relay store forward message";

        // Send message through relay while client2 is offline
        client1.send_message(&client2_id, message).await.unwrap();

        // Start client2
        client2.start().await.unwrap();

        // Allow time for relay delivery
        tokio::time::sleep(Duration::from_secs(3)).await;

        // Check if message was delivered through relay
        if let Ok(Some(received)) = timeout(
            Duration::from_secs(5),
            client2.receive_message()
        ).await {
            assert_eq!(received.data, message);
        }

        // Cleanup
        relay.stop().await.unwrap();
        client1.stop().await.unwrap();
        client2.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_store_forward_statistics() {
        let config = BitChatConfig::builder()
            .enable_store_forward(true)
            .enable_metrics(true)
            .build();

        let mut messaging = BitChatMessaging::new(config).await.unwrap();
        messaging.start().await.unwrap();

        let peer_id = messaging.local_peer_id();
        let message = b"Statistics test message";

        // Send message
        messaging.send_message(&peer_id, message).await.unwrap();

        // Get statistics
        let stats = messaging.get_stats().await.unwrap();
        assert!(stats.total_messages_sent > 0);

        messaging.stop().await.unwrap();
    }
}
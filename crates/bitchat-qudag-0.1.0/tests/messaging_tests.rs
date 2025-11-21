//! Unit tests for messaging operations

use bitchat_qudag::config::BitChatConfig;
use bitchat_qudag::crypto::CryptoMode;
use bitchat_qudag::messaging::{
    BitChatMessaging, CompressionInfo, EncryptionInfo, MessagePriority, MessageType,
    MessagingStats, PeerInfo, QuDAGMessaging, ReceivedMessage,
};
use proptest::prelude::*;
use std::time::SystemTime;

#[cfg(test)]
mod message_priority_tests {
    use super::*;

    #[test]
    fn test_message_priority_ordering() {
        assert!(MessagePriority::Critical > MessagePriority::High);
        assert!(MessagePriority::High > MessagePriority::Normal);
        assert!(MessagePriority::Normal > MessagePriority::Low);
    }

    #[test]
    fn test_message_priority_default() {
        let priority = MessagePriority::default();
        assert_eq!(priority, MessagePriority::Normal);
    }

    #[test]
    fn test_message_priority_serialization() {
        let priorities = vec![
            MessagePriority::Low,
            MessagePriority::Normal,
            MessagePriority::High,
            MessagePriority::Critical,
        ];

        for priority in priorities {
            let serialized = serde_json::to_string(&priority).unwrap();
            let deserialized: MessagePriority = serde_json::from_str(&serialized).unwrap();
            assert_eq!(priority, deserialized);
        }
    }
}

#[cfg(test)]
mod message_type_tests {
    use super::*;

    #[test]
    fn test_message_type_default() {
        let msg_type = MessageType::default();
        assert_eq!(msg_type, MessageType::Direct);
    }

    #[test]
    fn test_message_type_serialization() {
        let types = vec![
            MessageType::Direct,
            MessageType::Broadcast,
            MessageType::Topic("test-topic".to_string()),
            MessageType::System,
            MessageType::Ephemeral,
        ];

        for msg_type in types {
            let serialized = serde_json::to_string(&msg_type).unwrap();
            let deserialized: MessageType = serde_json::from_str(&serialized).unwrap();
            assert_eq!(msg_type, deserialized);
        }
    }
}

#[cfg(test)]
mod received_message_tests {
    use super::*;

    #[test]
    fn test_received_message_creation() {
        let msg = ReceivedMessage {
            id: "test-id".to_string(),
            sender: "sender-peer".to_string(),
            recipient: "recipient-peer".to_string(),
            topic: Some("test-topic".to_string()),
            data: vec![1, 2, 3, 4, 5],
            timestamp: SystemTime::now(),
            is_ephemeral: false,
            priority: MessagePriority::Normal,
            message_type: MessageType::Direct,
            encryption_info: Some(EncryptionInfo {
                algorithm: "ChaCha20Poly1305".to_string(),
                key_exchange: "X25519".to_string(),
                ephemeral_key: vec![0; 32],
            }),
            compression_info: Some(CompressionInfo {
                algorithm: "lz4".to_string(),
                original_size: 100,
                compressed_size: 50,
            }),
        };

        assert_eq!(msg.id, "test-id");
        assert_eq!(msg.sender, "sender-peer");
        assert_eq!(msg.recipient, "recipient-peer");
        assert_eq!(msg.data, vec![1, 2, 3, 4, 5]);
        assert!(!msg.is_ephemeral);
    }

    #[test]
    fn test_received_message_serialization() {
        let msg = ReceivedMessage {
            id: "msg-123".to_string(),
            sender: "peer-1".to_string(),
            recipient: "peer-2".to_string(),
            topic: None,
            data: b"Hello BitChat".to_vec(),
            timestamp: SystemTime::now(),
            is_ephemeral: true,
            priority: MessagePriority::High,
            message_type: MessageType::Ephemeral,
            encryption_info: None,
            compression_info: None,
        };

        let serialized = serde_json::to_string(&msg).unwrap();
        let deserialized: ReceivedMessage = serde_json::from_str(&serialized).unwrap();

        assert_eq!(msg.id, deserialized.id);
        assert_eq!(msg.sender, deserialized.sender);
        assert_eq!(msg.recipient, deserialized.recipient);
        assert_eq!(msg.data, deserialized.data);
        assert_eq!(msg.is_ephemeral, deserialized.is_ephemeral);
        assert_eq!(msg.priority, deserialized.priority);
    }
}

#[cfg(test)]
mod peer_info_tests {
    use super::*;

    #[test]
    fn test_peer_info_creation() {
        let peer = PeerInfo {
            id: "peer-123".to_string(),
            address: "/ip4/127.0.0.1/tcp/4001".to_string(),
            transport_type: bitchat_qudag::transport::TransportType::InternetP2P,
            connected_at: SystemTime::now(),
            last_seen: SystemTime::now(),
            messages_sent: 10,
            messages_received: 15,
            bytes_sent: 1024,
            bytes_received: 2048,
            latency_ms: Some(25.5),
            protocols: vec!["bitchat/1.0".to_string()],
            user_agent: Some("BitChat-QuDAG/0.1.0".to_string()),
        };

        assert_eq!(peer.id, "peer-123");
        assert_eq!(peer.messages_sent, 10);
        assert_eq!(peer.messages_received, 15);
        assert_eq!(peer.latency_ms, Some(25.5));
    }

    #[test]
    fn test_peer_info_serialization() {
        let peer = PeerInfo {
            id: "test-peer".to_string(),
            address: "127.0.0.1:8080".to_string(),
            transport_type: bitchat_qudag::transport::TransportType::WebSocket,
            connected_at: SystemTime::now(),
            last_seen: SystemTime::now(),
            messages_sent: 0,
            messages_received: 0,
            bytes_sent: 0,
            bytes_received: 0,
            latency_ms: None,
            protocols: vec![],
            user_agent: None,
        };

        let serialized = serde_json::to_string(&peer).unwrap();
        let deserialized: PeerInfo = serde_json::from_str(&serialized).unwrap();

        assert_eq!(peer.id, deserialized.id);
        assert_eq!(peer.address, deserialized.address);
        assert_eq!(peer.transport_type, deserialized.transport_type);
    }
}

#[cfg(test)]
mod messaging_stats_tests {
    use super::*;

    #[test]
    fn test_messaging_stats_creation() {
        let stats = MessagingStats {
            total_messages_sent: 100,
            total_messages_received: 150,
            total_bytes_sent: 10240,
            total_bytes_received: 20480,
            active_connections: 5,
            total_connections: 10,
            failed_connections: 2,
            uptime_seconds: 3600,
            topics_subscribed: 3,
            ephemeral_messages_sent: 10,
            ephemeral_messages_received: 15,
            cover_traffic_sent: 20,
            average_latency_ms: 35.5,
        };

        assert_eq!(stats.total_messages_sent, 100);
        assert_eq!(stats.total_messages_received, 150);
        assert_eq!(stats.active_connections, 5);
        assert_eq!(stats.average_latency_ms, 35.5);
    }

    #[test]
    fn test_messaging_stats_serialization() {
        let stats = MessagingStats::default();

        let serialized = serde_json::to_string(&stats).unwrap();
        let deserialized: MessagingStats = serde_json::from_str(&serialized).unwrap();

        assert_eq!(stats.total_messages_sent, deserialized.total_messages_sent);
        assert_eq!(stats.active_connections, deserialized.active_connections);
        assert_eq!(stats.uptime_seconds, deserialized.uptime_seconds);
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod bitchat_messaging_tests {
    use super::*;

    #[tokio::test]
    async fn test_bitchat_messaging_creation() {
        let config = BitChatConfig::development();
        let messaging = BitChatMessaging::new(config).await.unwrap();
        assert!(!messaging.local_peer_id().is_empty());
    }

    #[tokio::test]
    async fn test_bitchat_messaging_lifecycle() {
        let config = BitChatConfig::development();
        let mut messaging = BitChatMessaging::new(config).await.unwrap();

        // Start messaging
        messaging.start().await.unwrap();

        // Get stats
        let stats = messaging.get_stats().await.unwrap();
        assert_eq!(stats.active_connections, 0);

        // Stop messaging
        messaging.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_topic_subscription() {
        let config = BitChatConfig::development();
        let mut messaging = BitChatMessaging::new(config).await.unwrap();

        messaging.start().await.unwrap();

        // Subscribe to topic
        messaging.subscribe_topic("test-topic").await.unwrap();

        // Unsubscribe from topic
        messaging.unsubscribe_topic("test-topic").await.unwrap();

        messaging.stop().await.unwrap();
    }
}

// Property-based tests
proptest! {
    #[test]
    fn test_message_priority_consistency(
        priority in prop::sample::select(vec![
            MessagePriority::Low,
            MessagePriority::Normal,
            MessagePriority::High,
            MessagePriority::Critical
        ])
    ) {
        // Test serialization consistency
        let serialized = serde_json::to_string(&priority).unwrap();
        let deserialized: MessagePriority = serde_json::from_str(&serialized).unwrap();
        prop_assert_eq!(priority, deserialized);
    }

    #[test]
    fn test_peer_info_consistency(
        id: String,
        messages_sent: u64,
        messages_received: u64,
        bytes_sent: u64,
        bytes_received: u64,
        latency_ms in prop::option::of(0.0..1000.0f64)
    ) {
        let peer = PeerInfo {
            id: id.clone(),
            address: "test-address".to_string(),
            transport_type: bitchat_qudag::transport::TransportType::InternetP2P,
            connected_at: SystemTime::now(),
            last_seen: SystemTime::now(),
            messages_sent,
            messages_received,
            bytes_sent,
            bytes_received,
            latency_ms,
            protocols: vec![],
            user_agent: None,
        };

        let serialized = serde_json::to_string(&peer).unwrap();
        let deserialized: PeerInfo = serde_json::from_str(&serialized).unwrap();

        prop_assert_eq!(peer.id, deserialized.id);
        prop_assert_eq!(peer.messages_sent, deserialized.messages_sent);
        prop_assert_eq!(peer.messages_received, deserialized.messages_received);
        prop_assert_eq!(peer.bytes_sent, deserialized.bytes_sent);
        prop_assert_eq!(peer.bytes_received, deserialized.bytes_received);
    }
}

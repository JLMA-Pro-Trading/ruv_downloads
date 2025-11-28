//! Unit tests for transport implementations

use bitchat_qudag::config::BitChatConfig;
use bitchat_qudag::transport::{MultiTransport, TransportStats, TransportStatus, TransportType};
use proptest::prelude::*;

#[cfg(test)]
mod transport_type_tests {
    use super::*;

    #[test]
    fn test_transport_type_serialization() {
        let transport_types = vec![
            TransportType::InternetP2P,
            TransportType::BluetoothMesh,
            TransportType::LocalNetwork,
            TransportType::WebSocket,
            TransportType::Relay,
        ];

        for transport_type in transport_types {
            let serialized = serde_json::to_string(&transport_type).unwrap();
            let deserialized: TransportType = serde_json::from_str(&serialized).unwrap();
            assert_eq!(transport_type, deserialized);
        }
    }

    #[::test_case::test_case(TransportType::InternetP2P)]
    #[::test_case::test_case(TransportType::BluetoothMesh)]
    #[::test_case::test_case(TransportType::LocalNetwork)]
    #[::test_case::test_case(TransportType::WebSocket)]
    #[::test_case::test_case(TransportType::Relay)]
    fn test_transport_type_hash(transport_type: TransportType) {
        use std::collections::HashMap;
        let mut map = HashMap::new();
        map.insert(transport_type.clone(), 1);
        assert_eq!(map.get(&transport_type), Some(&1));
    }
}

#[cfg(test)]
mod transport_status_tests {
    use super::*;

    #[test]
    fn test_transport_status_states() {
        let statuses = vec![
            TransportStatus::Inactive,
            TransportStatus::Starting,
            TransportStatus::Active,
            TransportStatus::Stopping,
            TransportStatus::Failed("Connection error".to_string()),
        ];

        for status in statuses {
            let serialized = serde_json::to_string(&status).unwrap();
            let deserialized: TransportStatus = serde_json::from_str(&serialized).unwrap();
            assert_eq!(status, deserialized);
        }
    }

    #[test]
    fn test_transport_status_equality() {
        assert_eq!(TransportStatus::Active, TransportStatus::Active);
        assert_ne!(TransportStatus::Active, TransportStatus::Inactive);
        assert_eq!(
            TransportStatus::Failed("error".to_string()),
            TransportStatus::Failed("error".to_string())
        );
    }
}

#[cfg(test)]
mod transport_stats_tests {
    use super::*;

    #[test]
    fn test_transport_stats_default() {
        let stats = TransportStats::default();
        assert_eq!(stats.transport_type, TransportType::InternetP2P);
        assert_eq!(stats.status, TransportStatus::Inactive);
        assert_eq!(stats.connected_peers, 0);
        assert_eq!(stats.messages_sent, 0);
        assert_eq!(stats.messages_received, 0);
        assert_eq!(stats.bytes_sent, 0);
        assert_eq!(stats.bytes_received, 0);
        assert_eq!(stats.connection_attempts, 0);
        assert_eq!(stats.successful_connections, 0);
        assert_eq!(stats.failed_connections, 0);
        assert_eq!(stats.average_latency, 0.0);
    }

    #[test]
    fn test_transport_stats_serialization() {
        let mut stats = TransportStats::default();
        stats.connected_peers = 5;
        stats.messages_sent = 100;
        stats.messages_received = 150;
        stats.average_latency = 25.5;

        let serialized = serde_json::to_string(&stats).unwrap();
        let deserialized: TransportStats = serde_json::from_str(&serialized).unwrap();

        assert_eq!(stats.connected_peers, deserialized.connected_peers);
        assert_eq!(stats.messages_sent, deserialized.messages_sent);
        assert_eq!(stats.messages_received, deserialized.messages_received);
        assert_eq!(stats.average_latency, deserialized.average_latency);
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod multi_transport_tests {
    use super::*;

    #[tokio::test]
    async fn test_multi_transport_creation() {
        let config = BitChatConfig::development();
        let multi_transport = MultiTransport::new(&config).await.unwrap();
        let peer_id = multi_transport.get_local_peer_id();
        assert!(!peer_id.is_empty());
    }

    #[tokio::test]
    async fn test_multi_transport_lifecycle() {
        let config = BitChatConfig::development();
        let mut multi_transport = MultiTransport::new(&config).await.unwrap();

        // Start transport
        multi_transport.start().await.unwrap();

        // Get stats
        let stats = multi_transport.get_stats().await;
        for (_, stat) in stats {
            assert!(matches!(
                stat.status,
                TransportStatus::Active | TransportStatus::Starting
            ));
        }

        // Stop transport
        multi_transport.stop().await.unwrap();
    }

    #[tokio::test]
    async fn test_multi_transport_peer_management() {
        let config = BitChatConfig::development();
        let mut multi_transport = MultiTransport::new(&config).await.unwrap();

        multi_transport.start().await.unwrap();

        // Check if a non-existent peer is connected
        let is_connected = multi_transport
            .is_peer_connected("nonexistent")
            .await
            .unwrap();
        assert!(!is_connected);

        // Get connected peers (should be empty initially)
        let peers = multi_transport.get_connected_peers().await.unwrap();
        assert_eq!(peers.len(), 0);

        multi_transport.stop().await.unwrap();
    }
}

// Property-based tests using proptest
proptest! {
    #[cfg(test)]
    #[test]
    fn test_transport_stats_consistency(
        connected_peers in 0..1000usize,
        messages_sent in 0..10000u64,
        messages_received in 0..10000u64,
        bytes_sent in 0..1000000u64,
        bytes_received in 0..1000000u64,
        connection_attempts in 0..1000u64,
        successful_connections in 0..1000u64,
        failed_connections in 0..1000u64,
        average_latency in 0.0..1000.0f64,
    ) {
        let mut stats = TransportStats::default();
        stats.connected_peers = connected_peers;
        stats.messages_sent = messages_sent;
        stats.messages_received = messages_received;
        stats.bytes_sent = bytes_sent;
        stats.bytes_received = bytes_received;
        stats.connection_attempts = connection_attempts;
        stats.successful_connections = successful_connections;
        stats.failed_connections = failed_connections;
        stats.average_latency = average_latency;

        // Verify serialization roundtrip
        let serialized = serde_json::to_string(&stats).unwrap();
        let deserialized: TransportStats = serde_json::from_str(&serialized).unwrap();

        assert_eq!(stats.connected_peers, deserialized.connected_peers);
        assert_eq!(stats.messages_sent, deserialized.messages_sent);
        assert_eq!(stats.messages_received, deserialized.messages_received);
        assert_eq!(stats.bytes_sent, deserialized.bytes_sent);
        assert_eq!(stats.bytes_received, deserialized.bytes_received);
        assert_eq!(stats.connection_attempts, deserialized.connection_attempts);
        assert_eq!(stats.successful_connections, deserialized.successful_connections);
        assert_eq!(stats.failed_connections, deserialized.failed_connections);
        assert!((stats.average_latency - deserialized.average_latency).abs() < f64::EPSILON);

        // Verify consistency rules
        assert!(stats.successful_connections + stats.failed_connections <= stats.connection_attempts);
    }
}

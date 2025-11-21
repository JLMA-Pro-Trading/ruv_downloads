//! Unit tests for configuration validation

use bitchat_qudag::config::{
    BitChatConfig, CryptoConfig, NetworkConfig, PrivacyConfig, TransportConfig,
};
use bitchat_qudag::crypto::CryptoMode;
use bitchat_qudag::transport::TransportType;
use proptest::prelude::*;
use std::time::Duration;

#[cfg(test)]
mod bitchat_config_tests {
    use super::*;

    #[test]
    fn test_config_development() {
        let config = BitChatConfig::development();
        assert!(config.enabled);
        assert!(config.auto_start);
        assert!(config.enable_metrics);
        assert!(config.verbose_logging);
    }

    #[test]
    fn test_config_production() {
        let config = BitChatConfig::production();
        assert!(config.enabled);
        assert!(config.auto_start);
        assert!(config.enable_metrics);
        assert!(!config.verbose_logging);
    }

    #[test]
    fn test_config_testing() {
        let config = BitChatConfig::testing();
        assert!(config.enabled);
        assert!(!config.auto_start);
        assert!(config.enable_metrics);
        assert!(config.verbose_logging);
    }

    #[test]
    fn test_config_custom() {
        let transports = vec![TransportType::WebSocket, TransportType::LocalNetwork];
        let config = BitChatConfig::custom(transports.clone(), CryptoMode::Hybrid);

        assert!(config.enabled);
        assert_eq!(config.crypto.mode, CryptoMode::Hybrid);
        assert_eq!(config.transport.enabled_transports, transports);
    }

    #[test]
    fn test_config_builder() {
        let config = BitChatConfig::builder()
            .enabled(false)
            .auto_start(false)
            .max_message_size(2048)
            .crypto_mode(CryptoMode::QuantumResistant)
            .enable_compression(false)
            .build();

        assert!(!config.enabled);
        assert!(!config.auto_start);
        assert_eq!(config.max_message_size, 2048);
        assert_eq!(config.crypto.mode, CryptoMode::QuantumResistant);
        assert!(!config.crypto.enable_compression);
    }

    #[test]
    fn test_config_serialization() {
        let config = BitChatConfig::development();

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: BitChatConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.enabled, deserialized.enabled);
        assert_eq!(config.auto_start, deserialized.auto_start);
        assert_eq!(config.max_message_size, deserialized.max_message_size);
        assert_eq!(config.crypto.mode, deserialized.crypto.mode);
    }

    #[test]
    fn test_config_validation() {
        let mut config = BitChatConfig::development();
        assert!(config.validate().is_ok());

        // Test invalid max message size
        config.max_message_size = 0;
        assert!(config.validate().is_err());
        config.max_message_size = 1024 * 1024; // Reset

        // Test invalid message queue size
        config.message_queue_size = 0;
        assert!(config.validate().is_err());
        config.message_queue_size = 1000; // Reset

        // Test no enabled transports
        config.transport.enabled_transports.clear();
        assert!(config.validate().is_err());
    }
}

#[cfg(test)]
mod transport_config_tests {
    use super::*;

    #[test]
    fn test_transport_config_default() {
        let config = TransportConfig::default();
        assert_eq!(config.enabled_transports.len(), 1);
        assert_eq!(config.enabled_transports[0], TransportType::InternetP2P);
        assert_eq!(config.max_connections, 50);
        assert!(config.enable_relay);
    }

    #[test]
    fn test_transport_config_serialization() {
        let config = TransportConfig {
            enabled_transports: vec![TransportType::WebSocket, TransportType::BluetoothMesh],
            max_connections: 100,
            connection_timeout: Duration::from_secs(30),
            ping_interval: Duration::from_secs(60),
            enable_relay: false,
            relay_nodes: vec!["relay1".to_string(), "relay2".to_string()],
        };

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: TransportConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.enabled_transports, deserialized.enabled_transports);
        assert_eq!(config.max_connections, deserialized.max_connections);
        assert_eq!(config.enable_relay, deserialized.enable_relay);
        assert_eq!(config.relay_nodes, deserialized.relay_nodes);
    }
}

#[cfg(test)]
mod crypto_config_tests {
    use super::*;

    #[test]
    fn test_crypto_config_default() {
        let config = CryptoConfig::default();
        assert_eq!(config.mode, CryptoMode::Hybrid);
        assert!(config.enable_compression);
        assert!(config.enable_signing);
        assert!(config.require_encryption);
        assert_eq!(config.key_rotation_interval, Duration::from_secs(86400));
    }

    #[test]
    fn test_crypto_config_serialization() {
        let config = CryptoConfig {
            mode: CryptoMode::QuantumResistant,
            enable_compression: false,
            compression_level: 9,
            enable_signing: true,
            require_encryption: true,
            key_rotation_interval: Duration::from_secs(3600),
            pbkdf2_iterations: 200000,
        };

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: CryptoConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.mode, deserialized.mode);
        assert_eq!(config.enable_compression, deserialized.enable_compression);
        assert_eq!(config.compression_level, deserialized.compression_level);
        assert_eq!(config.pbkdf2_iterations, deserialized.pbkdf2_iterations);
    }
}

#[cfg(test)]
mod network_config_tests {
    use super::*;

    #[test]
    fn test_network_config_default() {
        let config = NetworkConfig::default();
        assert!(config.enable_mdns);
        assert!(config.enable_upnp);
        assert_eq!(config.listen_addresses.len(), 2);
        assert!(config.enable_ipv6);
    }

    #[test]
    fn test_network_config_serialization() {
        let config = NetworkConfig {
            enable_mdns: false,
            enable_upnp: false,
            listen_addresses: vec!["/ip4/0.0.0.0/tcp/0".to_string()],
            bootstrap_peers: vec!["peer1".to_string(), "peer2".to_string()],
            enable_ipv6: false,
            max_packet_size: 2048,
        };

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: NetworkConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.enable_mdns, deserialized.enable_mdns);
        assert_eq!(config.listen_addresses, deserialized.listen_addresses);
        assert_eq!(config.bootstrap_peers, deserialized.bootstrap_peers);
        assert_eq!(config.max_packet_size, deserialized.max_packet_size);
    }
}

#[cfg(test)]
mod privacy_config_tests {
    use super::*;

    #[test]
    fn test_privacy_config_default() {
        let config = PrivacyConfig::default();
        assert!(config.enable_ephemeral);
        assert!(config.enable_forward_secrecy);
        assert!(config.enable_cover_traffic);
        assert_eq!(config.ephemeral_ttl, Duration::from_secs(300));
        assert_eq!(config.cover_traffic_interval, Duration::from_secs(60));
    }

    #[test]
    fn test_privacy_config_high_privacy() {
        let config = PrivacyConfig::high_privacy();
        assert!(config.enable_ephemeral);
        assert!(config.enable_forward_secrecy);
        assert!(config.enable_cover_traffic);
        assert!(config.require_authentication);
        assert_eq!(config.ephemeral_ttl, Duration::from_secs(60));
        assert_eq!(config.cover_traffic_percentage, 0.2);
    }

    #[test]
    fn test_privacy_config_serialization() {
        let config = PrivacyConfig {
            enable_ephemeral: true,
            ephemeral_ttl: Duration::from_secs(120),
            enable_forward_secrecy: true,
            enable_cover_traffic: false,
            cover_traffic_interval: Duration::from_secs(30),
            cover_traffic_percentage: 0.15,
            enable_anonymous_mode: true,
            require_authentication: false,
        };

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: PrivacyConfig = serde_json::from_str(&serialized).unwrap();

        assert_eq!(config.enable_ephemeral, deserialized.enable_ephemeral);
        assert_eq!(
            config.enable_anonymous_mode,
            deserialized.enable_anonymous_mode
        );
        assert_eq!(
            config.cover_traffic_percentage,
            deserialized.cover_traffic_percentage
        );
    }
}

// Property-based tests
proptest! {
    #[test]
    fn test_config_max_message_size(size in 1usize..10_000_000) {
        let config = BitChatConfig::builder()
            .max_message_size(size)
            .build();

        assert_eq!(config.max_message_size, size);

        // Validate config
        let result = config.validate();
        if size == 0 {
            prop_assert!(result.is_err());
        } else {
            prop_assert!(result.is_ok());
        }
    }

    #[test]
    fn test_config_message_queue_size(queue_size in 1usize..100_000) {
        let config = BitChatConfig::builder()
            .message_queue_size(queue_size)
            .build();

        assert_eq!(config.message_queue_size, queue_size);

        // Validate config
        let result = config.validate();
        if queue_size == 0 {
            prop_assert!(result.is_err());
        } else {
            prop_assert!(result.is_ok());
        }
    }

    #[test]
    fn test_transport_config_max_connections(max_conn in 1u32..10_000) {
        let mut config = TransportConfig::default();
        config.max_connections = max_conn;

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: TransportConfig = serde_json::from_str(&serialized).unwrap();

        prop_assert_eq!(config.max_connections, deserialized.max_connections);
    }

    #[test]
    fn test_crypto_config_compression_level(level in 1u32..=9) {
        let mut config = CryptoConfig::default();
        config.compression_level = level;

        let serialized = serde_json::to_string(&config).unwrap();
        let deserialized: CryptoConfig = serde_json::from_str(&serialized).unwrap();

        prop_assert_eq!(config.compression_level, deserialized.compression_level);
    }
}

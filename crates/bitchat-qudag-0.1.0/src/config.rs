//! Configuration management for BitChat-QuDAG integration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

use crate::crypto::CryptoMode;
use crate::error::{BitChatError, Result};
use crate::transport::TransportType;

/// Comprehensive configuration for BitChat integration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BitChatConfig {
    /// Enable BitChat messaging
    pub enabled: bool,

    /// Cryptographic mode to use
    pub crypto_mode: CryptoMode,

    /// Enabled transport types
    pub transports: Vec<TransportType>,

    /// Enable store & forward for offline messaging
    pub store_forward: bool,

    /// Enable cover traffic for privacy
    pub cover_traffic: bool,

    /// Enable message compression
    pub compression: bool,

    /// Enable ephemeral messaging
    pub ephemeral_messages: bool,

    /// Enable emergency data wipe
    pub emergency_wipe: bool,

    /// Maximum message size in bytes
    pub max_message_size: usize,

    /// Message timeout duration
    pub message_timeout: Duration,

    /// Maximum number of peers to connect to
    pub max_peers: usize,

    /// Heartbeat interval for peer keepalive
    pub heartbeat_interval: Duration,

    /// Store & forward message TTL
    pub store_forward_ttl: Duration,

    /// Cover traffic generation interval
    pub cover_traffic_interval: Duration,

    /// Compression threshold (compress messages larger than this)
    pub compression_threshold: usize,

    /// Network interface to bind to
    pub bind_address: String,

    /// Port to listen on
    pub listen_port: u16,

    /// Bootstrap peers to connect to
    pub bootstrap_peers: Vec<String>,

    /// Transport-specific configurations
    pub transport_configs: HashMap<TransportType, TransportConfig>,

    /// Privacy settings
    pub privacy: PrivacyConfig,

    /// Performance settings
    pub performance: PerformanceConfig,

    /// Security settings
    pub security: SecurityConfig,

    /// Logging configuration
    pub logging: LoggingConfig,
}

/// Transport-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransportConfig {
    /// Enable this transport
    pub enabled: bool,

    /// Transport-specific settings
    pub settings: HashMap<String, serde_json::Value>,

    /// Connection timeout
    pub timeout: Duration,

    /// Maximum retry attempts
    pub max_retries: u32,

    /// Retry backoff multiplier
    pub retry_backoff: f64,
}

/// Privacy configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyConfig {
    /// Enable metadata protection
    pub metadata_protection: bool,

    /// Enable message padding
    pub message_padding: bool,

    /// Enable timing obfuscation
    pub timing_obfuscation: bool,

    /// Enable anonymous routing
    pub anonymous_routing: bool,

    /// Cover traffic percentage (0.0 to 1.0)
    pub cover_traffic_ratio: f64,

    /// Ephemeral message TTL
    pub ephemeral_ttl: Duration,
}

/// Performance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// Enable performance monitoring
    pub monitoring: bool,

    /// Performance metrics collection interval
    pub metrics_interval: Duration,

    /// Enable automatic optimization
    pub auto_optimization: bool,

    /// CPU usage limit (0.0 to 1.0)
    pub cpu_limit: f64,

    /// Memory usage limit in MB
    pub memory_limit: usize,

    /// Network bandwidth limit in MB/s
    pub bandwidth_limit: usize,

    /// Connection pool size
    pub connection_pool_size: usize,

    /// Message queue size
    pub message_queue_size: usize,
}

/// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Enable security monitoring
    pub monitoring: bool,

    /// Enable intrusion detection
    pub intrusion_detection: bool,

    /// Enable rate limiting
    pub rate_limiting: bool,

    /// Rate limit (messages per second)
    pub rate_limit: u32,

    /// Enable message validation
    pub message_validation: bool,

    /// Enable peer verification
    pub peer_verification: bool,

    /// Security alert threshold
    pub alert_threshold: u32,

    /// Blacklist suspicious peers
    pub blacklist_enabled: bool,

    /// Blacklist duration
    pub blacklist_duration: Duration,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    /// Enable logging
    pub enabled: bool,

    /// Log level
    pub level: LogLevel,

    /// Enable structured logging
    pub structured: bool,

    /// Log to file
    pub file_logging: bool,

    /// Log file path
    pub log_file: Option<String>,

    /// Log rotation size in MB
    pub rotation_size: usize,

    /// Number of log files to keep
    pub max_files: usize,

    /// Enable metrics logging
    pub metrics_logging: bool,
}

/// Log level enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LogLevel {
    /// Error level
    Error,
    /// Warning level
    Warn,
    /// Info level
    Info,
    /// Debug level
    Debug,
    /// Trace level
    Trace,
}

impl Default for BitChatConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            crypto_mode: CryptoMode::Hybrid,
            transports: vec![TransportType::InternetP2P, TransportType::LocalNetwork],
            store_forward: true,
            cover_traffic: false,
            compression: true,
            ephemeral_messages: false,
            emergency_wipe: false,
            max_message_size: 1024 * 1024, // 1MB
            message_timeout: Duration::from_secs(30),
            max_peers: 50,
            heartbeat_interval: Duration::from_secs(30),
            store_forward_ttl: Duration::from_secs(3600), // 1 hour
            cover_traffic_interval: Duration::from_secs(60),
            compression_threshold: 1024, // 1KB
            bind_address: "0.0.0.0".to_string(),
            listen_port: 0, // Random port
            bootstrap_peers: Vec::new(),
            transport_configs: HashMap::new(),
            privacy: PrivacyConfig::default(),
            performance: PerformanceConfig::default(),
            security: SecurityConfig::default(),
            logging: LoggingConfig::default(),
        }
    }
}

impl Default for TransportConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            settings: HashMap::new(),
            timeout: Duration::from_secs(30),
            max_retries: 3,
            retry_backoff: 2.0,
        }
    }
}

impl Default for PrivacyConfig {
    fn default() -> Self {
        Self {
            metadata_protection: true,
            message_padding: true,
            timing_obfuscation: false,
            anonymous_routing: false,
            cover_traffic_ratio: 0.1,
            ephemeral_ttl: Duration::from_secs(3600),
        }
    }
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            monitoring: true,
            metrics_interval: Duration::from_secs(60),
            auto_optimization: true,
            cpu_limit: 0.8,
            memory_limit: 256,   // 256MB
            bandwidth_limit: 10, // 10MB/s
            connection_pool_size: 100,
            message_queue_size: 1000,
        }
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            monitoring: true,
            intrusion_detection: true,
            rate_limiting: true,
            rate_limit: 100,
            message_validation: true,
            peer_verification: true,
            alert_threshold: 10,
            blacklist_enabled: true,
            blacklist_duration: Duration::from_secs(3600),
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            level: LogLevel::Info,
            structured: true,
            file_logging: false,
            log_file: None,
            rotation_size: 100, // 100MB
            max_files: 5,
            metrics_logging: true,
        }
    }
}

impl BitChatConfig {
    /// Create a development configuration
    pub fn development() -> Self {
        Self {
            enabled: true,
            crypto_mode: CryptoMode::Traditional, // Faster for development
            transports: vec![TransportType::InternetP2P, TransportType::LocalNetwork],
            store_forward: true,
            cover_traffic: false,
            compression: true,
            ephemeral_messages: false,
            emergency_wipe: false,
            max_message_size: 512 * 1024, // 512KB
            message_timeout: Duration::from_secs(10),
            max_peers: 10,
            heartbeat_interval: Duration::from_secs(10),
            store_forward_ttl: Duration::from_secs(300), // 5 minutes
            cover_traffic_interval: Duration::from_secs(30),
            compression_threshold: 512,
            bind_address: "127.0.0.1".to_string(),
            listen_port: 0,
            bootstrap_peers: vec!["127.0.0.1:8001".to_string(), "127.0.0.1:8002".to_string()],
            transport_configs: HashMap::new(),
            privacy: PrivacyConfig {
                metadata_protection: false,
                message_padding: false,
                timing_obfuscation: false,
                anonymous_routing: false,
                cover_traffic_ratio: 0.0,
                ephemeral_ttl: Duration::from_secs(300),
            },
            performance: PerformanceConfig {
                monitoring: true,
                metrics_interval: Duration::from_secs(10),
                auto_optimization: false,
                cpu_limit: 0.5,
                memory_limit: 128,
                bandwidth_limit: 1,
                connection_pool_size: 10,
                message_queue_size: 100,
            },
            security: SecurityConfig {
                monitoring: false,
                intrusion_detection: false,
                rate_limiting: false,
                rate_limit: 1000,
                message_validation: true,
                peer_verification: false,
                alert_threshold: 100,
                blacklist_enabled: false,
                blacklist_duration: Duration::from_secs(60),
            },
            logging: LoggingConfig {
                enabled: true,
                level: LogLevel::Debug,
                structured: false,
                file_logging: false,
                log_file: None,
                rotation_size: 10,
                max_files: 2,
                metrics_logging: false,
            },
        }
    }

    /// Create a production configuration
    pub fn production() -> Self {
        Self {
            enabled: true,
            crypto_mode: CryptoMode::Hybrid,
            transports: vec![
                TransportType::InternetP2P,
                TransportType::LocalNetwork,
                TransportType::BluetoothMesh,
            ],
            store_forward: true,
            cover_traffic: true,
            compression: true,
            ephemeral_messages: true,
            emergency_wipe: true,
            max_message_size: 2 * 1024 * 1024, // 2MB
            message_timeout: Duration::from_secs(60),
            max_peers: 100,
            heartbeat_interval: Duration::from_secs(60),
            store_forward_ttl: Duration::from_secs(24 * 3600), // 24 hours
            cover_traffic_interval: Duration::from_secs(120),
            compression_threshold: 2048,
            bind_address: "0.0.0.0".to_string(),
            listen_port: 8500,
            bootstrap_peers: Vec::new(),
            transport_configs: HashMap::new(),
            privacy: PrivacyConfig {
                metadata_protection: true,
                message_padding: true,
                timing_obfuscation: true,
                anonymous_routing: true,
                cover_traffic_ratio: 0.2,
                ephemeral_ttl: Duration::from_secs(3600),
            },
            performance: PerformanceConfig {
                monitoring: true,
                metrics_interval: Duration::from_secs(60),
                auto_optimization: true,
                cpu_limit: 0.8,
                memory_limit: 512,
                bandwidth_limit: 50,
                connection_pool_size: 200,
                message_queue_size: 2000,
            },
            security: SecurityConfig {
                monitoring: true,
                intrusion_detection: true,
                rate_limiting: true,
                rate_limit: 50,
                message_validation: true,
                peer_verification: true,
                alert_threshold: 5,
                blacklist_enabled: true,
                blacklist_duration: Duration::from_secs(24 * 3600),
            },
            logging: LoggingConfig {
                enabled: true,
                level: LogLevel::Info,
                structured: true,
                file_logging: true,
                log_file: Some("/var/log/bitchat-qudag.log".to_string()),
                rotation_size: 1000,
                max_files: 10,
                metrics_logging: true,
            },
        }
    }

    /// Create a high-privacy configuration
    pub fn high_privacy() -> Self {
        Self {
            enabled: true,
            crypto_mode: CryptoMode::Hybrid,
            transports: vec![TransportType::InternetP2P, TransportType::BluetoothMesh],
            store_forward: true,
            cover_traffic: true,
            compression: true,
            ephemeral_messages: true,
            emergency_wipe: true,
            max_message_size: 1024 * 1024, // 1MB
            message_timeout: Duration::from_secs(30),
            max_peers: 20,
            heartbeat_interval: Duration::from_secs(45),
            store_forward_ttl: Duration::from_secs(3600), // 1 hour
            cover_traffic_interval: Duration::from_secs(30),
            compression_threshold: 1024,
            bind_address: "0.0.0.0".to_string(),
            listen_port: 0,
            bootstrap_peers: Vec::new(),
            transport_configs: HashMap::new(),
            privacy: PrivacyConfig {
                metadata_protection: true,
                message_padding: true,
                timing_obfuscation: true,
                anonymous_routing: true,
                cover_traffic_ratio: 0.3,
                ephemeral_ttl: Duration::from_secs(1800),
            },
            performance: PerformanceConfig {
                monitoring: false,
                metrics_interval: Duration::from_secs(300),
                auto_optimization: false,
                cpu_limit: 0.6,
                memory_limit: 256,
                bandwidth_limit: 5,
                connection_pool_size: 50,
                message_queue_size: 500,
            },
            security: SecurityConfig {
                monitoring: true,
                intrusion_detection: true,
                rate_limiting: true,
                rate_limit: 10,
                message_validation: true,
                peer_verification: true,
                alert_threshold: 3,
                blacklist_enabled: true,
                blacklist_duration: Duration::from_secs(24 * 3600),
            },
            logging: LoggingConfig {
                enabled: false,
                level: LogLevel::Error,
                structured: true,
                file_logging: false,
                log_file: None,
                rotation_size: 10,
                max_files: 1,
                metrics_logging: false,
            },
        }
    }

    /// Create a WASM-compatible configuration
    pub fn wasm() -> Self {
        Self {
            enabled: true,
            crypto_mode: CryptoMode::Traditional,
            transports: vec![TransportType::WebSocket],
            store_forward: false,
            cover_traffic: false,
            compression: true,
            ephemeral_messages: false,
            emergency_wipe: false,
            max_message_size: 256 * 1024, // 256KB
            message_timeout: Duration::from_secs(15),
            max_peers: 20,
            heartbeat_interval: Duration::from_secs(30),
            store_forward_ttl: Duration::from_secs(0),
            cover_traffic_interval: Duration::from_secs(0),
            compression_threshold: 1024,
            bind_address: "0.0.0.0".to_string(),
            listen_port: 0,
            bootstrap_peers: Vec::new(),
            transport_configs: HashMap::new(),
            privacy: PrivacyConfig {
                metadata_protection: false,
                message_padding: false,
                timing_obfuscation: false,
                anonymous_routing: false,
                cover_traffic_ratio: 0.0,
                ephemeral_ttl: Duration::from_secs(0),
            },
            performance: PerformanceConfig {
                monitoring: false,
                metrics_interval: Duration::from_secs(60),
                auto_optimization: false,
                cpu_limit: 0.3,
                memory_limit: 64,
                bandwidth_limit: 1,
                connection_pool_size: 10,
                message_queue_size: 100,
            },
            security: SecurityConfig {
                monitoring: false,
                intrusion_detection: false,
                rate_limiting: true,
                rate_limit: 50,
                message_validation: true,
                peer_verification: false,
                alert_threshold: 20,
                blacklist_enabled: false,
                blacklist_duration: Duration::from_secs(300),
            },
            logging: LoggingConfig {
                enabled: true,
                level: LogLevel::Info,
                structured: false,
                file_logging: false,
                log_file: None,
                rotation_size: 0,
                max_files: 0,
                metrics_logging: false,
            },
        }
    }

    /// Create a testing configuration
    pub fn testing() -> Self {
        Self {
            enabled: true,
            crypto_mode: CryptoMode::Traditional,
            transports: vec![TransportType::LocalNetwork],
            store_forward: false,
            cover_traffic: false,
            compression: false,
            ephemeral_messages: false,
            emergency_wipe: false,
            max_message_size: 64 * 1024, // 64KB
            message_timeout: Duration::from_secs(5),
            max_peers: 5,
            heartbeat_interval: Duration::from_secs(5),
            store_forward_ttl: Duration::from_secs(60),
            cover_traffic_interval: Duration::from_secs(10),
            compression_threshold: 256,
            bind_address: "127.0.0.1".to_string(),
            listen_port: 0,
            bootstrap_peers: Vec::new(),
            transport_configs: HashMap::new(),
            privacy: PrivacyConfig {
                metadata_protection: false,
                message_padding: false,
                timing_obfuscation: false,
                anonymous_routing: false,
                cover_traffic_ratio: 0.0,
                ephemeral_ttl: Duration::from_secs(60),
            },
            performance: PerformanceConfig {
                monitoring: false,
                metrics_interval: Duration::from_secs(5),
                auto_optimization: false,
                cpu_limit: 0.9,
                memory_limit: 32,
                bandwidth_limit: 1,
                connection_pool_size: 5,
                message_queue_size: 50,
            },
            security: SecurityConfig {
                monitoring: false,
                intrusion_detection: false,
                rate_limiting: false,
                rate_limit: 1000,
                message_validation: false,
                peer_verification: false,
                alert_threshold: 100,
                blacklist_enabled: false,
                blacklist_duration: Duration::from_secs(10),
            },
            logging: LoggingConfig {
                enabled: false,
                level: LogLevel::Error,
                structured: false,
                file_logging: false,
                log_file: None,
                rotation_size: 0,
                max_files: 0,
                metrics_logging: false,
            },
        }
    }

    /// Validate configuration
    pub fn validate(&self) -> Result<()> {
        if self.max_message_size == 0 {
            return Err(BitChatError::Config(
                "max_message_size must be greater than 0".to_string(),
            ));
        }

        if self.max_peers == 0 {
            return Err(BitChatError::Config(
                "max_peers must be greater than 0".to_string(),
            ));
        }

        if self.compression_threshold > self.max_message_size {
            return Err(BitChatError::Config(
                "compression_threshold cannot be larger than max_message_size".to_string(),
            ));
        }

        if self.listen_port > 65535 {
            return Err(BitChatError::Config(
                "listen_port must be a valid port number".to_string(),
            ));
        }

        if self.transports.is_empty() {
            return Err(BitChatError::Config(
                "at least one transport must be enabled".to_string(),
            ));
        }

        if self.privacy.cover_traffic_ratio < 0.0 || self.privacy.cover_traffic_ratio > 1.0 {
            return Err(BitChatError::Config(
                "cover_traffic_ratio must be between 0.0 and 1.0".to_string(),
            ));
        }

        if self.performance.cpu_limit < 0.0 || self.performance.cpu_limit > 1.0 {
            return Err(BitChatError::Config(
                "cpu_limit must be between 0.0 and 1.0".to_string(),
            ));
        }

        Ok(())
    }

    /// Merge with another configuration
    pub fn merge(&mut self, other: &BitChatConfig) {
        // Merge basic settings
        if other.enabled != self.enabled {
            self.enabled = other.enabled;
        }

        // Merge transport configs
        for (transport_type, config) in &other.transport_configs {
            self.transport_configs
                .insert(transport_type.clone(), config.clone());
        }

        // Merge bootstrap peers
        for peer in &other.bootstrap_peers {
            if !self.bootstrap_peers.contains(peer) {
                self.bootstrap_peers.push(peer.clone());
            }
        }
    }

    /// Convert to JSON string
    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string_pretty(self).map_err(BitChatError::Json)
    }

    /// Create from JSON string
    pub fn from_json(json: &str) -> Result<Self> {
        serde_json::from_str(json).map_err(BitChatError::Json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = BitChatConfig::default();
        assert!(config.enabled);
        assert!(matches!(config.crypto_mode, CryptoMode::Hybrid));
        assert!(config.store_forward);
        assert!(config.compression);
        assert!(!config.transports.is_empty());

        config.validate().unwrap();
    }

    #[test]
    fn test_development_config() {
        let config = BitChatConfig::development();
        assert!(config.enabled);
        assert!(matches!(config.crypto_mode, CryptoMode::Traditional));
        assert_eq!(config.bind_address, "127.0.0.1");
        assert!(!config.bootstrap_peers.is_empty());
        assert!(!config.privacy.metadata_protection);
        assert!(!config.security.monitoring);

        config.validate().unwrap();
    }

    #[test]
    fn test_production_config() {
        let config = BitChatConfig::production();
        assert!(config.enabled);
        assert!(config.cover_traffic);
        assert!(config.emergency_wipe);
        assert!(config.ephemeral_messages);
        assert_eq!(config.listen_port, 8500);
        assert!(config.privacy.metadata_protection);
        assert!(config.security.monitoring);

        config.validate().unwrap();
    }

    #[test]
    fn test_high_privacy_config() {
        let config = BitChatConfig::high_privacy();
        assert!(config.enabled);
        assert!(config.cover_traffic);
        assert!(config.ephemeral_messages);
        assert!(config.emergency_wipe);
        assert!(config.privacy.anonymous_routing);
        assert!(config.privacy.timing_obfuscation);
        assert!(!config.logging.enabled);

        config.validate().unwrap();
    }

    #[test]
    fn test_wasm_config() {
        let config = BitChatConfig::wasm();
        assert!(config.enabled);
        assert!(matches!(config.crypto_mode, CryptoMode::Traditional));
        assert_eq!(config.transports.len(), 1);
        assert!(matches!(config.transports[0], TransportType::WebSocket));
        assert!(!config.store_forward);
        assert!(!config.cover_traffic);

        config.validate().unwrap();
    }

    #[test]
    fn test_config_validation() {
        let mut config = BitChatConfig::default();

        // Test invalid max_message_size
        config.max_message_size = 0;
        assert!(config.validate().is_err());

        // Test invalid max_peers
        config.max_message_size = 1024;
        config.max_peers = 0;
        assert!(config.validate().is_err());

        // Test invalid compression_threshold
        config.max_peers = 10;
        config.compression_threshold = 2048;
        config.max_message_size = 1024;
        assert!(config.validate().is_err());

        // Test invalid port
        config.compression_threshold = 512;
        config.listen_port = 70000;
        assert!(config.validate().is_err());

        // Test empty transports
        config.listen_port = 8080;
        config.transports.clear();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_config_merge() {
        let mut config1 = BitChatConfig::development();
        let config2 = BitChatConfig::production();

        config1.merge(&config2);

        // Should have merged bootstrap peers
        assert!(config1.bootstrap_peers.len() >= 2);
    }

    #[test]
    fn test_json_serialization() {
        let config = BitChatConfig::development();
        let json = config.to_json().unwrap();
        let deserialized = BitChatConfig::from_json(&json).unwrap();

        assert_eq!(config.enabled, deserialized.enabled);
        assert_eq!(config.max_message_size, deserialized.max_message_size);
        assert_eq!(config.bind_address, deserialized.bind_address);
    }
}

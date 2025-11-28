//! Configuration management for the Neural Trading system
//!
//! This module provides configuration types with validation using serde and validator.
//! Configuration can be loaded from environment variables, TOML files, or JSON.

use crate::error::{Result, TradingError};
use serde::{Deserialize, Serialize};
use std::path::Path;
use validator::Validate;

// ============================================================================
// Main Configuration
// ============================================================================

/// Main application configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct AppConfig {
    /// Server configuration
    #[validate]
    pub server: ServerConfig,

    /// Broker configuration (Alpaca, etc.)
    #[validate]
    pub broker: BrokerConfig,

    /// Strategy configurations
    #[validate]
    pub strategies: Vec<StrategyConfig>,

    /// Risk management configuration
    #[validate]
    pub risk: RiskConfig,

    /// Database configuration
    #[validate]
    pub database: DatabaseConfig,

    /// Logging configuration
    #[validate]
    pub logging: LoggingConfig,
}

impl AppConfig {
    /// Load configuration from a TOML file
    ///
    /// # Arguments
    ///
    /// * `path` - Path to TOML configuration file
    ///
    /// # Returns
    ///
    /// Validated configuration
    pub fn from_toml_file(path: impl AsRef<Path>) -> Result<Self> {
        let contents = std::fs::read_to_string(path.as_ref())
            .map_err(|e| TradingError::config(format!("Failed to read config file: {}", e)))?;

        let config: Self = toml::from_str(&contents)
            .map_err(|e| TradingError::config(format!("Failed to parse TOML config: {}", e)))?;

        config
            .validate()
            .map_err(|e| TradingError::config(format!("Configuration validation failed: {}", e)))?;

        Ok(config)
    }

    /// Load configuration from a JSON file
    ///
    /// # Arguments
    ///
    /// * `path` - Path to JSON configuration file
    ///
    /// # Returns
    ///
    /// Validated configuration
    pub fn from_json_file(path: impl AsRef<Path>) -> Result<Self> {
        let contents = std::fs::read_to_string(path.as_ref())
            .map_err(|e| TradingError::config(format!("Failed to read config file: {}", e)))?;

        let config: Self = serde_json::from_str(&contents)
            .map_err(|e| TradingError::config(format!("Failed to parse JSON config: {}", e)))?;

        config
            .validate()
            .map_err(|e| TradingError::config(format!("Configuration validation failed: {}", e)))?;

        Ok(config)
    }

    /// Create a default configuration for testing
    pub fn default_test_config() -> Self {
        Self {
            server: ServerConfig::default(),
            broker: BrokerConfig::default(),
            strategies: vec![],
            risk: RiskConfig::default(),
            database: DatabaseConfig::default(),
            logging: LoggingConfig::default(),
        }
    }
}

// ============================================================================
// Server Configuration
// ============================================================================

/// HTTP server configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct ServerConfig {
    /// Server host
    #[validate(length(min = 1))]
    pub host: String,

    /// Server port
    #[validate(range(min = 1024, max = 65535))]
    pub port: u16,

    /// Enable HTTPS
    pub enable_https: bool,

    /// Maximum request size in bytes
    #[validate(range(min = 1024, max = 104857600))] // 1KB to 100MB
    pub max_request_size: usize,

    /// Request timeout in seconds
    #[validate(range(min = 1, max = 300))]
    pub request_timeout_secs: u64,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            enable_https: false,
            max_request_size: 10485760, // 10MB
            request_timeout_secs: 30,
        }
    }
}

// ============================================================================
// Broker Configuration
// ============================================================================

/// Broker API configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct BrokerConfig {
    /// Broker name (alpaca, polygon, etc.)
    #[validate(length(min = 1))]
    pub name: String,

    /// API base URL
    #[validate(url)]
    pub api_url: String,

    /// WebSocket URL for real-time data
    #[validate(url)]
    pub ws_url: String,

    /// API key (should be loaded from environment)
    #[serde(skip_serializing)]
    pub api_key: String,

    /// API secret (should be loaded from environment)
    #[serde(skip_serializing)]
    pub api_secret: String,

    /// Paper trading mode
    pub paper_trading: bool,

    /// Connection timeout in seconds
    #[validate(range(min = 1, max = 60))]
    pub connection_timeout_secs: u64,

    /// Maximum retry attempts
    #[validate(range(min = 0, max = 10))]
    pub max_retry_attempts: u32,
}

impl Default for BrokerConfig {
    fn default() -> Self {
        Self {
            name: "alpaca".to_string(),
            api_url: "https://paper-api.alpaca.markets".to_string(),
            ws_url: "wss://stream.data.alpaca.markets".to_string(),
            api_key: String::new(),
            api_secret: String::new(),
            paper_trading: true,
            connection_timeout_secs: 30,
            max_retry_attempts: 3,
        }
    }
}

// ============================================================================
// Strategy Configuration
// ============================================================================

/// Individual strategy configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct StrategyConfig {
    /// Strategy ID
    #[validate(length(min = 1))]
    pub id: String,

    /// Strategy type (momentum, mean_reversion, etc.)
    #[validate(length(min = 1))]
    pub strategy_type: String,

    /// Symbols to trade
    #[validate(length(min = 1))]
    pub symbols: Vec<String>,

    /// Enable this strategy
    pub enabled: bool,

    /// Strategy-specific parameters
    pub parameters: serde_json::Value,
}

// ============================================================================
// Risk Configuration
// ============================================================================

/// Risk management configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct RiskConfig {
    /// Maximum position size as percentage of portfolio (0.0-1.0)
    #[validate(range(min = 0.0, max = 1.0))]
    pub max_position_size: f64,

    /// Maximum daily loss as percentage of portfolio (0.0-1.0)
    #[validate(range(min = 0.0, max = 1.0))]
    pub max_daily_loss: f64,

    /// Maximum drawdown as percentage (0.0-1.0)
    #[validate(range(min = 0.0, max = 1.0))]
    pub max_drawdown: f64,

    /// Maximum leverage allowed
    #[validate(range(min = 1.0, max = 10.0))]
    pub max_leverage: f64,

    /// Stop loss percentage (0.0-1.0)
    #[validate(range(min = 0.0, max = 1.0))]
    pub default_stop_loss: f64,

    /// Take profit percentage (0.0-1.0)
    #[validate(range(min = 0.0, max = 1.0))]
    pub default_take_profit: f64,

    /// Maximum sector concentration (0.0-1.0)
    #[validate(range(min = 0.0, max = 1.0))]
    pub max_sector_concentration: f64,

    /// Enable circuit breakers
    pub enable_circuit_breakers: bool,

    /// Circuit breaker cool-down period in seconds
    #[validate(range(min = 60, max = 86400))] // 1 minute to 1 day
    pub circuit_breaker_cooldown_secs: u64,
}

impl Default for RiskConfig {
    fn default() -> Self {
        Self {
            max_position_size: 0.1,        // 10% per position
            max_daily_loss: 0.05,          // 5% max daily loss
            max_drawdown: 0.2,             // 20% max drawdown
            max_leverage: 1.0,             // No leverage
            default_stop_loss: 0.02,       // 2% stop loss
            default_take_profit: 0.05,     // 5% take profit
            max_sector_concentration: 0.3, // 30% max per sector
            enable_circuit_breakers: true,
            circuit_breaker_cooldown_secs: 300, // 5 minutes
        }
    }
}

// ============================================================================
// Database Configuration
// ============================================================================

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct DatabaseConfig {
    /// Database type (sqlite, postgres, etc.)
    #[validate(length(min = 1))]
    pub database_type: String,

    /// Connection URL
    #[validate(length(min = 1))]
    pub connection_url: String,

    /// Maximum number of connections in the pool
    #[validate(range(min = 1, max = 100))]
    pub max_connections: u32,

    /// Connection timeout in seconds
    #[validate(range(min = 1, max = 60))]
    pub connection_timeout_secs: u64,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            database_type: "sqlite".to_string(),
            connection_url: "sqlite::memory:".to_string(),
            max_connections: 10,
            connection_timeout_secs: 30,
        }
    }
}

// ============================================================================
// Logging Configuration
// ============================================================================

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct LoggingConfig {
    /// Log level (trace, debug, info, warn, error)
    #[validate(length(min = 1))]
    pub level: String,

    /// Log format (json, pretty, compact)
    #[validate(length(min = 1))]
    pub format: String,

    /// Enable file logging
    pub enable_file_logging: bool,

    /// Log file path
    pub log_file_path: Option<String>,

    /// Maximum log file size in bytes
    #[validate(range(min = 1048576, max = 1073741824))] // 1MB to 1GB
    pub max_log_file_size: usize,

    /// Number of log files to keep
    #[validate(range(min = 1, max = 100))]
    pub log_file_count: usize,
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            format: "pretty".to_string(),
            enable_file_logging: false,
            log_file_path: None,
            max_log_file_size: 10485760, // 10MB
            log_file_count: 5,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_default_config() {
        let config = AppConfig::default_test_config();
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_server_config_validation() {
        let mut config = ServerConfig::default();
        assert!(config.validate().is_ok());

        // Invalid port
        config.port = 80; // Below minimum 1024
        assert!(config.validate().is_err());

        // Valid port
        config.port = 8080;
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_risk_config_validation() {
        let mut config = RiskConfig::default();
        assert!(config.validate().is_ok());

        // Invalid max_position_size
        config.max_position_size = 1.5; // Above 1.0
        assert!(config.validate().is_err());

        // Valid max_position_size
        config.max_position_size = 0.2;
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_load_from_toml() {
        let toml_config = r#"
[server]
host = "0.0.0.0"
port = 8080
enable_https = false
max_request_size = 10485760
request_timeout_secs = 30

[broker]
name = "alpaca"
api_url = "https://paper-api.alpaca.markets"
ws_url = "wss://stream.data.alpaca.markets"
api_key = "test_key"
api_secret = "test_secret"
paper_trading = true
connection_timeout_secs = 30
max_retry_attempts = 3

[[strategies]]
id = "momentum_1"
strategy_type = "momentum"
symbols = ["AAPL", "GOOGL"]
enabled = true
parameters = {}

[risk]
max_position_size = 0.1
max_daily_loss = 0.05
max_drawdown = 0.2
max_leverage = 1.0
default_stop_loss = 0.02
default_take_profit = 0.05
max_sector_concentration = 0.3
enable_circuit_breakers = true
circuit_breaker_cooldown_secs = 300

[database]
database_type = "sqlite"
connection_url = "sqlite::memory:"
max_connections = 10
connection_timeout_secs = 30

[logging]
level = "info"
format = "pretty"
enable_file_logging = false
max_log_file_size = 10485760
log_file_count = 5
        "#;

        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(toml_config.as_bytes()).unwrap();
        temp_file.flush().unwrap();

        let config = AppConfig::from_toml_file(temp_file.path()).unwrap();
        assert_eq!(config.server.port, 8080);
        assert_eq!(config.broker.name, "alpaca");
        assert_eq!(config.strategies.len(), 1);
        assert_eq!(config.risk.max_position_size, 0.1);
    }

    #[test]
    fn test_broker_config_default() {
        let config = BrokerConfig::default();
        assert_eq!(config.name, "alpaca");
        assert!(config.paper_trading);
        assert_eq!(config.max_retry_attempts, 3);
    }

    #[test]
    fn test_logging_config_validation() {
        let mut config = LoggingConfig::default();
        assert!(config.validate().is_ok());

        // Invalid log file size
        config.max_log_file_size = 100; // Below minimum 1MB
        assert!(config.validate().is_err());

        // Valid log file size
        config.max_log_file_size = 10485760; // 10MB
        assert!(config.validate().is_ok());
    }
}

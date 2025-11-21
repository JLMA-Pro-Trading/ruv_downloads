//! Error types for BitChat-QuDAG integration

use thiserror::Error;

/// Result type for BitChat operations
pub type Result<T> = std::result::Result<T, BitChatError>;

/// Comprehensive error types for BitChat messaging
#[derive(Error, Debug)]
pub enum BitChatError {
    #[error("Transport error: {0}")]
    Transport(String),

    #[error("Cryptographic error: {0}")]
    Crypto(String),

    #[error("Compression error: {0}")]
    Compression(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] bincode::Error),

    #[error("JSON serialization error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Peer error: {0}")]
    Peer(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Timeout error: {0}")]
    Timeout(String),

    #[error("Invalid message: {0}")]
    InvalidMessage(String),

    #[error("Storage error: {0}")]
    Storage(String),

    #[error("IO error: {0}")]
    IO(#[from] std::io::Error),

    #[error("Authentication error: {0}")]
    Authentication(String),

    #[error("Authorization error: {0}")]
    Authorization(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimit(String),

    #[error("Resource exhausted: {0}")]
    ResourceExhausted(String),

    #[error("Protocol error: {0}")]
    Protocol(String),

    #[error("WASM error: {0}")]
    Wasm(String),

    #[error("Feature not supported: {0}")]
    NotSupported(String),

    #[error("Generic error: {0}")]
    Generic(String),
}

impl BitChatError {
    /// Check if error is recoverable
    pub fn is_recoverable(&self) -> bool {
        match self {
            BitChatError::Transport(_) => true,
            BitChatError::Network(_) => true,
            BitChatError::Timeout(_) => true,
            BitChatError::Peer(_) => true,
            BitChatError::IO(_) => true,
            BitChatError::RateLimit(_) => true,
            BitChatError::ResourceExhausted(_) => true,
            _ => false,
        }
    }

    /// Check if error is temporary
    pub fn is_temporary(&self) -> bool {
        match self {
            BitChatError::Network(_) => true,
            BitChatError::Timeout(_) => true,
            BitChatError::RateLimit(_) => true,
            BitChatError::ResourceExhausted(_) => true,
            _ => false,
        }
    }

    /// Check if error is permanent
    pub fn is_permanent(&self) -> bool {
        match self {
            BitChatError::Config(_) => true,
            BitChatError::Serialization(_) => true,
            BitChatError::Json(_) => true,
            BitChatError::InvalidMessage(_) => true,
            BitChatError::NotSupported(_) => true,
            BitChatError::Authentication(_) => true,
            BitChatError::Authorization(_) => true,
            _ => false,
        }
    }

    /// Get error category
    pub fn category(&self) -> &'static str {
        match self {
            BitChatError::Transport(_) => "transport",
            BitChatError::Crypto(_) => "crypto",
            BitChatError::Compression(_) => "compression",
            BitChatError::Serialization(_) => "serialization",
            BitChatError::Json(_) => "json",
            BitChatError::Config(_) => "config",
            BitChatError::Peer(_) => "peer",
            BitChatError::Network(_) => "network",
            BitChatError::Timeout(_) => "timeout",
            BitChatError::InvalidMessage(_) => "invalid_message",
            BitChatError::Storage(_) => "storage",
            BitChatError::IO(_) => "io",
            BitChatError::Authentication(_) => "authentication",
            BitChatError::Authorization(_) => "authorization",
            BitChatError::RateLimit(_) => "rate_limit",
            BitChatError::ResourceExhausted(_) => "resource_exhausted",
            BitChatError::Protocol(_) => "protocol",
            BitChatError::Wasm(_) => "wasm",
            BitChatError::NotSupported(_) => "not_supported",
            BitChatError::Generic(_) => "generic",
        }
    }

    /// Get error code for API responses
    pub fn code(&self) -> u32 {
        match self {
            BitChatError::Transport(_) => 1001,
            BitChatError::Crypto(_) => 1002,
            BitChatError::Compression(_) => 1003,
            BitChatError::Serialization(_) => 1004,
            BitChatError::Json(_) => 1005,
            BitChatError::Config(_) => 1006,
            BitChatError::Peer(_) => 1007,
            BitChatError::Network(_) => 1008,
            BitChatError::Timeout(_) => 1009,
            BitChatError::InvalidMessage(_) => 1010,
            BitChatError::Storage(_) => 1011,
            BitChatError::IO(_) => 1012,
            BitChatError::Authentication(_) => 1013,
            BitChatError::Authorization(_) => 1014,
            BitChatError::RateLimit(_) => 1015,
            BitChatError::ResourceExhausted(_) => 1016,
            BitChatError::Protocol(_) => 1017,
            BitChatError::Wasm(_) => 1018,
            BitChatError::NotSupported(_) => 1019,
            BitChatError::Generic(_) => 1000,
        }
    }

    /// Convert to JSON for API responses
    pub fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "error": {
                "code": self.code(),
                "category": self.category(),
                "message": self.to_string(),
                "recoverable": self.is_recoverable(),
                "temporary": self.is_temporary(),
                "permanent": self.is_permanent(),
            }
        })
    }
}

/// Convert from various error types
impl From<String> for BitChatError {
    fn from(s: String) -> Self {
        BitChatError::Generic(s)
    }
}

impl From<&str> for BitChatError {
    fn from(s: &str) -> Self {
        BitChatError::Generic(s.to_string())
    }
}

impl From<uuid::Error> for BitChatError {
    fn from(e: uuid::Error) -> Self {
        BitChatError::Generic(format!("UUID error: {}", e))
    }
}

impl From<chrono::ParseError> for BitChatError {
    fn from(e: chrono::ParseError) -> Self {
        BitChatError::Generic(format!("Time parsing error: {}", e))
    }
}

#[cfg(feature = "messaging")]
impl From<rocksdb::Error> for BitChatError {
    fn from(e: rocksdb::Error) -> Self {
        BitChatError::Storage(format!("RocksDB error: {}", e))
    }
}

#[cfg(all(feature = "networking", not(target_arch = "wasm32")))]
impl From<libp2p::noise::Error> for BitChatError {
    fn from(e: libp2p::noise::Error) -> Self {
        BitChatError::Crypto(format!("Noise protocol error: {}", e))
    }
}

// WASM-specific error conversions
#[cfg(feature = "wasm")]
impl From<wasm_bindgen::JsValue> for BitChatError {
    fn from(js_val: wasm_bindgen::JsValue) -> Self {
        let error_msg = if let Some(string) = js_val.as_string() {
            string
        } else {
            format!("{:?}", js_val)
        };
        BitChatError::Wasm(error_msg)
    }
}

#[cfg(feature = "wasm")]
impl From<BitChatError> for wasm_bindgen::JsValue {
    fn from(error: BitChatError) -> Self {
        let js_error = js_sys::Error::new(&error.to_string());
        js_error.into()
    }
}

/// Error metrics for monitoring
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ErrorMetrics {
    /// Total error count
    pub total_errors: u64,
    /// Errors by category
    pub errors_by_category: std::collections::HashMap<String, u64>,
    /// Recoverable errors
    pub recoverable_errors: u64,
    /// Temporary errors
    pub temporary_errors: u64,
    /// Permanent errors
    pub permanent_errors: u64,
}

impl Default for ErrorMetrics {
    fn default() -> Self {
        Self {
            total_errors: 0,
            errors_by_category: std::collections::HashMap::new(),
            recoverable_errors: 0,
            temporary_errors: 0,
            permanent_errors: 0,
        }
    }
}

impl ErrorMetrics {
    /// Record an error
    pub fn record_error(&mut self, error: &BitChatError) {
        self.total_errors += 1;

        let category = error.category().to_string();
        *self.errors_by_category.entry(category).or_insert(0) += 1;

        if error.is_recoverable() {
            self.recoverable_errors += 1;
        }

        if error.is_temporary() {
            self.temporary_errors += 1;
        }

        if error.is_permanent() {
            self.permanent_errors += 1;
        }
    }

    /// Get error rate for a category
    pub fn error_rate(&self, category: &str) -> f64 {
        if self.total_errors == 0 {
            return 0.0;
        }

        let category_errors = self.errors_by_category.get(category).unwrap_or(&0);
        *category_errors as f64 / self.total_errors as f64
    }

    /// Get overall error statistics
    pub fn statistics(&self) -> ErrorStatistics {
        ErrorStatistics {
            total_errors: self.total_errors,
            recoverable_rate: if self.total_errors > 0 {
                self.recoverable_errors as f64 / self.total_errors as f64
            } else {
                0.0
            },
            temporary_rate: if self.total_errors > 0 {
                self.temporary_errors as f64 / self.total_errors as f64
            } else {
                0.0
            },
            permanent_rate: if self.total_errors > 0 {
                self.permanent_errors as f64 / self.total_errors as f64
            } else {
                0.0
            },
            top_categories: {
                let mut categories: Vec<_> = self.errors_by_category.iter().collect();
                categories.sort_by(|a, b| b.1.cmp(a.1));
                categories
                    .into_iter()
                    .take(5)
                    .map(|(k, v)| (k.clone(), *v))
                    .collect()
            },
        }
    }
}

/// Error statistics summary
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ErrorStatistics {
    /// Total number of errors
    pub total_errors: u64,
    /// Percentage of recoverable errors
    pub recoverable_rate: f64,
    /// Percentage of temporary errors
    pub temporary_rate: f64,
    /// Percentage of permanent errors
    pub permanent_rate: f64,
    /// Top 5 error categories
    pub top_categories: Vec<(String, u64)>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = BitChatError::Transport("test error".to_string());
        assert_eq!(err.category(), "transport");
        assert!(err.is_recoverable());
        assert_eq!(err.code(), 1001);
        assert_eq!(err.to_string(), "Transport error: test error");
    }

    #[test]
    fn test_error_conversion() {
        let err: BitChatError = "test error".into();
        assert_eq!(err.category(), "generic");
        assert!(!err.is_recoverable());
        assert_eq!(err.code(), 1000);
    }

    #[test]
    fn test_error_classification() {
        let crypto_err = BitChatError::Crypto("encryption failed".to_string());
        assert_eq!(crypto_err.category(), "crypto");
        assert!(!crypto_err.is_recoverable());
        assert!(!crypto_err.is_temporary());
        assert!(!crypto_err.is_permanent());

        let config_err = BitChatError::Config("invalid config".to_string());
        assert!(config_err.is_permanent());
        assert!(!config_err.is_temporary());

        let network_err = BitChatError::Network("connection lost".to_string());
        assert!(network_err.is_recoverable());
        assert!(network_err.is_temporary());
        assert!(!network_err.is_permanent());
    }

    #[test]
    fn test_error_metrics() {
        let mut metrics = ErrorMetrics::default();

        let transport_err = BitChatError::Transport("transport error".to_string());
        let crypto_err = BitChatError::Crypto("crypto error".to_string());
        let network_err = BitChatError::Network("network error".to_string());

        metrics.record_error(&transport_err);
        metrics.record_error(&crypto_err);
        metrics.record_error(&network_err);

        assert_eq!(metrics.total_errors, 3);
        assert_eq!(metrics.recoverable_errors, 2); // transport and network
        assert_eq!(metrics.temporary_errors, 1); // network
        assert_eq!(metrics.permanent_errors, 0);

        let stats = metrics.statistics();
        assert_eq!(stats.total_errors, 3);
        assert_eq!(stats.recoverable_rate, 2.0 / 3.0);
    }

    #[test]
    fn test_error_json() {
        let err = BitChatError::Authentication("invalid token".to_string());
        let json = err.to_json();

        assert_eq!(json["error"]["code"], 1013);
        assert_eq!(json["error"]["category"], "authentication");
        assert_eq!(
            json["error"]["message"],
            "Authentication error: invalid token"
        );
        assert_eq!(json["error"]["permanent"], true);
    }
}

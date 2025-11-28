//! Error types for the Neural Trading system
//!
//! This module provides a comprehensive error hierarchy using `thiserror` for automatic
//! trait implementations and context propagation.

use thiserror::Error;

/// Main error type for the Neural Trading system
///
/// This error type covers all possible error conditions across the entire system.
/// Each variant provides specific context about what went wrong.
#[derive(Debug, Error)]
pub enum TradingError {
    /// Error occurred during market data operations
    #[error("Market data error: {message}")]
    MarketData {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Error occurred in strategy execution
    #[error("Strategy error in '{strategy_id}': {message}")]
    Strategy {
        strategy_id: String,
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Error occurred during order execution
    #[error("Execution error: {message}")]
    Execution {
        message: String,
        order_id: Option<String>,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Risk limit has been exceeded
    #[error("Risk limit exceeded: {message}")]
    RiskLimit {
        message: String,
        violation_type: RiskViolationType,
    },

    /// Configuration error
    #[error("Configuration error: {message}")]
    Config {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Portfolio management error
    #[error("Portfolio error: {message}")]
    Portfolio { message: String },

    /// Network/API error
    #[error("Network error: {message}")]
    Network {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Data validation error
    #[error("Validation error: {message}")]
    Validation { message: String },

    /// Resource not found
    #[error("Not found: {resource_type} '{resource_id}'")]
    NotFound {
        resource_type: String,
        resource_id: String,
    },

    /// Operation timeout
    #[error("Operation timed out after {timeout_ms}ms: {operation}")]
    Timeout { operation: String, timeout_ms: u64 },

    /// Authentication/authorization error
    #[error("Authentication error: {message}")]
    Auth { message: String },

    /// Database error
    #[error("Database error: {message}")]
    Database {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Serialization/deserialization error
    #[error("Serialization error: {message}")]
    Serialization {
        message: String,
        #[source]
        source: Option<Box<dyn std::error::Error + Send + Sync>>,
    },

    /// Internal system error
    #[error("Internal error: {message}")]
    Internal { message: String },

    /// Invalid state error
    #[error("Invalid state: {message}")]
    InvalidState { message: String },

    /// Not implemented yet
    #[error("Not implemented: {feature}")]
    NotImplemented { feature: String },

    /// Generic error from anyhow
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

/// Type of risk violation
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RiskViolationType {
    /// Position size exceeds maximum allowed
    PositionSizeExceeded,
    /// Daily loss limit exceeded
    DailyLossLimitExceeded,
    /// Maximum drawdown exceeded
    MaxDrawdownExceeded,
    /// Leverage limit exceeded
    LeverageExceeded,
    /// Sector concentration limit exceeded
    SectorConcentrationExceeded,
    /// Correlation limit exceeded
    CorrelationExceeded,
}

impl TradingError {
    /// Create a market data error
    pub fn market_data(message: impl Into<String>) -> Self {
        Self::MarketData {
            message: message.into(),
            source: None,
        }
    }

    /// Create a market data error with source
    pub fn market_data_with_source(
        message: impl Into<String>,
        source: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self::MarketData {
            message: message.into(),
            source: Some(Box::new(source)),
        }
    }

    /// Create a strategy error
    pub fn strategy(strategy_id: impl Into<String>, message: impl Into<String>) -> Self {
        Self::Strategy {
            strategy_id: strategy_id.into(),
            message: message.into(),
            source: None,
        }
    }

    /// Create a strategy error with source
    pub fn strategy_with_source(
        strategy_id: impl Into<String>,
        message: impl Into<String>,
        source: impl std::error::Error + Send + Sync + 'static,
    ) -> Self {
        Self::Strategy {
            strategy_id: strategy_id.into(),
            message: message.into(),
            source: Some(Box::new(source)),
        }
    }

    /// Create an execution error
    pub fn execution(message: impl Into<String>) -> Self {
        Self::Execution {
            message: message.into(),
            order_id: None,
            source: None,
        }
    }

    /// Create an execution error with order ID
    pub fn execution_with_order(message: impl Into<String>, order_id: impl Into<String>) -> Self {
        Self::Execution {
            message: message.into(),
            order_id: Some(order_id.into()),
            source: None,
        }
    }

    /// Create a risk limit error
    pub fn risk_limit(message: impl Into<String>, violation_type: RiskViolationType) -> Self {
        Self::RiskLimit {
            message: message.into(),
            violation_type,
        }
    }

    /// Create a configuration error
    pub fn config(message: impl Into<String>) -> Self {
        Self::Config {
            message: message.into(),
            source: None,
        }
    }

    /// Create a validation error
    pub fn validation(message: impl Into<String>) -> Self {
        Self::Validation {
            message: message.into(),
        }
    }

    /// Create a not found error
    pub fn not_found(resource_type: impl Into<String>, resource_id: impl Into<String>) -> Self {
        Self::NotFound {
            resource_type: resource_type.into(),
            resource_id: resource_id.into(),
        }
    }

    /// Create a timeout error
    pub fn timeout(operation: impl Into<String>, timeout_ms: u64) -> Self {
        Self::Timeout {
            operation: operation.into(),
            timeout_ms,
        }
    }

    /// Create an internal error
    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal {
            message: message.into(),
        }
    }

    /// Create an invalid state error
    pub fn invalid_state(message: impl Into<String>) -> Self {
        Self::InvalidState {
            message: message.into(),
        }
    }

    /// Create a not implemented error
    pub fn not_implemented(feature: impl Into<String>) -> Self {
        Self::NotImplemented {
            feature: feature.into(),
        }
    }
}

/// Result type alias for trading operations
pub type Result<T> = std::result::Result<T, TradingError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = TradingError::market_data("Connection failed");
        assert!(matches!(err, TradingError::MarketData { .. }));
        assert!(err.to_string().contains("Market data error"));

        let err = TradingError::strategy("momentum", "Invalid parameter");
        assert!(matches!(err, TradingError::Strategy { .. }));
        assert!(err.to_string().contains("momentum"));

        let err = TradingError::risk_limit(
            "Position too large",
            RiskViolationType::PositionSizeExceeded,
        );
        assert!(matches!(err, TradingError::RiskLimit { .. }));
    }

    #[test]
    fn test_error_with_source() {
        use std::error::Error;

        let io_error = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err = TradingError::market_data_with_source("Failed to read data", io_error);

        assert!(matches!(err, TradingError::MarketData { .. }));
        assert!(err.source().is_some());
    }

    #[test]
    fn test_not_found_error() {
        let err = TradingError::not_found("order", "12345");
        assert!(matches!(err, TradingError::NotFound { .. }));
        assert!(err.to_string().contains("order"));
        assert!(err.to_string().contains("12345"));
    }

    #[test]
    fn test_timeout_error() {
        let err = TradingError::timeout("place_order", 5000);
        assert!(matches!(err, TradingError::Timeout { .. }));
        assert!(err.to_string().contains("5000ms"));
    }

    #[test]
    fn test_result_type() {
        fn returns_result() -> Result<i32> {
            Ok(42)
        }

        fn returns_error() -> Result<i32> {
            Err(TradingError::internal("Test error"))
        }

        assert!(returns_result().is_ok());
        assert!(returns_error().is_err());
    }
}

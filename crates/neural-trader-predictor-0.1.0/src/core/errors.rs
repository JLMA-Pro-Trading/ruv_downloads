//! Error types for conformal prediction

use thiserror::Error;

/// Result type for conformal prediction operations
pub type Result<T> = std::result::Result<T, Error>;

/// Error types for neural trader predictor
#[derive(Error, Debug)]
pub enum Error {
    /// Invalid configuration
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),

    /// Insufficient calibration data
    #[error("Insufficient calibration data: need at least {need}, got {got}")]
    InsufficientData { need: usize, got: usize },

    /// Mismatched array lengths
    #[error("Array length mismatch: predictions={predictions}, actuals={actuals}")]
    LengthMismatch { predictions: usize, actuals: usize },

    /// Invalid alpha value
    #[error("Invalid alpha value: {0} (must be between 0 and 1)")]
    InvalidAlpha(f64),

    /// Invalid quantile value
    #[error("Invalid quantile value: {0} (must be between 0 and 1)")]
    InvalidQuantile(f64),

    /// Predictor not calibrated
    #[error("Predictor not calibrated: call calibrate() first")]
    NotCalibrated,

    /// Numerical error
    #[error("Numerical error: {0}")]
    NumericalError(String),

    /// I/O error
    #[error("I/O error: {0}")]
    IoError(#[from] std::io::Error),

    /// Serialization error
    #[error("Serialization error: {0}")]
    SerializationError(String),

    /// Other error
    #[error("Error: {0}")]
    Other(String),
}

impl Error {
    /// Create invalid config error
    pub fn invalid_config(msg: impl Into<String>) -> Self {
        Self::InvalidConfig(msg.into())
    }

    /// Create insufficient data error
    pub fn insufficient_data(need: usize, got: usize) -> Self {
        Self::InsufficientData { need, got }
    }

    /// Create length mismatch error
    pub fn length_mismatch(predictions: usize, actuals: usize) -> Self {
        Self::LengthMismatch { predictions, actuals }
    }

    /// Create numerical error
    pub fn numerical(msg: impl Into<String>) -> Self {
        Self::NumericalError(msg.into())
    }

    /// Create serialization error
    pub fn serialization(msg: impl Into<String>) -> Self {
        Self::SerializationError(msg.into())
    }

    /// Create other error
    pub fn other(msg: impl Into<String>) -> Self {
        Self::Other(msg.into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_creation() {
        let err = Error::invalid_config("test");
        assert!(err.to_string().contains("Invalid configuration"));

        let err = Error::insufficient_data(100, 50);
        assert!(err.to_string().contains("need at least 100"));

        let err = Error::InvalidAlpha(1.5);
        assert!(err.to_string().contains("must be between 0 and 1"));
    }
}
